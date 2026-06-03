const { movecheck } = require('./backend/gameengine/movecheck.js');
const { botmove, evaluateMove }= require('./backend/gameengine/bot.js');

const express = require('express');
const path= require('path');

 const app = express();
 const frontEndFolder = path.join(__dirname, 'front end');
 app.use(express.json());
 app.use(express.urlencoded());

 app.get('/chess.html',(req, res , next) => {
    global.blackcastle = true;
    global.whitecastle = true;
    res.sendFile(path.join(frontEndFolder, 'chess.html'));
 });
 app.get('index.html',(req, res , next) => {
    res.sendFile(path.join(frontEndFolder, 'index.html'));
 });
 app.post('/move',(req,res,next) => {
       const moveData = req.body;
       const movecheckResult = movecheck(moveData);
        console.log(movecheckResult.islegal);
        
         if (!movecheckResult || !movecheckResult.islegal)  return res.json({ islegal: false, state: 'movecheckResult.state' });
        return res.send( movecheckResult );
});
app.post('/bot',async(req,res,next) =>{
    const moveData = req.body;
    const bot =  await botmove(moveData);
       if (!bot || !bot.islegal)  return res.json({ islegal: false, state: 'bot.state' });
       console.log(bot.state);
       
        return res.send(bot);

});
app.post('/evaluate',async(req,res,next) =>{
            try {   
                const moveData = req.body;
                const evaluation = await evaluateMove(moveData);

               res.json(evaluation);
            } catch (err) {
                res.json({
                     label: 'Unrated',
                    error: err.message
                })
            }
})


 app.use(express.static(frontEndFolder));

const port = process.env.PORT || 3000;
 
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});   