const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode:        String,   
  playerNames: { white: String, black: String },  
  myColor:     String,  
  result:      { reason: String, winner: String },
  moveHistory: [mongoose.Schema.Types.Mixed],
  capturedPieces: { white: [String], black: [String] },
  date:        { type: Date, default: Date.now },
  permanent:   { type: Boolean, default: false }
});

module.exports = mongoose.model('Match', matchSchema);
