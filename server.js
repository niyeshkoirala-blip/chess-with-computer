require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const cors = require('cors');
const path = require('path');  

const { connectDatabase } = require('./backend/config/db');
const authRoutes  = require('./backend/routes/auth');
const matchRoutes = require('./backend/routes/matches');
const Match       = require('./backend/models/Match');
const { movecheck } = require('./backend/gameengine/movecheck');
const { botmove, evaluateMove } = require('./backend/gameengine/bot');
const { createEngineContext, serializeEngineContext } = require('./backend/gameengine/context');
const { cloneBoard } = require('./backend/gameengine/cloneBoard');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'chess-dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600  // refresh session TTL at most once per day
  }),
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days — stays logged in like normal sites
  }
});

app.use(sessionMiddleware);
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

// ─── Game state ────────────────────────────────────────────────────────────────

const games = new Map();       // gameId -> game
const socketToGame = new Map(); // socketId -> gameId

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

const WHITE_PIECES = new Set(['♔','♕','♖','♗','♘','♙']);

function genId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function cloneContext(ctx) {
  return {
    whitecastle: ctx.whitecastle,
    blackcastle: ctx.blackcastle,
    jump: new Map(ctx.jump)
  };
}

function createGame(options) {
  const id = genId();
  return {
    id,
    mode: options.mode,           // 'hvh' | 'hvh-local' | 'hvb' | 'bvb'
    boardstate: INITIAL_BOARD.map(r => [...r]),
    turn: 'white',
    context: createEngineContext(),
    players: { white: null, black: null },
    playerTokens: { white: null, black: null }, // survive page navigation
    playerNames: { white: 'Player 1', black: 'Player 2' },
    status: 'waiting',            // waiting | playing | ended
    difficulty: options.difficulty || 3,
    botColor: options.botColor || 'black',
    moveHistory: [],
    capturedPieces: { white: [], black: [] },
    drawOffer: null,
    bvbPaused: false,
    bvbDelay: options.bvbDelay || 1000,
    createdAt: Date.now()
  };
}

function publicGameState(game) {
  return {
    id: game.id,
    mode: game.mode,
    boardstate: game.boardstate,
    turn: game.turn,
    context: serializeEngineContext(game.context),
    players: game.players,
    playerNames: game.playerNames,
    status: game.status,
    difficulty: game.difficulty,
    botColor: game.botColor,
    moveHistory: game.moveHistory,
    capturedPieces: game.capturedPieces,
    drawOffer: game.drawOffer,
    bvbPaused: game.bvbPaused
  };
}

// Returns { islegal, result, boardstate } — mutates game on success
function applyMove(game, from, to, promotionPiece = null) {
  const workBoard = cloneBoard(game.boardstate);
  const piece = workBoard[from.row][from.col];
  if (!piece) return { islegal: false };

  const savedCtx = cloneContext(game.context);

  const result = movecheck({
    from, to, piece,
    boardstate: workBoard,
    turn: game.turn,
    state: 'fine',
    real: 'real',
    context: game.context,
    promotionPiece
  });

  if (!result || !result.islegal) {
    // Restore any context mutations from failed move attempt
    game.context.whitecastle = savedCtx.whitecastle;
    game.context.blackcastle = savedCtx.blackcastle;
    game.context.jump = savedCtx.jump;
    return { islegal: false };
  }

  // En passant removes captured pawn from workBoard during movecheck (side-effect in enpassant.js)
  const enPassantCaptured = result.clearedsquare
    ? game.boardstate[result.clearedsquare.row][result.clearedsquare.col]
    : null;

  const regularCapture = game.boardstate[to.row][to.col];

  // Apply main piece movement
  workBoard[to.row][to.col] = promotionPiece || workBoard[from.row][from.col];
  workBoard[from.row][from.col] = null;

  // Move the rook for castling
  if (result.state === 'castle') {
    const rookFromCol = result.castleSide === 'king' ? 7 : 0;
    workBoard[from.row][result.rookTo.col] = workBoard[from.row][rookFromCol];
    workBoard[from.row][rookFromCol] = null;
  }

  // Track captures
  [regularCapture, enPassantCaptured].forEach(p => {
    if (p) game.capturedPieces[WHITE_PIECES.has(p) ? 'white' : 'black'].push(p);
  });

  const moveRecord = {
    from, to, piece,
    capturedPiece: regularCapture || enPassantCaptured || null,
    promotionPiece: promotionPiece || null,
    state: result.state,
    castleSide: result.castleSide || null,
    clearedsquare: result.clearedsquare || null,
    moveNumber: game.moveHistory.length + 1
  };

  game.boardstate = workBoard;
  game.turn = game.turn === 'white' ? 'black' : 'white';
  game.moveHistory.push(moveRecord);

  return { islegal: true, result, moveRecord };
}

// ─── Bot logic ─────────────────────────────────────────────────────────────────

async function runBotTurn(game) {
  if (game.status !== 'playing') return;
  if (game.mode === 'bvb' && game.bvbPaused) return;

  io.to(game.id).emit('bot-thinking', { color: game.turn });

  try {
    const botResult = await botmove({
      boardstate: game.boardstate,
      turn: game.turn,
      difficulty: game.difficulty,
      context: game.context
    });

    if (!botResult.islegal) {
      endGame(game, 'error', null);
      return;
    }

    const applied = applyMove(game, botResult.from, botResult.to, botResult.promotionPiece || null);
    if (!applied.islegal) {
      endGame(game, 'error', null);
      return;
    }

    broadcastMove(game, applied.moveRecord);

    const state = applied.result.state;
    if (state === 'checkmate') {
      endGame(game, 'checkmate', game.turn === 'white' ? 'black' : 'white');
    } else if (state === 'stalemate') {
      endGame(game, 'stalemate', null);
    } else if (game.mode === 'bvb') {
      setTimeout(() => runBotTurn(game), game.bvbDelay);
    }
  } catch (err) {
    console.error('Bot error:', err.message);
    io.to(game.id).emit('bot-error', { message: err.message });
  }
}

function broadcastMove(game, moveRecord) {
  io.to(game.id).emit('move-made', {
    ...moveRecord,
    boardstate: game.boardstate,
    turn: game.turn,
    capturedPieces: game.capturedPieces,
    context: serializeEngineContext(game.context)
  });
}

// Auto-save the finished game for every logged-in player in the game
async function autoSaveMatch(game, reason, winner) {
  const seenUsers = new Set();

  for (const [color, socketId] of [['white', game.players.white], ['black', game.players.black]]) {
    if (!socketId) continue;
    const sock = io.sockets.sockets.get(socketId);
    if (!sock) continue;
    const session = sock.request.session;
    if (!session?.userId) continue;

    const uid = session.userId.toString();
    if (seenUsers.has(uid)) continue; // handles hvh-local where both sides share a socket
    seenUsers.add(uid);

    const match = new Match({
      userId: session.userId,
      mode: game.mode,
      playerNames: game.playerNames,
      myColor: color,
      result: { reason, winner },
      moveHistory: game.moveHistory,
      capturedPieces: {
        white: [...game.capturedPieces.white],
        black: [...game.capturedPieces.black]
      },
    });
    await match.save();

    // Rotate auto-saves: keep only the 3 most recent non-permanent matches
    const autoSaved = await Match.find({ userId: session.userId, permanent: false })
      .sort({ date: -1 }).select('_id');
    if (autoSaved.length > 3) {
      await Match.deleteMany({ _id: { $in: autoSaved.slice(3).map(m => m._id) } });
    }

    sock.emit('match-auto-saved', { matchId: match._id.toString() });
  }
}

function endGame(game, reason, winner) {
  game.status = 'ended';
  io.to(game.id).emit('game-over', { reason, winner });
  autoSaveMatch(game, reason, winner).catch(err => console.error('Auto-save failed:', err.message));
}

// ─── Socket handlers ───────────────────────────────────────────────────────────

io.on('connection', (socket) => {

  socket.on('get-lobby', () => {
    const open = [];
    for (const [, g] of games) {
      if (g.mode === 'hvh' && g.status === 'waiting') {
        open.push({ id: g.id, name: g.playerNames.white, createdAt: g.createdAt });
      }
    }
    socket.emit('lobby-state', open);
  });

  socket.on('create-game', (opts) => {
    const game = createGame(opts);
    const color = opts.preferredColor === 'black' ? 'black' : 'white';

    if (game.mode === 'hvb' || game.mode === 'hvh' || game.mode === 'hvh-local') {
      game.players[color] = socket.id;
      if (game.mode === 'hvh-local') {
        game.players[color === 'white' ? 'black' : 'white'] = socket.id;
      }
      game.playerNames[color] = opts.playerName || 'You';
    }

    // Issue a persistent token so the player can re-register after page navigation
    const playerToken = genId() + genId();
    game.playerTokens[color] = playerToken;

    games.set(game.id, game);
    socketToGame.set(socket.id, game.id);
    socket.join(game.id);

    socket.emit('game-created', { gameId: game.id, color, playerToken, gameState: publicGameState(game) });

    if (game.mode === 'hvb') {
      game.status = 'playing';
      socket.emit('game-started', publicGameState(game));
      if (game.botColor === 'white') {
        setTimeout(() => runBotTurn(game), 400);
      }
    } else if (game.mode === 'hvh-local') {
      game.status = 'playing';
      socket.emit('game-started', publicGameState(game));
    } else if (game.mode === 'bvb') {
      game.status = 'playing';
      socket.emit('game-started', publicGameState(game));
      setTimeout(() => runBotTurn(game), 800);
    }
  });

  socket.on('join-game', ({ code, playerName }) => {
    const game = games.get(code.toUpperCase());
    if (!game) return socket.emit('join-error', 'Game not found');
    if (game.mode !== 'hvh') return socket.emit('join-error', 'Cannot join this game type');
    if (game.status !== 'waiting') return socket.emit('join-error', 'Game already in progress');

    const takenColor = game.players.white ? 'white' : 'black';
    const joinColor = takenColor === 'white' ? 'black' : 'white';

    game.players[joinColor] = socket.id;
    game.playerNames[joinColor] = playerName || 'Opponent';
    game.status = 'playing';
    socketToGame.set(socket.id, game.id);
    socket.join(game.id);

    const joinToken = genId() + genId();
    game.playerTokens[joinColor] = joinToken;

    socket.emit('game-joined', { gameId: game.id, color: joinColor, playerToken: joinToken, gameState: publicGameState(game) });
    io.to(game.id).emit('game-started', publicGameState(game));
  });

  socket.on('make-move', ({ gameId, from, to, promotionPiece }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;

    // For online hvh, verify it's the sender's turn
    if (game.mode === 'hvh') {
      const senderColor = game.players.white === socket.id ? 'white'
        : game.players.black === socket.id ? 'black' : null;
      if (senderColor !== game.turn) return socket.emit('move-rejected', { reason: 'Not your turn' });
    }

    // Snapshot state before move for evaluation
    const beforeBoard = cloneBoard(game.boardstate);
    const beforeTurn = game.turn;
    const beforeContext = cloneContext(game.context);

    const applied = applyMove(game, from, to, promotionPiece || null);
    if (!applied.islegal) return socket.emit('move-rejected', { reason: 'Illegal move' });

    broadcastMove(game, applied.moveRecord);

    const state = applied.result.state;
    if (state === 'checkmate') {
      endGame(game, 'checkmate', game.turn === 'white' ? 'black' : 'white');
    } else if (state === 'stalemate') {
      endGame(game, 'stalemate', null);
    } else if (game.mode === 'hvb' && game.turn === game.botColor) {
      setTimeout(() => runBotTurn(game), 400);
    }

    // Evaluate the move asynchronously and send result back to the player who moved
    const afterBoard = cloneBoard(game.boardstate);
    const moveNumber = applied.moveRecord.moveNumber;
    evaluateMove({
      beforeBoard,
      afterBoard,
      turn: beforeTurn,
      from,
      to,
      promotionPiece: promotionPiece || null,
      context: beforeContext
    }).then(evalResult => {
      socket.emit('move-eval', { ...evalResult, moveNumber });
    }).catch(err => {
      console.error('Move evaluation error:', err.message);
    });
  });

  socket.on('resign', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;
    const color = game.players.white === socket.id ? 'white' : 'black';
    endGame(game, 'resign', color === 'white' ? 'black' : 'white');
  });

  socket.on('offer-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.mode !== 'hvh' || game.status !== 'playing') return;
    const offerer = game.players.white === socket.id ? 'white' : 'black';
    game.drawOffer = offerer;
    const opponentId = game.players[offerer === 'white' ? 'black' : 'white'];
    if (opponentId) io.to(opponentId).emit('draw-offered', { by: offerer });
  });

  socket.on('accept-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || !game.drawOffer) return;
    game.drawOffer = null;
    endGame(game, 'draw', null);
  });

  socket.on('decline-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;
    const offerer = game.drawOffer;
    game.drawOffer = null;
    if (offerer) {
      const offererId = game.players[offerer];
      if (offererId) io.to(offererId).emit('draw-declined');
    }
  });

  socket.on('bvb-toggle-pause', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.mode !== 'bvb') return;
    game.bvbPaused = !game.bvbPaused;
    io.to(game.id).emit('bvb-pause-state', { paused: game.bvbPaused });
    if (!game.bvbPaused && game.status === 'playing') {
      setTimeout(() => runBotTurn(game), game.bvbDelay);
    }
  });

  socket.on('get-game-state', ({ gameId, playerToken }) => {
    const game = games.get(gameId);
    if (!game) return socket.emit('full-game-state', null);
    socket.join(game.id);

    // Re-register socket after page navigation (new socket.id, same player token)
    if (playerToken) {
      const claimedColor = game.playerTokens.white === playerToken ? 'white'
        : game.playerTokens.black === playerToken ? 'black' : null;
      if (claimedColor) {
        const oldId = game.players[claimedColor];
        if (oldId && oldId !== socket.id) socketToGame.delete(oldId);
        game.players[claimedColor] = socket.id;
        socketToGame.set(socket.id, game.id);
      }
    }

    socket.emit('full-game-state', publicGameState(game));
  });

  socket.on('disconnect', () => {
    const gameId = socketToGame.get(socket.id);
    socketToGame.delete(socket.id);
    if (!gameId) return;

    const game = games.get(gameId);
    if (!game || game.status !== 'playing' || game.mode !== 'hvh') return;

    const dcColor = game.players.white === socket.id ? 'white'
      : game.players.black === socket.id ? 'black' : null;
    if (!dcColor) return;

    io.to(game.id).emit('player-disconnected', { color: dcColor });

    // Give 30s to reconnect before forfeiting
    setTimeout(() => {
      const g = games.get(gameId);
      if (g && g.status === 'playing' && g.players[dcColor] === socket.id) {
        endGame(g, 'disconnect', dcColor === 'white' ? 'black' : 'white');
      }
    }, 30000);
  });
});

// Clean up stale games every hour
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, game] of games) {
    if (game.createdAt < cutoff) games.delete(id);
  }
}, 60 * 60 * 1000);

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

connectDatabase()
  .then(() => httpServer.listen(PORT, () => console.log(`Chess server → http://localhost:${PORT}`)))
  .catch(err => { console.error('DB connect failed:', err.message); process.exit(1); });
