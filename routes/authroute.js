const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User.js');

const router = express.Router();

function publicUser(user) {
   if (!user) return null;
   return {
      id: String(user._id),
      username: user.username,
      email: user.email,
   };
}

router.get('/api/auth/me', (req, res) => {
   res.json({ user: publicUser(req.session.user) });
});

router.post('/api/auth/signup', async (req, res, next) => {
   try {
      const username = String(req.body.username || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');

      if (username.length < 3 || !email || password.length < 6) {
         return res.status(400).json({
            error: 'Username must be 3+ characters, email is required, and password must be 6+ characters.',
         });
      }

      const exists = await User.findOne({
         $or: [{ username }, { email }],
      });

      if (exists) {
         return res.status(409).json({ error: 'Username or email is already taken.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ username, email, passwordHash });
      req.session.user = publicUser(user);

      res.status(201).json({ user: req.session.user });
   } catch (err) {
      next(err);
   }
});

router.post('/api/auth/login', async (req, res, next) => {
   try {
      const rawIdentity = String(req.body.identity || '').trim();
      const identity = rawIdentity.toLowerCase();
      const password = String(req.body.password || '');

      const user = await User.findOne({
         $or: [{ email: identity }, { username: rawIdentity }],
      });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
         return res.status(401).json({ error: 'Invalid login details.' });
      }

      req.session.user = publicUser(user);
      res.json({ user: req.session.user });
   } catch (err) {
      next(err);
   }
});

router.post('/api/auth/logout', (req, res, next) => {
   req.session.destroy(err => {
      if (err) return next(err);
      res.clearCookie('regicide.sid');
      res.json({ ok: true });
   });
});

module.exports = router;
