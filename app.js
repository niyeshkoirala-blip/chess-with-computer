const { movecheck } = require('./movecheck');
const { check } = require('./check2.js');
const { checkmate}= require('./checkmate.js')
const { getBotMove } = require('./bot');
const http = require('http');
const fs = require('fs');
const path = require('path');


function cloneBoard(boardstate) {
    return boardstate.map(row => [...row]);
} 

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
};

const server = http.createServer((req, res) => {
    if (req.url === '/move' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const moveData = JSON.parse(body);
            
        
            // Step 1: check piece movement rules
            const movecheckResult = movecheck(moveData);     

            if (!movecheckResult || !movecheckResult.islegal) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ islegal: false, state: 'fine' }));
                return;
            }

            // Step 1b: castling — verify king doesn't pass through check
            if (movecheckResult.state === 'castle') {
                console.log("hello")
                const row = moveData.from.row;
                const myKing = moveData.turn === 'white' ? '♔' : '♚';
                const throughCols = movecheckResult.castleSide === 'king' ? [4, 5, 6] : [4, 3, 2];
                let castleBlocked = false;
                for (const col of throughCols) {
                    const simB = cloneBoard(moveData.boardstate);
                    simB[row][col] = myKing;
                    simB[row][moveData.from.col] = null;
                    const cr = check(simB, moveData.turn);
                    if (cr.islegal === false && moveData.state ==='check') { castleBlocked = true; break; }
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
            
            // Step 2: simulate the move on a cloned board
            const simBoard = cloneBoard(moveData.boardstate);
            simBoard[moveData.to.row][moveData.to.col] = moveData.piece;
            simBoard[moveData.from.row][moveData.from.col] = null;

            // handle en passant cleared square
            if (movecheckResult.clearedsquare) {
                simBoard[movecheckResult.clearedsquare.row][movecheckResult.clearedsquare.col] = null;
            }

            // Step 3: check both kings on the simulated board
            const checkResult = check(simBoard, moveData.turn);

            res.writeHead(200, { 'Content-Type': 'application/json' });

            if (!checkResult.islegal) {
               
                // own king is in check — illegal move
                res.end(JSON.stringify({
                    islegal: false,
                    state: 'check'
                }));

            } else if (checkResult.state === 'check') {
                
                // enemy king is in check — test for checkmate
                // checkmate() returns boolean
                const isCheckmate = checkmate(simBoard, moveData.turn);
                res.end(JSON.stringify({
                    islegal: true,
                    state: isCheckmate ? 'checkmate' : 'check',
                    eatenpeices: movecheckResult.eatenpeices,
                    eatencolor: movecheckResult.eatencolor,
                    clearedsquare: movecheckResult.clearedsquare
                }));
                
            } else {
                
                // normal legal move — pass through 'fine' or 'upgrade'
                res.end(JSON.stringify({
                    islegal: true,
                    state: movecheckResult.state,
                    eatenpeices: movecheckResult.eatenpeices,
                    eatencolor: movecheckResult.eatencolor,
                    clearedsquare: movecheckResult.clearedsquare
                }));
            }
        });
        
    } else {
        global.blackcastle= true;
global.whitecastle= true;
        const filePath = req.url === '/'
        ? path.join(__dirname, '/front end', 'chess.html')
        : path.join(__dirname, '/front end', req.url);

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
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:4000');
});