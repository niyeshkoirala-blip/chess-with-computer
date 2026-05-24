const { movecheck } = require('./movecheck');
const { botmove, evaluateMove }= require('./bot.js');
const { check } = require('./check2.js');
const { checkmate } = require('./checkmate.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const frontEndFolder = path.join(__dirname, 'front end');

function cloneBoard(boardstate) {
    return boardstate.map(row => [...row]);
}

const mimeTypes = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
};

function serveFile(filePath, res) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

const server = http.createServer((req, res) => {

    if (req.url === '/move' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const moveData = JSON.parse(body);

            const movecheckResult = movecheck(moveData);

            if (!movecheckResult || !movecheckResult.islegal) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ islegal: false, state: 'fine' }));
                return;
            }

            if (movecheckResult.state === 'castle') {
                const row = moveData.from.row;
                const myKing = moveData.turn === 'white' ? '♔' : '♚';
                const throughCols = movecheckResult.castleSide === 'king' ? [4, 5, 6] : [4, 3, 2];
                let castleBlocked = false;
                for (const col of throughCols) {
                    const simB = cloneBoard(moveData.boardstate);
                    simB[row][col] = myKing;
                    simB[row][moveData.from.col] = null;
                    const cr = check(simB, moveData.turn);
                    if (cr.islegal === false) { castleBlocked = true; break; }
                }
                if (castleBlocked) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ islegal: false, state: 'fine' }));
                    return;
                }
                const rookToCol = movecheckResult.castleSide === 'king' ? 5 : 3;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    islegal: true,
                    state: 'castle',
                    castleSide: movecheckResult.castleSide,
                    rookTo: { row, col: rookToCol }
                }));
                return;
            }

            const simBoard = cloneBoard(moveData.boardstate);
            simBoard[moveData.to.row][moveData.to.col] = moveData.piece;
            simBoard[moveData.from.row][moveData.from.col] = null;

            if (movecheckResult.clearedsquare) {
                simBoard[movecheckResult.clearedsquare.row][movecheckResult.clearedsquare.col] = null;
            }

            const checkResult = check(simBoard, moveData.turn);

            res.writeHead(200, { 'Content-Type': 'application/json' });

            if (!checkResult.islegal) {
                res.end(JSON.stringify({ islegal: false, state: 'check' }));

            } else if (checkResult.state === 'check') {
                const isCheckmate = checkmate(simBoard, moveData.turn);
                res.end(JSON.stringify({
                    islegal: true,
                    state: isCheckmate ? 'checkmate' : 'check',
                    eatenpeices: movecheckResult.eatenpeices,
                    eatencolor: movecheckResult.eatencolor,
                    clearedsquare: movecheckResult.clearedsquare
                }));

            } else {
                res.end(JSON.stringify({
                    islegal: true,
                    state: movecheckResult.state,
                    eatenpeices: movecheckResult.eatenpeices,
                    eatencolor: movecheckResult.eatencolor,
                    clearedsquare: movecheckResult.clearedsquare
                }));
            }
        });

    } else if (req.url === '/bot' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const moveData = JSON.parse(body);
                const bot = await botmove(moveData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(bot));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    islegal: false,
                    error: err.message
                }));
            }
        });

    } else if (req.url === '/evaluate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const moveData = JSON.parse(body);
                const evaluation = await evaluateMove(moveData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(evaluation));
            } catch (err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    label: 'Unrated',
                    error: err.message
                }));
            }
        });

    } else {

        if (req.url === '/' || req.url === '/index.html') {
            serveFile(path.join(frontEndFolder, 'index.html'), res);

        } else if (req.url.startsWith('/chess.html')) {
            global.blackcastle = true;
            global.whitecastle = true;
            serveFile(path.join(frontEndFolder, 'chess.html'), res);

        } else {
            serveFile(path.join(frontEndFolder, req.url), res);
        }
    }
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
