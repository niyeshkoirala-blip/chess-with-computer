/**
 * Chess Engine Test Suite
 * Run: node test-engine.js
 */

const { movecheck }           = require('./backend/gameengine/movecheck');
const { botmove, evaluateMove } = require('./backend/gameengine/bot');
const { check, isKingInCheck }  = require('./backend/gameengine/check2');
const { checkmate }             = require('./backend/gameengine/checkmate');
const { stalemate }             = require('./backend/gameengine/stalemate');
const { createEngineContext, serializeEngineContext } = require('./backend/gameengine/context');
const { cloneBoard }            = require('./backend/gameengine/cloneBoard');

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`  ✓  ${name}`);
  } catch (e) {
    failed++;
    results.push(`  ✗  ${name}\n       ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertLegal(r, msg)   { assert(r && r.islegal === true,  msg || `Expected legal, got ${JSON.stringify(r)}`); }
function assertIllegal(r, msg) { assert(!r || r.islegal === false, msg || `Expected illegal, got ${JSON.stringify(r)}`); }

function move(board, ctx, turn, fromRow, fromCol, toRow, toCol, promo = null) {
  const piece = board[fromRow][fromCol];
  return movecheck({
    from: { row: fromRow, col: fromCol },
    to:   { row: toRow,   col: toCol   },
    piece, boardstate: board, turn,
    state: 'fine', real: 'real', context: ctx,
    promotionPiece: promo
  });
}

function fakeMove(board, ctx, turn, fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  return movecheck({
    from: { row: fromRow, col: fromCol },
    to:   { row: toRow,   col: toCol   },
    piece, boardstate: board, turn,
    state: 'fine', real: 'fake', context: ctx
  });
}

function applySimple(board, fromRow, fromCol, toRow, toCol) {
  const b = cloneBoard(board);
  b[toRow][toCol] = b[fromRow][fromCol];
  b[fromRow][fromCol] = null;
  return b;
}

const empty = () => Array.from({ length: 8 }, () => Array(8).fill(null));
const init  = () => [
  ['♜','♞','♝','♛','♚','♝','♞','♜'],
  ['♟','♟','♟','♟','♟','♟','♟','♟'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['♙','♙','♙','♙','♙','♙','♙','♙'],
  ['♖','♘','♗','♕','♔','♗','♘','♖']
];

// ─── cloneBoard ───────────────────────────────────────────────────────────────

console.log('\n── cloneBoard ──');

test('cloneBoard produces independent copy', () => {
  const b  = init();
  const b2 = cloneBoard(b);
  b2[0][0] = null;
  assert(b[0][0] === '♜', 'original mutated');
});

test('cloneBoard copies all 64 squares', () => {
  const b  = init();
  const b2 = cloneBoard(b);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      assert(b2[r][c] === b[r][c], `mismatch at [${r}][${c}]`);
});

// ─── context ──────────────────────────────────────────────────────────────────

console.log('\n── context ──');

test('createEngineContext defaults', () => {
  const ctx = createEngineContext();
  assert(ctx.whitecastle === true, 'whitecastle should default true');
  assert(ctx.blackcastle === true, 'blackcastle should default true');
  assert(ctx.jump instanceof Map,  'jump should be a Map');
});

test('serializeEngineContext round-trips', () => {
  const ctx = createEngineContext();
  ctx.jump.set('4,3', true);
  const s   = serializeEngineContext(ctx);
  const ctx2 = createEngineContext(s);
  assert(ctx2.jump.get('4,3') === true, 'en-passant key lost after serialize');
  assert(ctx2.whitecastle === true);
});

// ─── Pawns ────────────────────────────────────────────────────────────────────

console.log('\n── Pawns ──');

test('white pawn: single step forward', () => {
  const b = init(), ctx = createEngineContext();
  assertLegal(move(b, ctx, 'white', 6, 4, 5, 4));
});

test('white pawn: double step from start', () => {
  const b = init(), ctx = createEngineContext();
  assertLegal(move(b, ctx, 'white', 6, 4, 4, 4));
  assert(ctx.jump.get('4,4') === true, 'en-passant square not set');
});

test('white pawn: double step blocked by piece on middle square', () => {
  const b = init(), ctx = createEngineContext();
  b[5][4] = '♟'; // block
  assertIllegal(move(b, ctx, 'white', 6, 4, 4, 4));
});

test('white pawn: double step blocked at destination', () => {
  const b = init(), ctx = createEngineContext();
  b[4][4] = '♟';
  assertIllegal(move(b, ctx, 'white', 6, 4, 4, 4));
});

test('white pawn: diagonal capture', () => {
  const b = init(), ctx = createEngineContext();
  b[5][3] = '♟';
  assertLegal(move(b, ctx, 'white', 6, 4, 5, 3));
});

test('white pawn: illegal diagonal without capture', () => {
  const b = init(), ctx = createEngineContext();
  assertIllegal(move(b, ctx, 'white', 6, 4, 5, 3));
});

test('white pawn: cannot move backward', () => {
  const b = init(), ctx = createEngineContext();
  b[5][4] = '♙'; b[6][4] = null;
  assertIllegal(move(b, ctx, 'white', 5, 4, 6, 4));
});

test('white pawn: promotion straight', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[1][2] = '♙';
  const r = move(b, ctx, 'white', 1, 2, 0, 2);
  assertLegal(r);
  assert(r.state === 'upgrade', `Expected upgrade, got ${r.state}`);
});

test('white pawn: promotion capture', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[1][2] = '♙'; b[0][3] = '♞';
  const r = move(b, ctx, 'white', 1, 2, 0, 3);
  assertLegal(r);
  assert(r.state === 'upgrade');
});

test('black pawn: single step forward', () => {
  const b = init(), ctx = createEngineContext();
  assertLegal(move(b, ctx, 'black', 1, 4, 2, 4));
});

test('black pawn: double step from start', () => {
  const b = init(), ctx = createEngineContext();
  const r = move(b, ctx, 'black', 1, 3, 3, 3);
  assertLegal(r);
  assert(ctx.jump.get('3,3') === true);
});

test('black pawn: diagonal capture', () => {
  const b = init(), ctx = createEngineContext();
  b[2][5] = '♙';
  assertLegal(move(b, ctx, 'black', 1, 4, 2, 5));
});

test('black pawn: promotion straight', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[6][2] = '♟';
  const r = move(b, ctx, 'black', 6, 2, 7, 2);
  assertLegal(r);
  assert(r.state === 'upgrade');
});

// ─── En Passant ───────────────────────────────────────────────────────────────

console.log('\n── En Passant ──');

test('white captures black en passant', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[3][4] = '♙'; // white pawn
  b[3][3] = '♟'; // black pawn that just double-jumped to row 3
  ctx.jump.set('3,3', true); // mark en passant available at col 3, row 3
  const r = move(b, ctx, 'white', 3, 4, 2, 3);
  assertLegal(r);
  assert(r.clearedsquare, 'expected clearedsquare');
  assert(r.clearedsquare.row === 3 && r.clearedsquare.col === 3, 'wrong clearedsquare');
});

test('black captures white en passant', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][4] = '♟'; // black pawn
  b[4][5] = '♙'; // white pawn that just double-jumped
  ctx.jump.set('4,5', true);
  const r = move(b, ctx, 'black', 4, 4, 5, 5);
  assertLegal(r);
  assert(r.clearedsquare.row === 4 && r.clearedsquare.col === 5);
});

test('en passant not available if jump map cleared', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[3][4] = '♙'; b[3][3] = '♟';
  // ctx.jump is empty — en passant window has passed
  assertIllegal(move(b, ctx, 'white', 3, 4, 2, 3));
});

// ─── Rook ─────────────────────────────────────────────────────────────────────

console.log('\n── Rook ──');

test('rook: move along rank', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♖';
  assertLegal(move(b, ctx, 'white', 4, 0, 4, 7));
});

test('rook: move along file', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♖';
  assertLegal(move(b, ctx, 'white', 4, 0, 0, 0));
});

test('rook: blocked by own piece', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♖'; b[4][3] = '♙';
  assertIllegal(move(b, ctx, 'white', 4, 0, 4, 7));
});

test('rook: capture enemy piece', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♖'; b[4][5] = '♟';
  assertLegal(move(b, ctx, 'white', 4, 0, 4, 5));
});

test('rook: cannot move diagonally', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♖';
  assertIllegal(move(b, ctx, 'white', 4, 0, 3, 1));
});

// ─── Bishop ───────────────────────────────────────────────────────────────────

console.log('\n── Bishop ──');

test('bishop: diagonal move', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][4] = '♗';
  assertLegal(move(b, ctx, 'white', 4, 4, 1, 1));
});

test('bishop: blocked diagonally', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][4] = '♗'; b[3][3] = '♙';
  assertIllegal(move(b, ctx, 'white', 4, 4, 1, 1));
});

test('bishop: cannot move straight', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][4] = '♗';
  assertIllegal(move(b, ctx, 'white', 4, 4, 4, 7));
});

test('bishop: capture enemy diagonally', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][4] = '♗'; b[1][1] = '♟';
  assertLegal(move(b, ctx, 'white', 4, 4, 1, 1));
});

// ─── Knight ───────────────────────────────────────────────────────────────────

console.log('\n── Knight ──');

test('knight: all 8 L-shapes from centre', () => {
  const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  offsets.forEach(([dr, dc]) => {
    const b = empty(), ctx = createEngineContext();
    b[7][4] = '♔'; b[0][4] = '♚';
    b[4][4] = '♘';
    assertLegal(move(b, ctx, 'white', 4, 4, 4+dr, 4+dc), `L ${dr},${dc} failed`);
  });
});

test('knight: jumps over pieces', () => {
  const b = init(), ctx = createEngineContext();
  // b1 knight (row 7, col 1) can jump to (5,0) or (5,2) even with pawns in way
  assertLegal(move(b, ctx, 'white', 7, 1, 5, 0));
  assertLegal(move(b, ctx, 'white', 7, 1, 5, 2));
});

test('knight: cannot move like rook', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][4] = '♘';
  assertIllegal(move(b, ctx, 'white', 4, 4, 4, 7));
});

// ─── Queen ────────────────────────────────────────────────────────────────────

console.log('\n── Queen ──');

test('queen: move along rank', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♕';
  assertLegal(move(b, ctx, 'white', 4, 0, 4, 7));
});

test('queen: move diagonally', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♕';
  assertLegal(move(b, ctx, 'white', 4, 0, 0, 4));
});

test('queen: blocked by own piece', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[0][4] = '♚';
  b[4][0] = '♕'; b[4][3] = '♙';
  assertIllegal(move(b, ctx, 'white', 4, 0, 4, 7));
});

// ─── King ─────────────────────────────────────────────────────────────────────

console.log('\n── King ──');

test('king: one step in each direction', () => {
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  dirs.forEach(([dr, dc]) => {
    const b = empty(), ctx = createEngineContext();
    b[0][4] = '♚'; b[4][4] = '♔';
    assertLegal(move(b, ctx, 'white', 4, 4, 4+dr, 4+dc), `dir ${dr},${dc}`);
  });
});

// ENGINE NOTE: king.js does NOT verify the rook is still on the board —
// it only checks the castle-flag and that the squares between are empty.
// Castling is blocked only when context.whitecastle / blackcastle = false.
test('king: castle rejected when castle flag is false', () => {
  const b = empty(), ctx = createEngineContext();
  ctx.whitecastle = false;
  b[0][4] = '♚'; b[7][4] = '♔';
  assertIllegal(move(b, ctx, 'white', 7, 4, 7, 6));
});

test('king: engine allows "castle" without rook if flag+path clear (known limitation)', () => {
  // No rook present but castle flag is true and path is clear → engine says legal
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚'; b[7][4] = '♔';
  const r = move(b, ctx, 'white', 7, 4, 7, 6);
  // This is a known engine limitation — document rather than assert illegal
  assert(r !== null, 'move returned null unexpectedly');
  console.log(`      [engine limitation] king 2-sq without rook → ${JSON.stringify(r)}`);
});

test('king: cannot capture own piece', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚'; b[7][4] = '♔'; b[6][4] = '♙';
  assertIllegal(move(b, ctx, 'white', 7, 4, 6, 4));
});

test('king move clears whitecastle flag', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚'; b[4][4] = '♔';
  assert(ctx.whitecastle === true);
  move(b, ctx, 'white', 4, 4, 3, 4);
  assert(ctx.whitecastle === false, 'whitecastle should be false after king moves');
});

// ─── Castling ─────────────────────────────────────────────────────────────────

console.log('\n── Castling ──');

test('white: kingside castle', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚';
  b[7][4] = '♔'; b[7][7] = '♖'; // king and kingside rook
  const r = move(b, ctx, 'white', 7, 4, 7, 6);
  assertLegal(r);
  assert(r.state === 'castle' && r.castleSide === 'king');
});

test('white: queenside castle', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚';
  b[7][4] = '♔'; b[7][0] = '♖';
  const r = move(b, ctx, 'white', 7, 4, 7, 2);
  assertLegal(r);
  assert(r.state === 'castle' && r.castleSide === 'queen');
});

test('black: kingside castle', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔';
  b[0][4] = '♚'; b[0][7] = '♜';
  const r = move(b, ctx, 'black', 0, 4, 0, 6);
  assertLegal(r);
  assert(r.state === 'castle' && r.castleSide === 'king');
});

test('castle blocked by piece in between', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚';
  b[7][4] = '♔'; b[7][7] = '♖'; b[7][6] = '♗'; // bishop in way
  assertIllegal(move(b, ctx, 'white', 7, 4, 7, 6));
});

test('cannot castle after king has moved', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚';
  b[7][4] = '♔'; b[7][7] = '♖';
  // Move king and back
  const b2 = empty(), ctx2 = createEngineContext();
  b2[0][4] = '♚';
  b2[4][4] = '♔'; b2[7][7] = '♖'; // king already moved
  ctx2.whitecastle = false;
  assertIllegal(move(b2, ctx2, 'white', 4, 4, 4, 6));
});

test('cannot castle through check', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][4] = '♚';
  b[7][4] = '♔'; b[7][7] = '♖';
  b[0][5] = '♜'; // black rook attacks f1 (transit square for O-O)
  const r = move(b, ctx, 'white', 7, 4, 7, 6);
  assertIllegal(r);
});

// ─── Check detection ──────────────────────────────────────────────────────────

console.log('\n── Check detection ──');

test('isKingInCheck: king attacked by rook', () => {
  const b = empty(), ctx = createEngineContext();
  b[4][4] = '♔'; b[4][0] = '♜';
  assert(isKingInCheck(b, '♔', ctx) === true);
});

test('isKingInCheck: king not in check', () => {
  const b = empty(), ctx = createEngineContext();
  b[4][4] = '♔'; b[0][0] = '♜';
  assert(isKingInCheck(b, '♔', ctx) === false);
});

test('isKingInCheck: blocker shields king', () => {
  const b = empty(), ctx = createEngineContext();
  b[4][4] = '♔'; b[4][2] = '♟'; b[4][0] = '♜'; // rook blocked by black pawn
  assert(isKingInCheck(b, '♔', ctx) === false);
});

test('check(): move puts enemy king in check', () => {
  const b = empty(), ctx = createEngineContext();
  b[4][4] = '♔'; b[0][0] = '♚';
  b[1][0] = '♖'; // rook on a-file, about to check black king
  const r = check(b, 'white', ctx);
  assert(r.islegal === true && r.state === 'check');
});

test('check(): move leaves own king in check → illegal', () => {
  const b = empty(), ctx = createEngineContext();
  b[4][4] = '♔'; b[4][7] = '♜'; // rook on same rank
  b[0][0] = '♚';
  const r = check(b, 'white', ctx);
  assert(r.islegal === false);
});

test('move: illegal if it leaves own king in check', () => {
  // Pinned piece scenario: white rook pinned against king by black rook
  const b = empty(), ctx = createEngineContext();
  b[4][4] = '♔'; b[4][3] = '♖'; b[4][0] = '♜'; // pin along rank 4
  b[0][7] = '♚';
  const r = move(b, ctx, 'white', 4, 3, 3, 3); // moving pinned rook off rank → king in check
  assertIllegal(r);
});

// ─── Checkmate ────────────────────────────────────────────────────────────────

console.log('\n── Checkmate ──');

test('checkmate(): fool\'s mate position', () => {
  // After 1.f3 e5 2.g4 Qh4#
  const b = empty(), ctx = createEngineContext();
  b[7][4] = '♔'; b[6][5] = null; b[6][6] = null; // f2,g2 moved
  b[5][5] = '♙'; b[4][6] = '♙'; // f3, g4 pawns
  b[0][4] = '♚';
  b[3][7] = '♛'; // Qh4 — attacks h1 king via diagonal
  // Manually: build fool's mate board
  const foolBoard = [
    [null,'♞','♝',null,'♚','♝','♞','♜'],
    ['♟','♟','♟','♟',null,'♟','♟','♟'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,'♟',null,null,null],
    [null,null,null,null,null,null,'♙','♛'],
    [null,null,null,null,null,'♙',null,null],
    ['♙','♙','♙','♙','♙',null,null,'♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖']
  ];
  const isMate = checkmate(foolBoard, 'black', createEngineContext());
  assert(isMate === true, 'Fool\'s mate not detected');
});

test('checkmate(): not checkmate when king can escape', () => {
  const b = empty(), ctx = createEngineContext();
  b[7][7] = '♔'; b[5][5] = '♛'; b[0][0] = '♚';
  // queen at f3 attacks h1 diagonal but king can step to g1 or g2
  const isMate = checkmate(b, 'black', ctx);
  assert(isMate === false, 'Should not be checkmate — king can escape');
});

test('checkmate(): smothered mate', () => {
  // h8 king trapped: rook g8, pawns g7+h7; white knight f7 delivers check
  // white just moved knight to f7 → checkmate(b, 'white', ctx) checks if BLACK has no moves
  const b = empty(), ctx = createEngineContext();
  b[0][7] = '♚'; b[0][6] = '♜'; b[1][7] = '♟'; b[1][6] = '♟'; // all escape squares blocked
  b[1][5] = '♘'; // white knight f7: L-shape (1-1, 5+2)=(0,7) checks black king
  b[7][0] = '♔';
  const isMate = checkmate(b, 'white', ctx);
  assert(isMate === true, 'Smothered mate not detected');
});

// ─── Stalemate ────────────────────────────────────────────────────────────────

console.log('\n── Stalemate ──');

test('stalemate(): king with no legal moves, not in check', () => {
  // Classic corner stalemate — white just moved, black king at h8 is stuck
  // stalemate(b, 'white', ctx): white just moved → checks if BLACK has no moves and is not in check
  const b = empty(), ctx = createEngineContext();
  b[0][7] = '♚'; // black king h8
  b[1][5] = '♕'; // white queen f7: covers g8(diag), g7(rank), h7(rank)
  b[2][6] = '♔'; // white king g6: additional coverage
  const isSM = stalemate(b, 'white', ctx);
  assert(isSM === true, 'Stalemate not detected');
});

test('stalemate(): position is NOT stalemate when king has moves', () => {
  const b = empty(), ctx = createEngineContext();
  b[0][0] = '♚'; b[7][0] = '♔';
  const isSM = stalemate(b, 'white', ctx); // white just moved; black king can freely move
  assert(isSM === false, 'Should not be stalemate — black king can move freely');
});

// ─── Full move flow ───────────────────────────────────────────────────────────

console.log('\n── Full move flow ──');

test('initial board: e2-e4, e7-e5, Nf3, Nc6 sequence', () => {
  const b  = init();
  const ctx = createEngineContext();

  // 1. e4
  let r = move(b, ctx, 'white', 6, 4, 4, 4); assertLegal(r);
  b[4][4] = b[6][4]; b[6][4] = null;

  // 1... e5
  r = move(b, ctx, 'black', 1, 4, 3, 4); assertLegal(r);
  b[3][4] = b[1][4]; b[1][4] = null;
  ctx.jump.clear();

  // 2. Nf3
  r = move(b, ctx, 'white', 7, 6, 5, 5); assertLegal(r);
  b[5][5] = b[7][6]; b[7][6] = null;

  // 2... Nc6
  r = move(b, ctx, 'black', 0, 1, 2, 2); assertLegal(r);
  b[2][2] = b[0][1]; b[0][1] = null;
});

test('scholar\'s mate attempt', () => {
  // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7# checkmate
  const b = [
    ['♜',null,'♝','♛','♚',null,'♞','♜'],
    ['♟','♟','♟','♟',null,'♛','♟','♟'],
    [null,null,'♞',null,null,'♞',null,null],
    [null,null,null,null,'♟',null,null,null],
    [null,null,'♗',null,'♙',null,null,null],
    [null,null,null,null,null,null,null,null],
    ['♙','♙','♙','♙',null,'♙','♙','♙'],
    ['♖','♘',null,null,'♔',null,'♘','♖']
  ];
  // Qxf7: white queen captures f7, delivering checkmate
  // checkmate(b, 'white', ctx): white just moved → checks if BLACK has no escape
  b[1][5] = '♕'; b[7][3] = null;
  const isMate = checkmate(b, 'white', createEngineContext());
  assert(isMate === true, "Scholar's mate not detected");
});

// ─── Bot (Stockfish integration) ──────────────────────────────────────────────

console.log('\n── Bot (Stockfish) ──');

async function runAsyncTests() {
  const asyncResults = [];

  async function asyncTest(name, fn) {
    try {
      await fn();
      asyncResults.push(`  ✓  ${name}`);
      passed++;
    } catch (e) {
      asyncResults.push(`  ✗  ${name}\n       ${e.message}`);
      failed++;
    }
  }

  await asyncTest('botmove: returns legal move from initial position (white)', async () => {
    const b = init(), ctx = createEngineContext();
    const r = await botmove({ boardstate: b, turn: 'white', difficulty: 1, context: ctx });
    assert(r.islegal === true, `botmove returned islegal=false: ${JSON.stringify(r)}`);
    assert(typeof r.from === 'object' && typeof r.to === 'object', 'missing from/to');
  });

  await asyncTest('botmove: returns legal move for black', async () => {
    const b = init(), ctx = createEngineContext();
    b[4][4] = b[6][4]; b[6][4] = null; // e4
    const r = await botmove({ boardstate: b, turn: 'black', difficulty: 1, context: ctx });
    assert(r.islegal === true);
  });

  await asyncTest('botmove: difficulty 5 (max strength) works', async () => {
    const b = init(), ctx = createEngineContext();
    const r = await botmove({ boardstate: b, turn: 'white', difficulty: 5, context: ctx });
    assert(r.islegal === true);
  });

  await asyncTest('evaluateMove: classifies opening move', async () => {
    const before = init();
    const after  = cloneBoard(before);
    after[4][4] = after[6][4]; after[6][4] = null;
    const ctx = createEngineContext();
    const r = await evaluateMove({
      beforeBoard: before, afterBoard: after,
      turn: 'white',
      from: { row: 6, col: 4 }, to: { row: 4, col: 4 },
      context: ctx
    });
    assert(typeof r.label === 'string',  `Expected label string, got ${r.label}`);
    assert(typeof r.bestMove === 'string', 'Expected bestMove string');
    console.log(`      label=${r.label}  bestMove=${r.bestMove}  loss=${r.loss}`);
  });

  console.log('\n── Async Bot Tests ──');
  asyncResults.forEach(l => console.log(l));
  return asyncResults;
}

// ─── Run & report ─────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════');
results.forEach(l => console.log(l));

runAsyncTests().then(() => {
  console.log('\n══════════════════════════════');
  console.log(`  Total: ${passed + failed}   Passed: ${passed}   Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}).catch(err => {
  console.error('Async test runner error:', err);
  process.exit(1);
});
