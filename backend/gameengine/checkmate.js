const { cloneBoard } = require('./cloneBoard.js')
const { check } = require('./check2.js');
const { getEngineContext } = require('./context.js');


const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];


function checkmate(boardstate, turn, contextInput) {
    const { movecheck } = require('./movecheck');
    const context = getEngineContext({ context: contextInput });
    const enemyTurn = turn === 'white' ? 'black' : 'white';
    const enemyPieces = enemyTurn === 'white' ? whitepieces : blackpieces;
    
    const savedJump = new Map(context.jump);
    context.jump.clear();

    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            if (enemyPieces.includes(boardstate[fromRow][fromCol])) {
                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        const fakemove = {
                            from: { row: fromRow, col: fromCol },  
                            to: { row: toRow, col: toCol },
                            piece: boardstate[fromRow][fromCol],
                            turn: enemyTurn,
                            boardstate: boardstate,
                            state: 'fine',
                            real: 'fake',
                            context
                        };

                        const moveResult = movecheck(fakemove);
                        if (moveResult && moveResult.islegal) {
                            const simBoard = cloneBoard(boardstate);
                            simBoard[toRow][toCol] = fakemove.piece;
                            simBoard[fromRow][fromCol] = null;
                            if (moveResult.clearedsquare) {
                                simBoard[moveResult.clearedsquare.row][moveResult.clearedsquare.col] = null;
                            }

                            const checkresult = check(simBoard, enemyTurn, context);
                            if (checkresult.islegal) {
                                context.jump = savedJump;
                                return false;
                            }
                        }
                    }
                }
            }
        }
    }

    context.jump = savedJump;
    return true;
}
exports.checkmate = checkmate;
