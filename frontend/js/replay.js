(function () {
  const $ = id => document.getElementById(id);

  // ── Initial board ─────────────────────────────────────────────────────────────
  const INITIAL_BOARD = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖']
  ];

  // ── State ─────────────────────────────────────────────────────────────────────
  let states    = [];  // array of { board, turn, from, to } — index 0 = start position
  let history   = [];  // the raw moveHistory from the match
  let stepIndex = 0;
  let playing   = false;
  let playTimer = null;
  let stepMs    = 800; // controlled by speed pills
  let board     = null;

  // ── Board state reconstruction ────────────────────────────────────────────────
  function buildStates(moveHistory) {
    const result = [];
    let b    = INITIAL_BOARD.map(r => [...r]);
    let turn = 'white';

    // Step 0: starting position (no move highlight)
    result.push({ board: b.map(r => [...r]), turn, from: null, to: null });

    for (const move of moveHistory) {
      b = b.map(r => [...r]);

      // Main piece movement (handle promotion)
      b[move.to.row][move.to.col] = move.promotionPiece || b[move.from.row][move.from.col];
      b[move.from.row][move.from.col] = null;

      // Rook movement for castling
      if (move.castleSide === 'king') {
        b[move.from.row][5] = b[move.from.row][7];
        b[move.from.row][7] = null;
      } else if (move.castleSide === 'queen') {
        b[move.from.row][3] = b[move.from.row][0];
        b[move.from.row][0] = null;
      }

      // En passant: clear the captured pawn's square
      if (move.clearedsquare) {
        b[move.clearedsquare.row][move.clearedsquare.col] = null;
      }

      turn = turn === 'white' ? 'black' : 'white';
      result.push({ board: b.map(r => [...r]), turn, from: move.from, to: move.to });
    }

    return result;
  }

  // ── Move label ────────────────────────────────────────────────────────────────
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

  // ── Render a step ─────────────────────────────────────────────────────────────
  function showStep(idx) {
    idx = Math.max(0, Math.min(idx, states.length - 1));
    stepIndex = idx;

    const state = states[idx];
    board.highlight(state.from, state.to);
    board.render(state.board, state.turn);

    $('replay-step-label').textContent = `Move ${idx} / ${states.length - 1}`;

    // Sync move list highlight
    const list = $('replay-move-list');
    list.querySelectorAll('.move-san').forEach(el => {
      el.classList.remove('current');
      if (Number(el.dataset.step) === idx) el.classList.add('current');
    });

    // Scroll highlighted move into view
    const cur = list.querySelector('.move-san.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });

    // Update play button label
    $('btn-play').textContent = playing ? '⏸ Pause' : '▶ Play';
  }

  // ── Play/Pause ────────────────────────────────────────────────────────────────
  function startPlay() {
    if (stepIndex >= states.length - 1) stepIndex = 0; // restart from beginning if at end
    playing = true;
    $('btn-play').textContent = '⏸ Pause';
    scheduleNext();
  }

  function pausePlay() {
    playing = false;
    clearTimeout(playTimer);
    $('btn-play').textContent = '▶ Play';
  }

  function scheduleNext() {
    playTimer = setTimeout(() => {
      if (!playing) return;
      if (stepIndex >= states.length - 1) {
        pausePlay();
        return;
      }
      showStep(stepIndex + 1);
      scheduleNext();
    }, stepMs);
  }

  // ── Render move list ──────────────────────────────────────────────────────────
  function renderMoveList() {
    const list = $('replay-move-list');
    list.innerHTML = '';

    for (let i = 0; i < history.length; i += 2) {
      const wm = history[i];
      const bm = history[i + 1];

      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${Math.floor(i / 2) + 1}.`;

      // White's move — corresponds to states[i+1]
      const ws = document.createElement('span');
      ws.className = 'move-san';
      ws.textContent = moveLabel(wm);
      ws.dataset.step = i + 1;
      ws.addEventListener('click', () => { pausePlay(); showStep(i + 1); });

      const bs = document.createElement('span');
      if (bm) {
        bs.className = 'move-san';
        bs.textContent = moveLabel(bm);
        bs.dataset.step = i + 2;
        bs.addEventListener('click', () => { pausePlay(); showStep(i + 2); });
      }

      list.appendChild(num);
      list.appendChild(ws);
      list.appendChild(bs);
    }
  }

  // ── Result label ──────────────────────────────────────────────────────────────
  function resultLabel(result) {
    if (!result?.reason) return '';
    const { reason, winner } = result;
    if (reason === 'checkmate')  return `Checkmate — ${cap(winner)} wins`;
    if (reason === 'stalemate')  return 'Stalemate';
    if (reason === 'draw')       return 'Draw agreed';
    if (reason === 'resign')     return `${cap(winner)} wins by resignation`;
    if (reason === 'disconnect') return `${cap(winner)} wins (opponent disconnected)`;
    return reason;
  }

  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

  // ── Load match ────────────────────────────────────────────────────────────────
  async function loadMatch() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (!id) {
      $('replay-loading').classList.add('hidden');
      $('replay-error').textContent = 'No match ID provided.';
      $('replay-error').classList.remove('hidden');
      return;
    }

    const res = await fetch(`/api/matches/${id}`);
    $('replay-loading').classList.add('hidden');

    if (!res.ok) {
      $('replay-error').textContent = res.status === 401
        ? 'Sign in to view replays.'
        : 'Match not found.';
      $('replay-error').classList.remove('hidden');
      return;
    }

    const match = await res.json();
    history = match.moveHistory || [];
    states  = buildStates(history);

    // Set up board
    const boardEl = $('replay-board');
    board = new ChessBoard(boardEl, {
      flipped: match.myColor === 'black',
      interactive: false
    });

    // Player names
    $('rp-white').textContent = `♙ ${match.playerNames?.white || 'White'}`;
    $('rp-black').textContent = `♟ ${match.playerNames?.black || 'Black'}`;
    $('rp-result').textContent = resultLabel(match.result);

    renderMoveList();
    showStep(0);

    $('replay-content').classList.remove('hidden');
  }

  // ── Controls ──────────────────────────────────────────────────────────────────
  $('btn-prev')?.addEventListener('click', () => { pausePlay(); showStep(stepIndex - 1); });
  $('btn-next')?.addEventListener('click', () => { pausePlay(); showStep(stepIndex + 1); });
  $('btn-flip')?.addEventListener('click', () => board?.flip());

  $('btn-play')?.addEventListener('click', () => {
    if (playing) pausePlay();
    else startPlay();
  });

  // Speed pills
  document.querySelectorAll('.speed-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      stepMs = Number(pill.dataset.ms);
    });
  });

  // Keyboard: arrow keys to step, space to play/pause
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { pausePlay(); showStep(stepIndex - 1); }
    if (e.key === 'ArrowRight') { pausePlay(); showStep(stepIndex + 1); }
    if (e.key === ' ')          { e.preventDefault(); playing ? pausePlay() : startPlay(); }
  });

  loadMatch();
})();
