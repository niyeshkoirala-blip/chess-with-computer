
function stalemate(boardstate, turn, context) {
    const { checkmate } = require("./checkmate");
    const { check } = require("./check2");
    const enemyTurn = turn === 'white' ? 'black' : 'white';

    const enemyCheck = check(boardstate, enemyTurn, context);
    if (enemyCheck.islegal === false) return false;

    return checkmate(boardstate, turn, context);
}
exports.stalemate = stalemate;
         
