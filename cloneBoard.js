 
function cloneBoard(boardstate) {
    return boardstate.map(row => [...row]);
}
exports.cloneBoard=cloneBoard;