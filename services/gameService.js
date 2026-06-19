const Game = require('../models/Game.js');
const {
  INITIAL_BOARD,
  PROMOTION_PIECES,
  WHITE_PIECES,
  BLACK_PIECES,
  cloneBoard,
  nextTurn,
  pieceColor,
  moveName,
} = require('../utils/chessConstants.js');
const { movecheck } = require('../backend/gameengine/movecheck.js');
const { botmove, evaluateMove } = require('../backend/gameengine/bot.js');
const {
  createEngineContext,
  serializeEngineContext,
} = require('../backend/gameengine/context.js');

function normalizeMode(mode) {
  return ['bot', 'human', 'bvb'].includes(mode) ? mode : 'human';
}

function sanitizeDifficulty(difficulty) {
  const parsed = Number(difficulty);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return 3;
}

function sanitizeSpeed(speed) {
  const parsed = Number(speed);
  if (Number.isInteger(parsed) && parsed >= 250 && parsed <= 10000) return parsed;
  return 1000;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: String(user._id || user.id),
    username: user.username,
    email: user.email,
  };
}

function getUserId(user) {
  return user ? (user._id || user.id) : null;
}

function getUsername(user) {
  return user ? user.username : 'Guest';
}

function makePlayer(user, kind = 'human') {
  return {
    user: kind === 'human' ? getUserId(user) : undefined,
    username: kind === 'human' ? getUsername(user) : 'Stockfish',
    kind,
  };
}

function getPlayerColor(game, user) {
  if (!user) return null;
  const userId = String(getUserId(user));
  if (game.players.white && String(game.players.white.user) === userId) return 'white';
  if (game.players.black && String(game.players.black.user) === userId) return 'black';
  return null;
}

function isBotTurn(game) {
  const player = game.players[game.turn];
  return player && player.kind === 'bot' && game.status === 'active';
}

function canMove(game, user) {
  if (game.mode === 'bvb') return false;
  const player = game.players[game.turn];
  if (!player || player.kind === 'bot') return false;
  if (!player.user) return true;
  return user && String(player.user) === String(getUserId(user));
}

function coordsValid(coords) {
  return coords &&
    Number.isInteger(coords.row) &&
    Number.isInteger(coords.col) &&
    coords.row >= 0 &&
    coords.row < 8 &&
    coords.col >= 0 &&
    coords.col < 8;
}

function normalizePromotionChoice(choice, turn) {
  if (!choice) return null;
  const key = String(choice).toLowerCase();
  return PROMOTION_PIECES[turn][key] || null;
}

function createInitialPlayers(mode, user, playerColor) {
  if (mode === 'bot') {
    const humanColor = playerColor === 'black' ? 'black' : 'white';
    const botColor = humanColor === 'white' ? 'black' : 'white';

    return {
      [humanColor]: makePlayer(user),
      [botColor]: makePlayer(null, 'bot'),
    };
  }

  if (mode === 'bvb') {
    return {
      white: makePlayer(null, 'bot'),
      black: makePlayer(null, 'bot'),
    };
  }

  return {
    white: makePlayer(user),
    black: null,
  };
}

function snapshot(game, user, extra = {}) {
  const playerColor = getPlayerColor(game, user);

  return {
    game: {
      id: String(game._id),
      mode: game.mode,
      status: game.status,
      boardstate: game.boardstate,
      turn: game.turn,
      state: game.state,
      winner: game.winner,
      players: game.players,
      captured: game.captured,
      settings: game.settings,
      moves: game.moves,
      pendingPromotion: Boolean(game.pendingPromotion),
      canMove: canMove(game, user),
      playerColor,
      isBotTurn: isBotTurn(game),
    },
    user: publicUser(user),
    ...extra,
  };
}

async function createGame({ user, mode, playerColor, difficulty, speed }) {
  const normalizedMode = normalizeMode(mode);
  const game = await Game.create({
    mode: normalizedMode,
    status: normalizedMode === 'human' ? 'waiting' : 'active',
    boardstate: cloneBoard(INITIAL_BOARD),
    turn: 'white',
    state: 'fine',
    players: createInitialPlayers(normalizedMode, user, playerColor),
    settings: {
      difficulty: sanitizeDifficulty(difficulty),
      speed: sanitizeSpeed(speed),
    },
    context: serializeEngineContext(createEngineContext()),
    createdBy: getUserId(user),
  });

  if (isBotTurn(game)) {
    await makeBotMove(game);
  }

  return game;
}

async function joinGame(game, user) {
  if (game.mode !== 'human') {
    const err = new Error('Only human multiplayer games can be joined.');
    err.status = 400;
    throw err;
  }

  if (game.players.black && game.players.black.user) {
    const err = new Error('This game already has two players.');
    err.status = 409;
    throw err;
  }

  if (getPlayerColor(game, user)) {
    return game;
  }

  game.players.black = makePlayer(user);
  game.status = 'active';
  await game.save();
  return game;
}

function applyResultToBoard(board, result, from, to, movingPiece, promotionPiece) {
  board[to.row][to.col] = promotionPiece || movingPiece;
  board[from.row][from.col] = null;

  if (result.clearedsquare) {
    board[result.clearedsquare.row][result.clearedsquare.col] = null;
  }

  if (result.state === 'castle' && result.rookTo) {
    const rookFromCol = result.castleSide === 'king' ? 7 : 0;
    const rookPiece = movingPiece === '♔' ? '♖' : '♜';
    board[result.rookTo.row][rookFromCol] = null;
    board[result.rookTo.row][result.rookTo.col] = rookPiece;
  }
}

function updateContextForAppliedMove(context, movingPiece, from, to) {
  if (movingPiece === '♔') context.whitecastle = false;
  if (movingPiece === '♚') context.blackcastle = false;
  if (movingPiece === '♖') context.whitecastle = false;
  if (movingPiece === '♜') context.blackcastle = false;

  const isDoubleJump =
    (movingPiece === '♙' && from.row === 6 && to.row === 4) ||
    (movingPiece === '♟' && from.row === 1 && to.row === 3);

  if (isDoubleJump) {
    context.jump.clear();
    context.jump.set(`${to.row},${to.col}`, true);
  } else {
    context.jump.clear();
  }
}

function updateGameConclusion(game, movingTurn, result) {
  if (result.state === 'checkmate') {
    game.status = 'checkmate';
    game.winner = movingTurn;
  } else if (result.state === 'stalemate') {
    game.status = 'stalemate';
    game.winner = 'draw';
  } else {
    game.status = 'active';
  }
}

async function rateMove(beforeBoard, afterBoard, movingTurn, from, to, promotionPiece, context) {
  try {
    return await evaluateMove({
      beforeBoard,
      afterBoard,
      turn: movingTurn,
      from,
      to,
      promotionPiece,
      context,
    });
  } catch (err) {
    return {
      label: 'Unrated',
      error: err.message,
    };
  }
}

async function persistAppliedMove(game, result, from, to, movingPiece, promotionPiece = null) {
  const beforeBoard = cloneBoard(game.boardstate);
  const context = createEngineContext(game.context);
  const board = cloneBoard(game.boardstate);
  const capturedPiece = result.eatenpeices || beforeBoard[to.row][to.col] || null;
  const movingTurn = game.turn;

  applyResultToBoard(board, result, from, to, movingPiece, promotionPiece);
  updateContextForAppliedMove(context, movingPiece, from, to);

  game.boardstate = board;
  game.state = result.state || 'fine';
  game.context = serializeEngineContext(context);

  if (result.eatencolor && result.eatenpeices) {
    game.captured[result.eatencolor].push(result.eatenpeices);
  }

  updateGameConclusion(game, movingTurn, result);

  if (game.status === 'active') {
    game.turn = nextTurn(game.turn);
  }

  const notation = moveName(movingPiece, from, to, capturedPiece);
  const evaluation = await rateMove(beforeBoard, board, movingTurn, from, to, promotionPiece, context);

  game.moves.push({
    number: game.moves.length + 1,
    turn: movingTurn,
    piece: movingPiece,
    from,
    to,
    notation,
    state: result.state || 'fine',
    label: evaluation.label || 'Unrated',
    bestMove: evaluation.bestMove,
    loss: evaluation.loss,
    capturedPiece,
    promotionPiece,
  });
}

function validateMoveRequest(game, user, from, to) {
  if (game.status !== 'active') {
    const err = new Error('This game is not active.');
    err.status = 409;
    throw err;
  }

  if (!canMove(game, user)) {
    const err = new Error('It is not your turn in this game.');
    err.status = 403;
    throw err;
  }

  if (!coordsValid(from) || !coordsValid(to)) {
    const err = new Error('Move coordinates are invalid.');
    err.status = 400;
    throw err;
  }

  const piece = game.boardstate[from.row][from.col];
  if (!piece) {
    const err = new Error('There is no piece on the selected square.');
    err.status = 400;
    throw err;
  }

  if (pieceColor(piece) !== game.turn) {
    const err = new Error('That piece does not belong to the current turn.');
    err.status = 400;
    throw err;
  }

  return piece;
}

async function moveGame(game, user, { from, to, promotion }) {
  const movingPiece = validateMoveRequest(game, user, from, to);
  const context = createEngineContext(game.context);
  const engineBoard = cloneBoard(game.boardstate);
  const result = movecheck({
    from,
    to,
    piece: movingPiece,
    turn: game.turn,
    boardstate: engineBoard,
    state: game.state,
    real: 'real',
    context,
  }) || { islegal: false, state: 'fine' };

  if (!result.islegal) {
    return {
      result: {
        ...result,
        islegal: false,
      },
      game,
    };
  }

  if (result.state === 'upgrade') {
    const promotionPiece = normalizePromotionChoice(promotion, game.turn);

    if (!promotionPiece) {
      game.pendingPromotion = {
        from,
        to,
        turn: game.turn,
        piece: movingPiece,
        capturedPiece: result.eatenpeices || game.boardstate[to.row][to.col] || null,
        result,
      };
      game.context = serializeEngineContext(context);
      await game.save();
      return {
        result: {
          ...result,
          promotionRequired: true,
        },
        game,
      };
    }

    result.promotionPiece = promotionPiece;
  }

  game.context = serializeEngineContext(context);
  await persistAppliedMove(game, result, from, to, movingPiece, result.promotionPiece || null);
  game.pendingPromotion = undefined;
  await game.save();

  if (isBotTurn(game)) {
    await makeBotMove(game);
  }

  return { result, game };
}

async function promoteGame(game, user, promotion) {
  if (!game.pendingPromotion) {
    const err = new Error('There is no pending promotion in this game.');
    err.status = 400;
    throw err;
  }

  if (!canMove(game, user)) {
    const err = new Error('You cannot promote for this side.');
    err.status = 403;
    throw err;
  }

  const promotionPiece = normalizePromotionChoice(promotion, game.pendingPromotion.turn);
  if (!promotionPiece) {
    const err = new Error('Promotion choice must be queen, rook, bishop, or knight.');
    err.status = 400;
    throw err;
  }

  const result = {
    ...game.pendingPromotion.result,
    promotionPiece,
  };

  await persistAppliedMove(
    game,
    result,
    game.pendingPromotion.from,
    game.pendingPromotion.to,
    game.pendingPromotion.piece,
    promotionPiece
  );
  game.pendingPromotion = undefined;
  await game.save();

  if (isBotTurn(game)) {
    await makeBotMove(game);
  }

  return { result, game };
}

async function makeBotMove(game) {
  if (!isBotTurn(game)) return null;

  const context = createEngineContext(game.context);
  const result = await botmove({
    boardstate: cloneBoard(game.boardstate),
    turn: game.turn,
    difficulty: game.settings.difficulty,
    context,
  });

  if (!result || !result.islegal) {
    game.status = 'abandoned';
    game.state = 'bot-error';
    await game.save();
    return result;
  }

  const movingPiece = game.boardstate[result.from.row][result.from.col];
  game.context = serializeEngineContext(context);
  await persistAppliedMove(game, result, result.from, result.to, movingPiece, result.promotionPiece || null);
  await game.save();

  return result;
}

async function surrenderGame(game, user) {
  if (game.status !== 'active' && game.status !== 'waiting') {
    return game;
  }

  const playerColor = getPlayerColor(game, user) || game.turn;
  game.status = 'surrendered';
  game.winner = nextTurn(playerColor);
  await game.save();
  return game;
}

async function listOpenGames() {
  return Game.find({ mode: 'human', status: 'waiting' })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

module.exports = {
  snapshot,
  createGame,
  joinGame,
  moveGame,
  promoteGame,
  makeBotMove,
  surrenderGame,
  listOpenGames,
};
