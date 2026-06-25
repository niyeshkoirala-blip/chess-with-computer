// Chess board rendering and interaction
class ChessBoard {
  constructor(container, { flipped = false, interactive = true, myColor = 'white', onMove, onPromotion } = {}) {
    this.container  = container;
    this.flipped    = flipped;
    this.interactive = interactive;
    this.myColor    = myColor;
    this.onMove     = onMove     || null;
    this.onPromotion = onPromotion || null;

    this.boardstate  = null;
    this.turn        = null;
    this.selected    = null;   // { row, col }
    this.lastMove    = null;   // { from, to }
    this.checkSquare = null;   // { row, col }
    this.cells       = [];
    this.pendingPromo = null;

    // Sub-elements created by _build
    this.gridEl  = null;
    this.ranksEl = null;
    this.filesEl = null;

    this._build();
  }

  // Build the DOM structure:
  //   container (.board-coord-wrap)
  //     ├── .board-ranks   (8 spans, left column)
  //     ├── .chess-board   (64 cell divs)
  //     └── .board-files   (8 spans, bottom row)
  _build() {
    this.container.innerHTML = '';
    this.container.className = 'board-coord-wrap';

    this.ranksEl = document.createElement('div');
    this.ranksEl.className = 'board-ranks';

    this.gridEl = document.createElement('div');
    this.gridEl.className = 'chess-board';

    this.filesEl = document.createElement('div');
    this.filesEl.className = 'board-files';

    this.cells = [];
    for (let dr = 0; dr < 8; dr++) {
      for (let dc = 0; dc < 8; dc++) {
        const cell = document.createElement('div');
        cell.addEventListener('click', () => this._onClick(dr, dc));
        this.gridEl.appendChild(cell);
        this.cells.push(cell);
      }
    }

    this.container.appendChild(this.ranksEl);
    this.container.appendChild(this.gridEl);
    this.container.appendChild(this.filesEl);

    this._refreshCoords();
  }

  // Rebuild the 8 rank and 8 file labels, honouring the current flip state
  _refreshCoords() {
    this.ranksEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const rank = this.flipped ? (i + 1) : (8 - i);
      const el = document.createElement('span');
      el.className = 'coord-label';
      el.textContent = rank;
      this.ranksEl.appendChild(el);
    }

    this.filesEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const file = String.fromCharCode(this.flipped ? (104 - i) : (97 + i));
      const el = document.createElement('span');
      el.className = 'coord-label';
      el.textContent = file;
      this.filesEl.appendChild(el);
    }
  }

  _actual(dr, dc) {
    return this.flipped ? { row: 7 - dr, col: 7 - dc } : { row: dr, col: dc };
  }

  render(boardstate, turn) {
    this.boardstate = boardstate;
    this.turn = turn;
    const WHITE = new Set(['♔','♕','♖','♗','♘','♙']);

    for (let dr = 0; dr < 8; dr++) {
      for (let dc = 0; dc < 8; dc++) {
        const { row, col } = this._actual(dr, dc);
        const cell = this.cells[dr * 8 + dc];
        const isLight = (row + col) % 2 === 0;

        const classes = ['cell', isLight ? 'light' : 'dark'];

        if (this.lastMove && this.lastMove.from && this.lastMove.to) {
          if ((row === this.lastMove.from.row && col === this.lastMove.from.col) ||
              (row === this.lastMove.to.row   && col === this.lastMove.to.col)) {
            classes.push('last-move');
          }
        }

        if (this.selected && this.selected.row === row && this.selected.col === col) {
          classes.push('selected');
        }
        if (this.checkSquare && this.checkSquare.row === row && this.checkSquare.col === col) {
          classes.push('in-check');
        }

        cell.className = classes.join(' ');
        cell.dataset.row = row;
        cell.dataset.col = col;

        cell.innerHTML = '';
        const piece = boardstate[row][col];
        if (piece) {
          const span = document.createElement('span');
          span.className = 'piece';
          span.dataset.side = WHITE.has(piece) ? 'white' : 'black';
          span.textContent = piece;
          cell.appendChild(span);
        }
      }
    }

    this.gridEl.classList.toggle('board-interactive', this.interactive);
  }

  _onClick(dr, dc) {
    if (!this.interactive || !this.boardstate) return;
    const { row, col } = this._actual(dr, dc);
    const WHITE = new Set(['♔','♕','♖','♗','♘','♙']);
    const piece = this.boardstate[row][col];
    const pieceSide = piece ? (WHITE.has(piece) ? 'white' : 'black') : null;

    if (!this.selected) {
      if (piece && pieceSide === this.myColor) {
        this.selected = { row, col };
        this.render(this.boardstate, this.turn);
      }
      return;
    }

    const from = this.selected;

    if (from.row === row && from.col === col) {
      this.selected = null;
      this.render(this.boardstate, this.turn);
      return;
    }

    if (piece && pieceSide === this.myColor) {
      this.selected = { row, col };
      this.render(this.boardstate, this.turn);
      return;
    }

    this.selected = null;
    const movingPiece = this.boardstate[from.row][from.col];

    if (this._isPromotion(movingPiece, from, { row, col })) {
      this.pendingPromo = { from, to: { row, col } };
      if (this.onPromotion) this.onPromotion(from, { row, col });
      return;
    }

    if (this.onMove) this.onMove(from, { row, col }, null);
  }

  _isPromotion(piece, _from, to) {
    return (piece === '♙' && to.row === 0) || (piece === '♟' && to.row === 7);
  }

  confirmPromotion(piece) {
    if (!this.pendingPromo) return;
    const { from, to } = this.pendingPromo;
    this.pendingPromo = null;
    if (this.onMove) this.onMove(from, to, piece);
  }

  highlight(from, to) {
    this.lastMove = (from && to) ? { from, to } : null;
  }

  setCheck(square)  { this.checkSquare = square; }
  clearCheck()      { this.checkSquare = null; }

  setInteractive(v) {
    this.interactive = v;
    if (this.gridEl) this.gridEl.classList.toggle('board-interactive', v);
  }

  setMyColor(color) {
    this.myColor = color;
    this.flipped = color === 'black';
  }

  flip() {
    const el = this.container;
    el.classList.remove('flip-out', 'flip-in');

    // Phase 1 — fold board away (0° → 90°, edge-on at 90° = invisible)
    el.classList.add('flip-out');

    const HALF = 220; // ms — must match CSS animation duration
    setTimeout(() => {
      // Swap state while the board is edge-on (invisible)
      this.flipped = !this.flipped;
      this._refreshCoords();
      if (this.boardstate) this.render(this.boardstate, this.turn);

      // Phase 2 — unfold from the other side (-90° → 0°)
      el.classList.remove('flip-out');
      el.classList.add('flip-in');
      setTimeout(() => el.classList.remove('flip-in'), HALF);
    }, HALF);
  }

  setFlipped(v) {
    this.flipped = v;
    this._refreshCoords();
    if (this.boardstate) this.render(this.boardstate, this.turn);
  }
}

window.ChessBoard = ChessBoard;
