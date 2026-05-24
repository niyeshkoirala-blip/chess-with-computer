const board = document.getElementById('chess-board');
const upgradeModal = document.getElementById('upgrade-modal');
const gameOverModal = document.getElementById('game-over-modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const turnBadge = document.getElementById('turnBadge');
const surrenderButton = document.getElementById('surrenderButton');
const moveEval = document.getElementById('moveEval');
const moveHistory = document.getElementById('moveHistory');

function showPromoModal() {
  upgradeModal.style.display = 'flex';
  modalBackdrop.classList.remove('hidden');
}
function compaftermove(data){
    const toDiv = data.toDiv;
    const fromDiv = data.fromDiv;
    const state = data.state;
    
    toDiv.textContent = data.promotionPiece || fromDiv.textContent;
            fromDiv.textContent = '';

            if (data.clearedsquare) {
              const clearedDiv = document.getElementById(`${data.clearedsquare.row}-${data.clearedsquare.col}`);
              clearedDiv.textContent = '';
              boardstate[data.clearedsquare.row][data.clearedsquare.col] = null;
            }

            if (state === 'castle' && data.rookTo) {
              const rookSymbol = turn === 'white' ? '♖' : '♜';
              const rookFromCol = data.castleSide === 'king' ? 7 : 0;
              const rookRow = data.rookTo.row;
              document.getElementById(`${rookRow}-${rookFromCol}`).textContent = '';
              document.getElementById(`${rookRow}-${data.rookTo.col}`).textContent = rookSymbol;
              boardstate[rookRow][rookFromCol] = null;
              boardstate[rookRow][data.rookTo.col] = rookSymbol;
            }

            if (state === 'upgrade') {
              upgradepiece(selectedSquare[1].row, selectedSquare[1].col);
            }

            document.querySelectorAll('.square').forEach(sq => sq.classList.remove('check'));
            if (state === 'check') {
              const enemyKing = turn === 'white' ? '♚' : '♔';
              const kingSquare = Array.from(document.querySelectorAll('.square'))
                .find(sq => sq.textContent === enemyKing);
              if (kingSquare) kingSquare.classList.add('check');
            }

            turn = color[(color.indexOf(turn) + 1) % color.length];
            updateTurnBadge();
}

function hidePromoModal() {
  upgradeModal.style.display = 'none';
  modalBackdrop.classList.add('hidden');
}

function showGameOver(title, subtitle) {
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultSubtitle').textContent = subtitle;
  gameOverModal.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
}

function updateTurnBadge() {
  turnBadge.textContent = turn === 'white' ? "WHITE'S TURN" : "BLACK'S TURN";
  turnBadge.classList.toggle('black-turn', turn === 'black');
}

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function coordsToSquare(coords) {
  const file = String.fromCharCode('a'.charCodeAt(0) + coords.col);
  const rank = 8 - coords.row;
  return `${file}${rank}`;
}

function moveName(piece, from, to, capturedPiece) {
  const captureMark = capturedPiece ? 'x' : '-';
  return `${piece} ${coordsToSquare(from)}${captureMark}${coordsToSquare(to)}`;
}

function setMoveEval(label) {
  moveEval.textContent = label.toUpperCase();
}

function addHistory(turnName, notation, label) {
  moveCounter++;

  const row = document.createElement('div');
  row.className = 'history-row';
  row.dataset.moveNumber = String(moveCounter);
  row.innerHTML = `
    <div class="history-number">${moveCounter}.</div>
    <div class="history-main">
      <div class="history-move">${turnName.toUpperCase()} ${notation}</div>
      <div class="history-label">${label}</div>
    </div>
  `;
  moveHistory.appendChild(row);
  moveHistory.scrollTop = moveHistory.scrollHeight;
  setMoveEval(label);

  return moveCounter;
}

function updateHistoryLabel(moveNumber, label) {
  const row = moveHistory.querySelector(`[data-move-number="${moveNumber}"]`);
  if (!row) return;

  row.querySelector('.history-label').textContent = label;
  setMoveEval(label);
}

function evaluatePlayedMove(payload, moveNumber) {
  fetch('/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
      updateHistoryLabel(moveNumber, data.label || 'Unrated');
    })
    .catch(() => {
      updateHistoryLabel(moveNumber, 'Unrated');
    });
}

function upgradepiece(row, col) {
  showPromoModal();

  document.getElementById('upgrade-queen').onclick = () => {
    boardstate[row][col] = turn !== 'white' ? '♕' : '♛';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    hidePromoModal();
  };
  document.getElementById('upgrade-rook').onclick = () => {
    boardstate[row][col] = turn !== 'white' ? '♖' : '♜';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    hidePromoModal();
  };
  document.getElementById('upgrade-bishop').onclick = () => {
    boardstate[row][col] = turn !== 'white' ? '♗' : '♝';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    hidePromoModal();
  };
  document.getElementById('upgrade-knight').onclick = () => {
    boardstate[row][col] = turn !== 'white' ? '♘' : '♞';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    hidePromoModal();
  };
}

let boardstate = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"]
];

for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    const square = document.createElement('div');
    square.className = 'square';
    square.id = `${row}-${col}`;
    square.textContent = boardstate[row][col] || '';
    square.classList.add((row % 2 === col % 2) ? 'light' : 'dark');
    board.appendChild(square);
  }
}

let color = ['white', 'black'];
let turn = color[0];
let blackPieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
let whitePieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
let islegal;
let state = "fine";
let capturedByBlack = [];
let capturedByWhite = [];
let selectedSquare = [{ row: null, col: null }, { row: null, col: null }];
let clickCount = 0;
let botThinking = false;
let gameOver = false;
let moveCounter = 0;
const real = "real";

const params = new URLSearchParams(window.location.search);

const playerColor = params.get('playerColor');
const mode = params.get('mode');

function requestBotMove() {
  if (gameOver || mode !== 'bot' || turn === playerColor || botThinking) return;

  botThinking = true;

  fetch('/bot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      boardstate: boardstate,
      turn: turn
    })
  })
    .then(response => response.json())
    .then(data => {
      if (gameOver) return;

      if (!data.islegal || !data.from || !data.to) {
        console.error(data.error || 'Bot did not return a legal move.');
        return;
      }

      const movingTurn = turn;
      const beforeBoard = cloneBoard(boardstate);
      const capturedPiece = boardstate[data.to.row][data.to.col];
      if (blackPieces.includes(capturedPiece)) {
        capturedByBlack.push(capturedPiece);
        document.getElementById('eatenBlack').textContent = capturedByBlack.join('');
      } else if (whitePieces.includes(capturedPiece)) {
        capturedByWhite.push(capturedPiece);
        document.getElementById('eatenWhite').textContent = capturedByWhite.join('');
      }

      const movingPiece = boardstate[data.from.row][data.from.col];
      const notation = moveName(movingPiece, data.from, data.to, capturedPiece);
      boardstate[data.to.row][data.to.col] = data.promotionPiece || movingPiece;
      boardstate[data.from.row][data.from.col] = null;

      const fromDiv = document.getElementById(`${data.from.row}-${data.from.col}`);
      const toDiv = document.getElementById(`${data.to.row}-${data.to.col}`);
      let compaftermovedata = {
        fromDiv: fromDiv,
        toDiv: toDiv,
        castleSide: data.castleSide,
        rookTo: data.rookTo,
        state: data.state,
        clearedsquare: data.clearedsquare,
        promotionPiece: data.promotionPiece
      };
      compaftermove(compaftermovedata);
      const afterBoard = cloneBoard(boardstate);
      const historyNumber = addHistory(movingTurn, notation, 'Analyzing');
      evaluatePlayedMove({
        beforeBoard,
        afterBoard,
        turn: movingTurn,
        from: data.from,
        to: data.to,
        promotionPiece: data.promotionPiece
      }, historyNumber);
    })
    .catch(err => console.error('Bot move failed:', err))
    .finally(() => {
      botThinking = false;
    });
}

requestBotMove();

document.querySelectorAll('.square').forEach(square => {
  square.addEventListener('click', () => {
    if (gameOver || botThinking || (mode === 'bot' && turn !== playerColor)) return;

    const [row, col] = square.id.split('-').map(Number);
    const piece = boardstate[row][col];

    if (blackPieces.includes(piece) && turn === 'black' ||
        whitePieces.includes(piece) && turn === 'white' ||
        clickCount === 1) {

      if (clickCount === 0) {
        document.querySelectorAll('.square').forEach(sq => sq.classList.remove('selected'));
        square.classList.add('selected');
      }

      selectedSquare[clickCount] = { row, col };
      clickCount++;

      if (clickCount === 2) {
        document.querySelectorAll('.square').forEach(sq => sq.classList.remove('selected'));

        fetch('/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: selectedSquare[0],
            to: selectedSquare[1],
            piece: boardstate[selectedSquare[0].row][selectedSquare[0].col],
            turn: turn,
            boardstate: boardstate,
            state: state,
            real: real,
          })
        })
        .then(response => response.json())
        .then(data => {
          islegal = data.islegal;
          state = data.state;
          castleSide = data.castleSide;
          rookTo = data.rookTo

          if (data.eatencolor === 'black') {
            capturedByBlack.push(data.eatenpeices);
            document.getElementById('eatenBlack').textContent = capturedByBlack.join('');
          } else if (data.eatencolor === 'white') {
            capturedByWhite.push(data.eatenpeices);
            document.getElementById('eatenWhite').textContent = capturedByWhite.join('');
          }

          if (state === 'checkmate') {
            gameOver = true;
            showGameOver(`${turn.toUpperCase()} WINS`, 'The king has fallen. The game is over.');
            clickCount = 0;
          } else if (state === 'stalemate') {
            gameOver = true;
            showGameOver('STALEMATE', 'The board is silent. Neither side prevails.');
            clickCount = 0;
          } else if (!islegal) {
            clickCount = 0;
          } else {
            const movingTurn = turn;
            const beforeBoard = cloneBoard(boardstate);
            const from = { ...selectedSquare[0] };
            const to = { ...selectedSquare[1] };
            const movingPiece = boardstate[from.row][from.col];
            const capturedPiece = boardstate[to.row][to.col];
            const notation = moveName(movingPiece, from, to, capturedPiece);

            boardstate[selectedSquare[1].row][selectedSquare[1].col] =
              boardstate[selectedSquare[0].row][selectedSquare[0].col];
            boardstate[selectedSquare[0].row][selectedSquare[0].col] = null;

            const fromDiv = document.getElementById(`${selectedSquare[0].row}-${selectedSquare[0].col}`);
            const toDiv   = document.getElementById(`${selectedSquare[1].row}-${selectedSquare[1].col}`);
           compaftermovedata ={ 
              fromDiv : fromDiv,
              toDiv : toDiv,
              castleSide: castleSide,
              rookTo : rookTo,
              state : state,
              clearedsquare : data.clearedsquare
            }
            compaftermove(compaftermovedata);
            const afterBoard = cloneBoard(boardstate);
            const historyNumber = addHistory(movingTurn, notation, 'Analyzing');
            evaluatePlayedMove({
              beforeBoard,
              afterBoard,
              turn: movingTurn,
              from,
              to
            }, historyNumber);
            clickCount = 0;
            requestBotMove();
          }
        });
      }
    }
  });
});

surrenderButton.addEventListener('click', () => {
  if (gameOver) return;

  gameOver = true;
  const winner = turn === 'white' ? 'BLACK' : 'WHITE';
  showGameOver(`${winner} WINS`, `${turn.toUpperCase()} surrendered.`);
});
