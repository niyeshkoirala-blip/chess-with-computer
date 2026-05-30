const { check } = require('./check2.js')
const { cloneBoard } = require('./cloneBoard.js')
 function castlecheck(moveData,movecheckResult){
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
                    return {
                        islegal : false,
                        state : 'fine'
                    }
                }
                const rookToCol = movecheckResult.castleSide === 'king' ? 5 : 3;
              
                return{
                    islegal: true,
                    state: 'castle',
                    castleSide: movecheckResult.castleSide,
                    rookTo: { row, col: rookToCol }
                };
           
}
exports.castlecheck=castlecheck;