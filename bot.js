const { spawn } = require('child_process');
const { log } = require('console');

const pieceToFen = {
  '♔': 'K',
  '♕': 'Q',
  '♖': 'R',
  '♗': 'B',
  '♘': 'N',
  '♙': 'P',
  '♚': 'k',
  '♛': 'q',
  '♜': 'r',
  '♝': 'b',
  '♞': 'n',
  '♟': 'p'
};

const promotionPieces = {
  white: { q: '♕', r: '♖', b: '♗', n: '♘' },
  black: { q: '♛', r: '♜', b: '♝', n: '♞' }
};

function boardToFen(boardstate, turn) {
  const rows = boardstate.map(row => {
    let empty = 0;
    let fenRow = '';

    for (const square of row) {
      if (!square) {
        empty++;
      } else {
        if (empty > 0) {         
          fenRow += empty;
          empty = 0;
        }
        fenRow += pieceToFen[square];
      }
    }

    if (empty > 0) fenRow += empty;
    return fenRow;
  });

  const activeColor = turn === 'white' ? 'w' : 'b';
  const castling = getCastlingRights(boardstate);

  return `${rows.join('/')} ${activeColor} ${castling} - 0 1`;
}

function getCastlingRights(boardstate) {
  let rights = '';

  if (global.whitecastle && boardstate[7][4] === '♔') {
    if (boardstate[7][7] === '♖') rights += 'K';
    if (boardstate[7][0] === '♖') rights += 'Q';
  }

  if (global.blackcastle && boardstate[0][4] === '♚') {
    if (boardstate[0][7] === '♜') rights += 'k';
    if (boardstate[0][0] === '♜') rights += 'q';
  }

  return rights || '-';
}

function squareToCoords(square) {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);

  return {
    row: 8 - rank,
    col: file
  };
}

function coordsToSquare(coords) {
  const file = String.fromCharCode('a'.charCodeAt(0) + coords.col);
  const rank = 8 - coords.row;
  return `${file}${rank}`;
}

function moveToUci(from, to, promotionPiece) {
  const promotionMap = {
    '♕': 'q',
    '♛': 'q',
    '♖': 'r',
    '♜': 'r',
    '♗': 'b',
    '♝': 'b',
    '♘': 'n',
    '♞': 'n'
  };

  return `${coordsToSquare(from)}${coordsToSquare(to)}${promotionMap[promotionPiece] || ''}`;
}

function normalizeScore(score) {
  if (!score) return null;
  if (score.type === 'mate') {
    return score.value > 0 ? 100000 - score.value : -100000 - score.value;
  }
  return score.value;
}

function classifyMove(loss, playedMove, bestMove) {
  if (loss === null || Number.isNaN(loss)) return 'Analyzed';
  if (playedMove === bestMove && loss <= 5) return 'Brilliant';
  if (loss <= 15) return 'Perfect';
  if (loss <= 50) return 'Good';
  if (loss <= 150) return 'Mistake';
  return 'Blunder';
}

function askStockfish(fen, movetime = 500) {
  return analyzeFen(fen, movetime).then(result => result.bestMove);
}

function analyzeFen(fen, movetime = 500) {
  return new Promise((resolve, reject) => {
    const stockfishPath = process.env.STOCKFISH_PATH || 'stockfish';
    const engine = spawn(stockfishPath);
    let settled = false;
    let latestScore = null;

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      engine.kill();
      err ? reject(err) : resolve(result);
    };

    const send = command => engine.stdin.write(`${command}\n`);
    const timeout = setTimeout(() => {
      finish(new Error('Stockfish timed out while choosing a move.'));
    }, movetime + 5000);

    engine.on('error', err => {
      finish(new Error(`Could not start Stockfish. Install it or set STOCKFISH_PATH. ${err.message}`));
    });

    engine.stdout.on('data', chunk => {
      const lines = chunk.toString().split(/\r?\n/);

      for (const line of lines) {
        if (line === 'uciok') {
          send('isready');
        } else if (line === 'readyok') {
          send(`position fen ${fen}`);
          send(`go movetime ${movetime}`);
        } else if (line.includes(' score ')) {
          const match = line.match(/\bscore (cp|mate) (-?\d+)/);
          if (match) {
            latestScore = {
              type: match[1],
              value: Number(match[2])
            };
          }
        } else if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1];
          finish(null, { bestMove: move, score: latestScore });
        }
      }
    });

    send('uci');
  });
}

async function evaluateMove(data) {
  const { beforeBoard, afterBoard, turn, from, to, promotionPiece } = data;
  const nextTurn = turn === 'white' ? 'black' : 'white';
  const beforeFen = boardToFen(beforeBoard, turn);
  const afterFen = boardToFen(afterBoard, nextTurn);
  const [beforeResult, afterResult] = await Promise.all([
    analyzeFen(beforeFen, 350),
    analyzeFen(afterFen, 350)
  ]);

  const playedMove = moveToUci(from, to, promotionPiece);
  const bestScore = normalizeScore(beforeResult.score);
  const opponentAfterScore = normalizeScore(afterResult.score);
  const playedScore = opponentAfterScore === null ? null : -opponentAfterScore;
  const loss = bestScore === null || playedScore === null ? null : Math.max(0, bestScore - playedScore);

  return {
    label: classifyMove(loss, playedMove, beforeResult.bestMove),
    playedMove,
    bestMove: beforeResult.bestMove,
    loss
  };
}

async function botmove(data) {
  const { boardstate, turn } = data;
  const fen = boardToFen(boardstate, turn);
  const bestMove = await askStockfish(fen);

  if (!bestMove || bestMove === '(none)') {
    return { islegal: false, error: 'Stockfish did not find a move.' };
  }

  const from = squareToCoords(bestMove.slice(0, 2));
  const to = squareToCoords(bestMove.slice(2, 4));
  const piece = boardstate[from.row][from.col];
  const response = {
    islegal: true,
    from,
    to,
    state: 'fine',
    bestMove
  };

  if ((piece === '♔' || piece === '♚') && Math.abs(from.col - to.col) === 2) {
    response.state = 'castle';
    response.castleSide = to.col === 6 ? 'king' : 'queen';
    response.rookTo = { row: from.row, col: to.col === 6 ? 5 : 3 };
  }

  if (bestMove.length === 5) {
    response.promotionPiece = promotionPieces[turn][bestMove[4]];
  }
  console.log(response);
  
  return response;
}

exports.botmove = botmove;              
exports.evaluateMove = evaluateMove;
