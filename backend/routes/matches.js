const express = require('express');
const router  = express.Router();
const Match   = require('../models/Match');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}
  
// List all matches for the logged-in user (omit heavy fields)
router.get('/', requireAuth, async (req, res) => {
  try {
    const matches = await Match.find({ userId: req.session.userId })
      .sort({ date: -1 })
      .select('-moveHistory -capturedPieces');
    res.json(matches);
  } catch {
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

// Full match data for replay
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const match = await Match.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch {
    res.status(500).json({ error: 'Failed to load match' });
  }
});

// Pin a match so it is never auto-deleted
router.patch('/:id/pin', requireAuth, async (req, res) => {
  try {
    const match = await Match.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { permanent: true },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to pin match' });
  }
});

// Delete a match
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const match = await Match.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

module.exports = router;
