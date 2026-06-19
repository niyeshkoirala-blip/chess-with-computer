const express = require('express');
const Game = require('../models/Game.js');
const {
   snapshot,
   createGame,
   joinGame,
   moveGame,
   promoteGame,
   makeBotMove,
   surrenderGame,
   listOpenGames,
} = require('../services/gameService.js');

const router = express.Router();

async function findGame(req, res, next) {
   try {
      const game = await Game.findById(req.params.id);
      if (!game) {
         return res.status(404).json({ error: 'Game not found.' });
      }

      req.game = game;
      next();
   } catch (err) {
      next(err);
   }
}

router.get('/api/games/open', async (req, res, next) => {
   try {
      res.json({ games: await listOpenGames() });
   } catch (err) {
      next(err);
   }
});

router.post('/api/games', async (req, res, next) => {
   try {
      const game = await createGame({
         user: req.session.user,
         mode: req.body.mode,
         playerColor: req.body.playerColor,
         difficulty: req.body.difficulty,
         speed: req.body.speed,
      });

      req.session.lastGameId = String(game._id);
      res.status(201).json(snapshot(game, req.session.user));
   } catch (err) {
      next(err);
   }
});

router.get('/api/games/:id', findGame, (req, res) => {
   res.json(snapshot(req.game, req.session.user));
});

router.post('/api/games/:id/join', findGame, async (req, res, next) => {
   try {
      const game = await joinGame(req.game, req.session.user);
      req.session.lastGameId = String(game._id);
      res.json(snapshot(game, req.session.user));
   } catch (err) {
      next(err);
   }
});

router.post('/api/games/:id/move', findGame, async (req, res, next) => {
   try {
      const { result, game } = await moveGame(req.game, req.session.user, {
         from: req.body.from,
         to: req.body.to,
         promotion: req.body.promotion,
      });

      res.json(snapshot(game, req.session.user, { result }));
   } catch (err) {
      next(err);
   }
});

router.post('/api/games/:id/promote', findGame, async (req, res, next) => {
   try {
      const { result, game } = await promoteGame(req.game, req.session.user, req.body.promotion);
      res.json(snapshot(game, req.session.user, { result }));
   } catch (err) {
      next(err);
   }
});

router.post('/api/games/:id/bot', findGame, async (req, res, next) => {
   try {
      const result = await makeBotMove(req.game);
      res.json(snapshot(req.game, req.session.user, { result }));
   } catch (err) {
      next(err);
   }
});

router.post('/api/games/:id/surrender', findGame, async (req, res, next) => {
   try {
      const game = await surrenderGame(req.game, req.session.user);
      res.json(snapshot(game, req.session.user));
   } catch (err) {
      next(err);
   }
});

module.exports = router;
