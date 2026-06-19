const mongoose = require('mongoose');
const { INITIAL_BOARD } = require('../utils/chessConstants.js');

const playerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, default: 'Guest' },
    kind: { type: String, enum: ['human', 'bot'], default: 'human' },
  },
  { _id: false }
);

const moveSchema = new mongoose.Schema(
  {
    number: Number,
    turn: String,
    piece: String,
    from: Object,
    to: Object,
    notation: String,
    state: String,
    label: String,
    bestMove: String,
    loss: Number,
    capturedPiece: String,
    promotionPiece: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['bot', 'human', 'bvb'],
      default: 'human',
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'checkmate', 'stalemate', 'surrendered', 'abandoned'],
      default: 'active',
    },
    boardstate: {
      type: [[mongoose.Schema.Types.Mixed]],
      default: () => INITIAL_BOARD.map(row => [...row]),
    },
    turn: {
      type: String,
      enum: ['white', 'black'],
      default: 'white',
    },
    state: {
      type: String,
      default: 'fine',
    },
    winner: {
      type: String,
      enum: ['white', 'black', 'draw', null],
      default: null,
    },
    players: {
      white: { type: playerSchema, default: null },
      black: { type: playerSchema, default: null },
    },
    captured: {
      white: { type: [String], default: [] },
      black: { type: [String], default: [] },
    },
    context: {
      whitecastle: { type: Boolean, default: true },
      blackcastle: { type: Boolean, default: true },
      jump: { type: [[mongoose.Schema.Types.Mixed]], default: [] },
    },
    settings: {
      difficulty: { type: Number, default: 3 },
      speed: { type: Number, default: 1000 },
    },
    moves: { type: [moveSchema], default: [] },
    pendingPromotion: {
      from: Object,
      to: Object,
      turn: String,
      piece: String,
      capturedPiece: String,
      result: Object,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);
