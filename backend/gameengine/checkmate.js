const { cloneBoard } = require('./cloneBoard.js')
const { check } = require('./check2.js');


const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];


function checkmate(boardstate, turn) {
    const { movecheck } = require('./movecheck');
    const enemyTurn = turn === 'white' ? 'black' : 'white';
    const enemyPieces = enemyTurn === 'white' ? whitepieces : blackpieces;
    
    // Save and clear en passant state for clean simulation
    const savedJump = new Map(global.jump);
    global.jump.clear();

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
                            real: 'fake'
                        };

                        const moveResult = movecheck(fakemove);
                        if (moveResult && moveResult.islegal) {
                            const simBoard = cloneBoard(boardstate);
                            simBoard[toRow][toCol] = fakemove.piece;
                            simBoard[fromRow][fromCol] = null;
                            if (moveResult.clearedsquare) {
                                simBoard[moveResult.clearedsquare.row][moveResult.clearedsquare.col] = null;
                            }

                            const checkresult = check(simBoard, enemyTurn);
                            if (checkresult.islegal) {
                                global.jump = savedJump; // restore
                                return false;
                            }
                        }
                    }
                }
            }
        }
    }

    global.jump = savedJump; // restore
    return true;
}
exports.checkmate = checkmate;
