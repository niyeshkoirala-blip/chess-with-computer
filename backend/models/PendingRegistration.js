const mongoose = require('mongoose');

// Holds in-progress registrations while user completes OTP verification.
// Using MongoDB instead of in-memory so Railway restarts don't wipe pending entries.
const pendingSchema = new mongoose.Schema({
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  username:    { type: String, required: true },
  displayName: { type: String, default: '' },
  password:    { type: String, required: true }, // plain text — User model hashes it on save
  otp:         { type: String, required: true },
  expiresAt:   { type: Date, required: true },
  attempts:    { type: Number, default: 0 },
  sentAt:      { type: Date, default: Date.now },
});

// MongoDB TTL index auto-deletes documents once expiresAt passes
pendingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingRegistration', pendingSchema);
