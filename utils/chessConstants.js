const WHITE_PIECES = ['♖', '♘', '♗', '♕', '♔', '♙'];
const BLACK_PIECES = ['♜', '♞', '♝', '♛', '♚', '♟'];
const ALL_PIECES = BLACK_PIECES.concat(WHITE_PIECES);

const INITIAL_BOARD = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

const PROMOTION_PIECES = {
  white: {
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
  },
  black: {
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
  },
};

function cloneBoard(boardstate) {
  return boardstate.map(row => [...row]);
}

function nextTurn(turn) {
  return turn === 'white' ? 'black' : 'white';
}

function pieceColor(piece) {
  if (WHITE_PIECES.includes(piece)) return 'white';
  if (BLACK_PIECES.includes(piece)) return 'black';
  return null;
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

module.exports = {
  WHITE_PIECES,
  BLACK_PIECES,
  ALL_PIECES,
  INITIAL_BOARD,
  PROMOTION_PIECES,
  cloneBoard,
  nextTurn,
  pieceColor,
  coordsToSquare,
  moveName,
};
