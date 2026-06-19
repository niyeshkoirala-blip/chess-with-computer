const board = document.getElementById('chess-board');
const upgradeModal = document.getElementById('upgrade-modal');
const gameOverModal = document.getElementById('game-over-modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const turnBadge = document.getElementById('turnBadge');
const surrenderButton = document.getElementById('surrenderButton');
const moveEval = document.getElementById('moveEval');
const moveHistory = document.getElementById('moveHistory');
const panel = document.querySelector('.game-panel');

const params = new URLSearchParams(window.location.search);
const gameId = params.get('gameId');
const WHITE_PIECES = ['♖', '♘', '♗', '♕', '♔', '♙'];
const BLACK_PIECES = ['♜', '♞', '♝', '♛', '♚', '♟'];
let currentSnapshot = null;
let selected = null;
let busy = false;
let refreshTimer = null;
let botTimer = null;

const joinButton = document.createElement('button');
joinButton.className = 'surrender-btn join-btn';
joinButton.textContent = 'JOIN GAME';
panel.insertBefore(joinButton, surrenderButton);

function api(path, payload = null) {
  const options = payload
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    : {};

  return fetch(path, options).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  });
}

function coordsToSquare(coords) {
  const file = String.fromCharCode('a'.charCodeAt(0) + coords.col);
  const rank = 8 - coords.row;
  return `${file}${rank}`;
}

function renderCaptured(containerId, pieces) {
  document.getElementById(containerId).innerHTML = pieces
    .map(piece => `<span class="captured-item">${piece}</span>`)
    .join('');
}

function setMoveEval(label) {
  moveEval.textContent = String(label || 'AWAITING MOVE').toUpperCase();
}

function showModal(modal) {
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modalBackdrop.classList.remove('hidden');
}

function hidePromoModal() {
  upgradeModal.style.display = 'none';
  modalBackdrop.classList.add('hidden');
}

function showGameOver(title, subtitle) {
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultSubtitle').textContent = subtitle;
  showModal(gameOverModal);
}

function clearSquares() {
  board.innerHTML = '';
}

function makeSquare(row, col, piece) {
  const square = document.createElement('button');
  square.type = 'button';
  square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
  square.id = `${row}-${col}`;
  square.textContent = piece || '';
  square.dataset.row = String(row);
  square.dataset.col = String(col);
  square.addEventListener('click', () => selectSquare(row, col));
  return square;
}

function highlightCheck(game) {
  document.querySelectorAll('.square').forEach(sq => sq.classList.remove('check'));
  if (game.state !== 'check') return;

  const king = game.turn === 'white' ? '♔' : '♚';
  const square = Array.from(document.querySelectorAll('.square')).find(sq => sq.textContent === king);
  if (square) square.classList.add('check');
}

function renderBoard(game) {
  clearSquares();
  game.boardstate.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      board.appendChild(makeSquare(rowIndex, colIndex, piece));
    });
  });
  highlightCheck(game);
}

function renderHistory(game) {
  moveHistory.innerHTML = game.moves
    .map(move => `
      <div class="history-row">
        <div class="history-number">${move.number}.</div>
        <div class="history-main">
          <div class="history-move">${move.turn.toUpperCase()} ${move.notation}</div>
          <div class="history-label">${move.label || move.state}</div>
        </div>
      </div>
    `)
    .join('');
  moveHistory.scrollTop = moveHistory.scrollHeight;
}

function renderStatus(game) {
  turnBadge.textContent = `${game.turn.toUpperCase()}'S TURN`;
  turnBadge.classList.toggle('black-turn', game.turn === 'black');
  joinButton.style.display = game.status === 'waiting' && !game.playerColor ? 'block' : 'none';
  surrenderButton.disabled = !game.playerColor || !['active', 'waiting'].includes(game.status);

  if (game.pendingPromotion) {
    setMoveEval('Promote pawn');
  } else if (game.status === 'waiting') {
    setMoveEval('Waiting for opponent');
  } else if (game.isBotTurn) {
    setMoveEval('Engine thinking');
  } else if (game.canMove) {
    setMoveEval('Your move');
  } else {
    setMoveEval(game.moves.at(-1)?.label || 'Watching');
  }

  if (game.status === 'checkmate') {
    showGameOver(`${game.winner.toUpperCase()} WINS`, 'The king has fallen. The game is over.');
  } else if (game.status === 'stalemate') {
    showGameOver('STALEMATE', 'The board is silent. Neither side prevails.');
  } else if (game.status === 'surrendered') {
    showGameOver(`${game.winner.toUpperCase()} WINS`, 'The opponent surrendered.');
  } else if (game.status === 'abandoned') {
    showGameOver('GAME STOPPED', 'The engine could not continue this position.');
  }
}

function render(snapshot) {
  currentSnapshot = snapshot;
  const { game } = snapshot;
  renderBoard(game);
  renderCaptured('eatenWhite', game.captured.white || []);
  renderCaptured('eatenBlack', game.captured.black || []);
  renderHistory(game);
  renderStatus(game);
  scheduleAutomation(game);
}

function ownPiece(piece, turn) {
  return turn === 'white' ? WHITE_PIECES.includes(piece) : BLACK_PIECES.includes(piece);
}

async function selectSquare(row, col) {
  if (busy || !currentSnapshot?.game?.canMove || currentSnapshot.game.pendingPromotion) return;

  const game = currentSnapshot.game;
  const piece = game.boardstate[row][col];

  if (!selected) {
    if (!ownPiece(piece, game.turn)) return;
    selected = { row, col };
    document.getElementById(`${row}-${col}`).classList.add('selected');
    return;
  }

  document.querySelectorAll('.square').forEach(sq => sq.classList.remove('selected'));
  const from = selected;
  const to = { row, col };
  selected = null;

  if (from.row === to.row && from.col === to.col) return;
  await sendMove(from, to);
}

async function sendMove(from, to, promotion = null) {
  busy = true;
  try {
    const data = await api(`/api/games/${gameId}/move`, { from, to, promotion });
    render(data);

    if (data.result?.promotionRequired) {
      showPromotionChoices();
    } else if (data.result && data.result.islegal === false) {
      setMoveEval('Illegal move');
    }
  } catch (err) {
    setMoveEval(err.message);
  } finally {
    busy = false;
  }
}

function showPromotionChoices() {
  showModal(upgradeModal);
}

async function promote(choice) {
  busy = true;
  try {
    const data = await api(`/api/games/${gameId}/promote`, { promotion: choice });
    hidePromoModal();
    render(data);
  } catch (err) {
    setMoveEval(err.message);
  } finally {
    busy = false;
  }
}

function scheduleAutomation(game) {
  window.clearTimeout(botTimer);
  window.clearTimeout(refreshTimer);

  if (game.status === 'active' && game.isBotTurn) {
    const delay = game.mode === 'bvb' ? game.settings.speed : 450;
    botTimer = window.setTimeout(async () => {
      if (busy) return;
      busy = true;
      try {
        render(await api(`/api/games/${gameId}/bot`, {}));
      } catch (err) {
        setMoveEval(err.message);
      } finally {
        busy = false;
      }
    }, delay);
    return;
  }

  if (game.mode === 'human' && ['waiting', 'active'].includes(game.status)) {
    refreshTimer = window.setTimeout(loadGame, 1800);
  }
}

async function loadGame() {
  if (!gameId || busy) return;
  try {
    render(await api(`/api/games/${gameId}`));
  } catch (err) {
    setMoveEval(err.message);
  }
}

joinButton.addEventListener('click', async () => {
  busy = true;
  try {
    render(await api(`/api/games/${gameId}/join`, {}));
  } catch (err) {
    setMoveEval(err.message);
  } finally {
    busy = false;
  }
});

surrenderButton.addEventListener('click', async () => {
  if (!currentSnapshot?.game || busy) return;
  busy = true;
  try {
    render(await api(`/api/games/${gameId}/surrender`, {}));
  } catch (err) {
    setMoveEval(err.message);
  } finally {
    busy = false;
  }
});

document.getElementById('upgrade-queen').addEventListener('click', () => promote('queen'));
document.getElementById('upgrade-rook').addEventListener('click', () => promote('rook'));
document.getElementById('upgrade-bishop').addEventListener('click', () => promote('bishop'));
document.getElementById('upgrade-knight').addEventListener('click', () => promote('knight'));

if (!gameId) {
  setMoveEval('Missing game id');
} else {
  loadGame();
}
