const { edible } = require('./edible.js');
const { cloneBoard } = require('./cloneBoard.js')

const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];




function king(moveData) {
    let emptysquares= 0;
    let possiblecheck = 0;
    const { from, to ,piece, boardstate} = moveData;
    let edibleResult = edible(moveData);
    let fromcastleking = piece === "♔" ? {row: 7, col : 4} : {row: 0, col: 4};
    let castlepossible = piece === "♚" ? global.blackcastle : global.whitecastle;
    

    let rowdif = Math.abs(from.row - to.row);
    let coldif = Math.abs(from.col - to.col);
    if (rowdif < 2 && coldif < 2 && (rowdif + coldif) > 0 ) {
          if(moveData.real !== "fake"){
        piece === "♚" ? global.blackcastle = false : global.whitecastle = false ;
          }
        return {
            islegal: true,
            state: 'fine',
            eatenpeices: edibleResult.eatenpeices,
            eatencolor: edibleResult.eatencolor
        };
    } 
    else if(castlepossible === true && to.col === 2 && rowdif === 0){
        for (let i = from.col - 1; i > 0; i-- ){
            if (boardstate[from.row][i] !== null) emptysquares++;
        }
        if(emptysquares === 0){
              if(moveData.real !== "fake"){
            piece === "♚" ? global.blackcastle = false : global.whitecastle = false ;
              }
            return {islegal: true, state : "castle", castleSide: 'queen'};
        }
    }
    else if(castlepossible === true && to.col === 6 && rowdif ===0){

        for (let i = from.col + 1; i < 7; i++ ){
            if (boardstate[from.row][i] !== null) emptysquares++;
        }
        if(emptysquares === 0){
              if(moveData.real !== "fake"){
            piece === "♚" ? global.blackcastle = false : global.whitecastle = false ;
              }
            return {islegal: true, state : "castle", castleSide: 'king'};
        }
    }
    else {
        return { islegal: false, state: 'fine' };
    }       

}

exports.king = king;