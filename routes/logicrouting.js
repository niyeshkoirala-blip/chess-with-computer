const express = require('express');
const { movecheck } = require('../backend/gameengine/movecheck.js');
const { botmove, evaluateMove } = require('../backend/gameengine/bot.js');

const router = express.Router();

router.post('/move', (req, res, next) => {
   const moveData = req.body;
   const movecheckResult = movecheck(moveData);
   console.log(movecheckResult.islegal);

   if (!movecheckResult || !movecheckResult.islegal) {
      return res.json({ islegal: false, state: 'movecheckResult.state' });
   }

   return res.send(movecheckResult);
});

router.post('/bot', async (req, res, next) => {
   const moveData = req.body;
   const bot = await botmove(moveData);

   if (!bot || !bot.islegal) {
      return res.json({ islegal: false, state: 'bot.state' });
   }

   console.log(bot.state);
   return res.send(bot);
});

router.post('/evaluate', async (req, res, next) => {
   try {
      const moveData = req.body;
      const evaluation = await evaluateMove(moveData);

      res.json(evaluation);
   } catch (err) {
      res.json({
         label: 'Unrated',
         error: err.message
      });
   }
});

module.exports = router;