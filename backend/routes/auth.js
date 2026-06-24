const express    = require('express');
const nodemailer = require('nodemailer');
const router     = express.Router();
const User       = require('../models/User');

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS  = (parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 10) * 60 * 1000;

// ── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(to, otp) {
  const expiresMins = parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 10;
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Your Chess verification code',
    text:    `Your one-time verification code is: ${otp}\n\nIt expires in ${expiresMins} minutes. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#F6F0E6;border-radius:10px;border:0.5px solid #D4C5A9">
        <h2 style="font-family:Georgia,serif;color:#1A1714;margin:0 0 16px">Verify your account</h2>
        <p style="color:#6B5E4E;margin:0 0 24px;line-height:1.6">Enter this code to complete your registration. It expires in <strong>${expiresMins} minutes</strong>.</p>
        <div style="text-align:center;background:#fff;border-radius:8px;padding:24px;border:0.5px solid #D4C5A9;letter-spacing:14px;font-size:2.2rem;font-weight:700;font-family:monospace;color:#312E2B">${otp}</div>
        <p style="color:#8B7355;font-size:0.78rem;margin:24px 0 0;line-height:1.6">If you did not request this, you can safely ignore this email.</p>
      </div>`,
  });
}

// ── Pending registrations store ───────────────────────────────────────────────
// Keyed by email. Entries: { username, displayName, password, otp, expiresAt, attempts }
const pending = new Map();

// Clean up expired entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(key);
  }
}, 15 * 60 * 1000);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}${'*'.repeat(Math.max(0, local.length - 3))}@${domain}`;
}

// ── Shared field validation ───────────────────────────────────────────────────
function validateRegistrationFields({ username, displayName, email, password }) {
  if (!username || !password || !email) return 'Username, email, and password are required.';
  if (username.length < 3 || username.length > 20) return 'Username must be 3–20 characters.';
  if (!USERNAME_RE.test(username)) return 'Username may only contain letters, numbers, and underscores.';
  if (!EMAIL_RE.test(email)) return 'Invalid email address.';
  if (displayName && displayName.trim().length > 30) return 'Display name must be 30 characters or fewer.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

// ── Step 1: validate fields, send OTP ────────────────────────────────────────
router.post('/register/request', async (req, res) => {
  const { username, displayName, email, password } = req.body;

  const validationError = validateRegistrationFields({ username, displayName, email, password });
  if (validationError) return res.status(400).json({ error: validationError });

  const normalEmail = email.toLowerCase();

  try {
    if (await User.findOne({ username })) {
      return res.status(409).json({ error: 'Username already taken.' });
    }
    if (await User.findOne({ email: normalEmail })) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
  } catch (err) {
    console.error('Register/request DB error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }

  // Rate-limit: if a pending entry exists and was just sent, don't spam
  const existing = pending.get(normalEmail);
  if (existing && existing.expiresAt - OTP_TTL_MS + 60_000 > Date.now()) {
    return res.status(429).json({ error: 'A code was already sent. Please wait a moment before requesting another.' });
  }

  const otp = generateOtp();
  pending.set(normalEmail, {
    username,
    displayName: displayName?.trim() || username,
    password,          // plain — held in memory for max OTP_TTL_MS
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  try {
    await sendOtpEmail(normalEmail, otp);
  } catch (err) {
    pending.delete(normalEmail);
    console.error('OTP email error:', err.message);
    return res.status(500).json({ error: 'Failed to send verification email. Check your email address and try again.' });
  }

  res.json({ ok: true, maskedEmail: maskEmail(normalEmail) });
});

// ── Step 2: verify OTP and create account ────────────────────────────────────
router.post('/register/verify', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and code are required.' });

  const normalEmail = email.toLowerCase();
  const entry = pending.get(normalEmail);

  if (!entry) {
    return res.status(400).json({ error: 'No pending registration for this email. Please start over.' });
  }
  if (Date.now() > entry.expiresAt) {
    pending.delete(normalEmail);
    return res.status(400).json({ error: 'Code expired. Please request a new one.' });
  }

  // Brute-force guard: max 5 attempts per OTP
  entry.attempts += 1;
  if (entry.attempts > 5) {
    pending.delete(normalEmail);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please start registration again.' });
  }

  if (otp.trim() !== entry.otp) {
    const left = 5 - entry.attempts;
    return res.status(400).json({ error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` });
  }

  // OTP is valid — create the user
  pending.delete(normalEmail);

  try {
    if (await User.findOne({ username: entry.username })) {
      return res.status(409).json({ error: 'Username was taken while you were verifying. Please choose another.' });
    }

    const user = new User({
      username:    entry.username,
      displayName: entry.displayName,
      email:       normalEmail,
      password:    entry.password,
    });
    await user.save();

    req.session.userId      = user._id;
    req.session.username    = user.username;
    req.session.displayName = user.displayName;
    res.json({ ok: true, username: user.username, displayName: user.displayName });
  } catch (err) {
    console.error('Register/verify create error:', err.message);
    res.status(500).json({ error: 'Account creation failed. Please try again.' });
  }
});

// ── Step 1b: resend OTP ───────────────────────────────────────────────────────
router.post('/register/resend', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const normalEmail = email.toLowerCase();
  const entry = pending.get(normalEmail);

  if (!entry) {
    return res.status(400).json({ error: 'No pending registration. Please fill the form again.' });
  }

  const otp = generateOtp();
  entry.otp       = otp;
  entry.expiresAt = Date.now() + OTP_TTL_MS;
  entry.attempts  = 0;

  try {
    await sendOtpEmail(normalEmail, otp);
    res.json({ ok: true });
  } catch (err) {
    console.error('OTP resend error:', err.message);
    res.status(500).json({ error: 'Failed to resend email. Please try again.' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  try {
    const user = await User.findOne({ username });
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.userId      = user._id;
    req.session.username    = user.username;
    req.session.displayName = user.displayName || user.username;
    res.json({ ok: true, username: user.username, displayName: user.displayName || user.username });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── Session check ─────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username, displayName: req.session.displayName || req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;
