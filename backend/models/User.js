const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  displayName: { type: String, trim: true, maxlength: 30 },
  email:       { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  password:    { type: String, required: true },
  createdAt:   { type: Date, default: Date.now }
});

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, ROUNDS);
  }
});

userSchema.methods.verifyPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
