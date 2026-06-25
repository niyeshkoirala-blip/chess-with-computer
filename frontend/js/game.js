// Game page logic
(function () {
  const $ = id => document.getElementById(id);
  const socket = io();

  // ── State ────────────────────────────────────────────────────────────────────
  const stored      = JSON.parse(sessionStorage.getItem('chess-game') || '{}');
  let gameId        = stored.gameId;
  let myColor       = stored.color || 'white';
  let gameMode      = stored.mode  || 'hvb';
  const playerToken = stored.playerToken || null;
  let gameState = null;
  let localTurn = 'white'; // for hvh-local
  const evalLabels = {}; // moveNumber -> label string

  if (!gameId) { window.location.href = '/'; return; }

  const isLocal  = gameMode === 'hvh-local';
  const isBvB    = gameMode === 'bvb';
  const isHvB    = gameMode === 'hvb';
  const isOnline = gameMode === 'hvh';

  // ── Board ────────────────────────────────────────────────────────────────────
  const boardEl = $('board');

  const board = new ChessBoard(boardEl, {
    flipped: myColor === 'black',
    interactive: !isBvB,
    myColor: isLocal ? 'white' : myColor,
    onMove: handleMoveAttempt,
    onPromotion: handlePromoRequest
  });

  // ── Socket events ────────────────────────────────────────────────────────────
  socket.on('game-started', (gs) => {
    // Fires on initial join (hvb, bvb, hvh-local already have full state)
    if (!gameState) { gameState = gs; }
    applyGameState(gs);
  });

  socket.on('move-made', (data) => {
    if (!gameState) return; // wait for full-game-state first

    // Update local game state
    gameState.boardstate = data.boardstate;
    gameState.turn = data.turn;
    gameState.capturedPieces = data.capturedPieces;
    gameState.context = data.context;
    if (!gameState.moveHistory) gameState.moveHistory = [];
    gameState.moveHistory.push({
      from: data.from, to: data.to, piece: data.piece,
      capturedPiece: data.capturedPiece, promotionPiece: data.promotionPiece,
      state: data.state, castleSide: data.castleSide,
      moveNumber: data.moveNumber
    });

    // Update board visual state (no render yet)
    board.highlight(data.from, data.to);

    if (isLocal) {
      localTurn = data.turn;
      board.setMyColor(data.turn); // flip for local — updates flipped flag only
    }

    if (data.state === 'check' || data.state === 'checkmate') {
      const kingPiece = data.turn === 'white' ? '♔' : '♚';
      board.setCheck(findKing(data.boardstate, kingPiece));
    } else {
      board.clearCheck();
    }

    const myTurn = isLocal ? true : data.turn === myColor;
    board.setInteractive(!isBvB && myTurn);
    updateTurnGlow(!isBvB && myTurn, data.turn);

    // Single render call
    board.render(data.boardstate, data.turn);

    updateMoveHistory(gameState.moveHistory);
    updateCaptured(data.capturedPieces);
    updateTurnIndicator(data.turn, data.state);

    if (data.isBot) showToast(`Engine: ${moveLabel(data)}`);
  });

  socket.on('bot-thinking', ({ color }) => {
    $('status-text').textContent = `${cap(color)} is thinking…`;
    board.setInteractive(false);
    // no re-render needed, cursor handled via CSS class
  });

  socket.on('move-rejected', ({ reason }) => {
    showToast(`Illegal move${reason ? ': ' + reason : ''}`);
    if (gameState) board.render(gameState.boardstate, gameState.turn);
  });

  socket.on('game-over', ({ reason, winner }) => {
    if (gameState) gameState.status = 'ended';
    board.setInteractive(false);
    showGameOver(reason, winner);
  });

  socket.on('draw-offered', ({ by }) => {
    $('draw-offerer').textContent = cap(by);
    openModal('draw-offer-modal');
  });

  socket.on('draw-declined', () => showToast('Draw declined'));

  socket.on('player-disconnected', ({ color }) => {
    showToast(`${cap(color)} disconnected — waiting 30s…`);
  });

  socket.on('bvb-pause-state', ({ paused }) => {
    const btn = $('btn-bvb-pause');
    if (btn) btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  });

  socket.on('bot-error', ({ message }) => showToast(`Engine error: ${message}`));

  // Show save section in game-over modal for logged-in players
  socket.on('match-auto-saved', ({ matchId }) => {
    const saveEl = $('result-save');
    if (!saveEl) return;
    saveEl.classList.remove('hidden');

    const pinBtn = $('btn-pin-match');
    if (pinBtn) {
      pinBtn.addEventListener('click', async () => {
        pinBtn.disabled = true;
        const res = await fetch(`/api/matches/${matchId}/pin`, { method: 'PATCH' }).then(r => r.json());
        pinBtn.textContent = res.ok ? 'Pinned!' : 'Error';
      });
    }
  });

  // Store evaluation result and re-render move list to show the badge inline
  socket.on('move-eval', ({ label, moveNumber }) => {
    evalLabels[moveNumber] = label;
    if (gameState) updateMoveHistory(gameState.moveHistory);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function applyGameState(gs) {
    // Set all visual state before the single render
    board.highlight(null, null);    // clears lastMove safely
    board.clearCheck();
    board.setMyColor(isLocal ? (localTurn || 'white') : myColor);
    const initMyTurn = !isBvB && gs.turn === (isLocal ? 'white' : myColor);
    board.setInteractive(initMyTurn);
    updateTurnGlow(initMyTurn, gs.turn);

    // Single render
    board.render(gs.boardstate, gs.turn);

    updateTurnIndicator(gs.turn, 'fine');
    updateCaptured(gs.capturedPieces);
    updateMoveHistory(gs.moveHistory || []);
    updatePlayerNames(gs);

    // Show correct controls
    if (isBvB) {
      $('bvb-controls')?.classList.remove('hidden');
      $('human-controls')?.classList.add('hidden');
    } else {
      $('bvb-controls')?.classList.add('hidden');
      $('human-controls')?.classList.remove('hidden');
    }
    if (!isOnline) $('btn-offer-draw')?.setAttribute('disabled', '');
  }

  function handleMoveAttempt(from, to, promotionPiece) {
    if (!gameState || gameState.status !== 'playing') return;
    socket.emit('make-move', { gameId, from, to, promotionPiece });
  }

  function handlePromoRequest(from, to) {
    if (!gameState) return;
    const piece = gameState.boardstate[from.row][from.col];
    const side = ['♔','♕','♖','♗','♘','♙'].includes(piece) ? 'white' : 'black';
    showPromoModal(side);
  }

  function findKing(boardstate, king) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (boardstate[r][c] === king) return { row: r, col: c };
    return null;
  }

  // ── UI Updates ───────────────────────────────────────────────────────────────
  function updateTurnIndicator(turn, state) {
    const tp = $('turn-piece');
    if (tp) tp.textContent = turn === 'white' ? '♙' : '♟';
    const tl = $('turn-label');
    if (tl) tl.textContent = `${cap(turn)}'s turn`;
    const st = $('status-text');
    if (!st) return;
    if (state === 'check')     st.textContent = `${cap(turn)} is in check!`;
    else if (state === 'checkmate') st.textContent = 'Checkmate!';
    else if (state === 'stalemate') st.textContent = 'Stalemate!';
    else st.textContent = '';
  }

  /* Highlight the board + player dot when it's the active turn */
  function updateTurnGlow(isMyTurn, activeTurnColor) {
    const bc = boardEl.closest('.board-container');
    if (bc) bc.classList.toggle('your-turn', isMyTurn);

    // Pulse the dot of whichever player's turn it is
    const topColor = myColor === 'white' ? 'black' : 'white';
    const topDot   = $('top-color-dot');
    const botDot   = $('bot-color-dot');
    const topActive = activeTurnColor === topColor;
    topDot?.classList.toggle('active-turn', topActive);
    botDot?.classList.toggle('active-turn', !topActive);
  }

  function updatePlayerNames(gs) {
    const topColor = myColor === 'white' ? 'black' : 'white';
    const topEl  = $('top-player-name');
    const botEl  = $('bot-player-name');
    const topDot = $('top-color-dot');
    const botDot = $('bot-color-dot');

    if (topEl) {
      const name = gs.playerNames?.[topColor];
      topEl.textContent = name || (isHvB ? 'Stockfish' : 'Opponent');
    }
    if (botEl) botEl.textContent = gs.playerNames?.[myColor] || 'You';
    if (topDot) topDot.className = `player-color-dot ${topColor}`;
    if (botDot) botDot.className = `player-color-dot ${myColor}`;
  }

  function updateCaptured(cap) {
    const topColor = myColor === 'white' ? 'black' : 'white';
    const topEl = $('top-captured');
    const botEl = $('bot-captured');
    if (topEl) topEl.textContent = (cap?.[topColor] || []).join('');
    if (botEl) botEl.textContent = (cap?.[myColor] || []).join('');
  }

  function updateMoveHistory(history) {
    const list = $('move-list');
    if (!list || !history) return;
    list.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
      const wm = history[i];
      const bm = history[i + 1];

      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${Math.floor(i / 2) + 1}.`;

      const ws = document.createElement('span');
      ws.className = 'move-san' + (i === history.length - 1 ? ' current' : '');
      ws.appendChild(document.createTextNode(moveLabel(wm)));
      const wEval = evalLabels[wm.moveNumber];
      if (wEval) {
        const badge = document.createElement('span');
        badge.className = `eval-badge eval-${wEval.toLowerCase()}`;
        badge.textContent = wEval;
        ws.appendChild(badge);
      }

      const bs = document.createElement('span');
      if (bm) {
        bs.className = 'move-san' + (i + 1 === history.length - 1 ? ' current' : '');
        bs.appendChild(document.createTextNode(moveLabel(bm)));
        const bEval = evalLabels[bm.moveNumber];
        if (bEval) {
          const badge = document.createElement('span');
          badge.className = `eval-badge eval-${bEval.toLowerCase()}`;
          badge.textContent = bEval;
          bs.appendChild(badge);
        }
      }

      list.appendChild(num);
      list.appendChild(ws);
      list.appendChild(bs);
    }
    list.scrollTop = list.scrollHeight;
  }

  function moveLabel(m) {
    if (!m) return '';
    const f = 'abcdefgh';
    if (m.castleSide === 'king')  return 'O-O';
    if (m.castleSide === 'queen') return 'O-O-O';
    const from  = `${f[m.from.col]}${8 - m.from.row}`;
    const to    = `${f[m.to.col]}${8 - m.to.row}`;
    const cap   = m.capturedPiece ? 'x' : '';
    const promo = m.promotionPiece ? `=${m.promotionPiece}` : '';
    const check = m.state === 'checkmate' ? '#' : m.state === 'check' ? '+' : '';
    return `${from}${cap}${to}${promo}${check}`;
  }

  // ── Controls ─────────────────────────────────────────────────────────────────
  $('btn-resign')?.addEventListener('click', () => {
    if (!gameState || gameState.status !== 'playing') return;
    if (!confirm('Resign this game?')) return;
    socket.emit('resign', { gameId });
  });

  $('btn-offer-draw')?.addEventListener('click', () => {
    if (!gameState || gameState.status !== 'playing') return;
    socket.emit('offer-draw', { gameId });
    showToast('Draw offered');
  });

  $('btn-flip')?.addEventListener('click', () => board.flip());

  $('btn-bvb-pause')?.addEventListener('click', () => {
    socket.emit('bvb-toggle-pause', { gameId });
  });

  $('btn-home')?.addEventListener('click', () => window.location.href = '/');

  // ── Promotion modal ───────────────────────────────────────────────────────────
  function showPromoModal(side) {
    const pieces = side === 'white'
      ? [['♕','Queen'],['♖','Rook'],['♗','Bishop'],['♘','Knight']]
      : [['♛','Queen'],['♜','Rook'],['♝','Bishop'],['♞','Knight']];

    const row = $('promo-pieces-row');
    row.innerHTML = '';
    pieces.forEach(([piece, name]) => {
      const btn = document.createElement('button');
      btn.className = 'promo-piece-btn';
      btn.title = name;
      const span = document.createElement('span');
      span.className = 'piece';
      span.dataset.side = side;
      span.textContent = piece;
      btn.appendChild(span);
      btn.addEventListener('click', () => {
        closeModal('promotion-modal');
        board.confirmPromotion(piece);
      });
      row.appendChild(btn);
    });
    openModal('promotion-modal');
  }

  // ── Draw offer ───────────────────────────────────────────────────────────────
  $('btn-accept-draw')?.addEventListener('click', () => {
    socket.emit('accept-draw', { gameId });
    closeModal('draw-offer-modal');
  });
  $('btn-decline-draw')?.addEventListener('click', () => {
    socket.emit('decline-draw', { gameId });
    closeModal('draw-offer-modal');
  });

  // ── Game over ─────────────────────────────────────────────────────────────────
  function showGameOver(reason, winner) {
    const icons = { checkmate:'♟', stalemate:'🤝', resign:'🏳️', draw:'🤝', disconnect:'📡', error:'⚠️' };
    $('gameover-icon').textContent = icons[reason] || '🏁';

    let msg = '';
    if (reason === 'checkmate') {
      if (isBvB) msg = `${cap(winner)} wins by checkmate!`;
      else msg = winner === myColor ? '🎉 Checkmate — you win!' : `Checkmate — ${cap(winner)} wins.`;
    } else if (reason === 'stalemate') {
      msg = 'Stalemate — draw!';
    } else if (reason === 'resign') {
      msg = isLocal ? `${cap(winner)} wins (opponent resigned)` :
            winner === myColor ? 'Opponent resigned — you win!' : 'You resigned.';
    } else if (reason === 'draw') {
      msg = 'Draw agreed.';
    } else if (reason === 'disconnect') {
      msg = winner === myColor ? 'Opponent disconnected — you win!' : 'Connection lost.';
    } else {
      msg = 'Game ended.';
    }

    $('gameover-msg').textContent = msg;
    $('gameover-sub').textContent = '';
    openModal('gameover-modal');
  }

  $('btn-play-again')?.addEventListener('click', () => window.location.href = '/');
  $('btn-gameover-home')?.addEventListener('click', () => window.location.href = '/');

  // ── Modals ────────────────────────────────────────────────────────────────────
  function openModal(id)  { $(id)?.classList.remove('hidden'); }
  function closeModal(id) { $(id)?.classList.add('hidden'); }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });

  // ── Toast ─────────────────────────────────────────────────────────────────────
  function showToast(msg, duration = 2500) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), duration);
  }

  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

  // ── Request state ─────────────────────────────────────────────────────────────
  socket.emit('get-game-state', { gameId, playerToken });

  socket.on('full-game-state', (gs) => {
    if (!gs) { window.location.href = '/'; return; }
    gameState = gs;
    applyGameState(gs);
  });
})();
