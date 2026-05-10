const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');
const { enpassant } = require('./enpassant.js');

const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
const allpieces = blackpieces.concat(whitepieces);

global.jump = new Map();

function pawn(moveData) {
  const { from, to, piece, boardstate, turn, state } = moveData;
  let edibleResult = edible(moveData);
  let passantresult = enpassant(moveData);


  // WHITE PAWN
  if (boardstate[from.row][from.col] === "♙") {
    // two-step
    if (
      from.row === 6 && to.row === 4 && from.col === to.col &&
      boardstate[to.row][to.col] === null &&
      boardstate[from.row - 1][from.col] === null
    ) {
      if(moveData.real !== "fake"){
      global.jump.set(`${to.row},${to.col}`, true);
      }
      return { islegal: true, state: 'fine' };
      
    }
    // promotion-straight
    else if (
      to.row === 0 && from.row - to.row === 1 && from.col === to.col &&
      boardstate[to.row][to.col] === null
    ) {
     
      return { islegal: true, state: 'upgrade' };
    }
    // diagonal-capture
    else if (from.row - to.row === 1 && Math.abs(to.col - from.col) === 1) {
      if (edibleResult.islegal === true) {
        if (to.row === 0) {
         
          return {
            islegal: true,
            state: 'upgrade',
            eatenpeices: edibleResult.eatenpeices,
            eatencolor: edibleResult.eatencolor
          };
        } else {
       
          return {
            islegal: true,
            state: 'fine',
            eatenpeices: edibleResult.eatenpeices,
            eatencolor: edibleResult.eatencolor
          };
        }
      }
      // en-passant
      else if (passantresult.islegal === true) {
        return passantresult;
      }
      // illegal-move
      else {
        return { islegal: false, state: 'fine' };
      }
    }
    // single-step
    else if (
      from.row - to.row === 1 && from.col === to.col &&
      boardstate[to.row][to.col] === null
    ) {
    
      return { islegal: true, state: 'fine' };
    }
    // illegal-move
    else {
      return { islegal: false, state: 'fine' };
    }
  }

  // BLACK PAWN
  else if (boardstate[from.row][from.col] === "♟") {
    // two-step
    if (
      from.row === 1 && to.row === 3 && from.col === to.col &&
      boardstate[to.row][to.col] === null &&
      boardstate[from.row + 1][from.col] === null
    ) {
  if(moveData.real !== "fake"){
      global.jump.set(`${to.row},${to.col}`, true);
  }
      return { islegal: true, state: 'fine' };
    }
    // promotion-straight
    else if (
      to.row === 7 && to.row - from.row === 1 && from.col === to.col &&
      boardstate[to.row][to.col] === null
    ) {
    
      return { islegal: true, state: 'upgrade' };
    }
    // diagonal-capture
    else if (to.row - from.row === 1 && Math.abs(to.col - from.col) === 1) {
      if (edibleResult && edibleResult.islegal === true) {
        if (to.row === 7) {
        
          return {
            islegal: true,
            state: 'upgrade',
            eatenpeices: edibleResult.eatenpeices,
            eatencolor: edibleResult.eatencolor
          };
        } else {
        
          return {
            islegal: true,
            state: 'fine',
            eatenpeices: edibleResult.eatenpeices,
            eatencolor: edibleResult.eatencolor
          };
        }
      }
      else if ( passantresult.islegal === true ){
        return passantresult;
      }
      // illegal-move
      else {
        return { islegal: false, state: 'fine' };
      }
    }
    // single-step
    else if (
      to.row - from.row === 1 && from.col === to.col &&
      boardstate[to.row][to.col] === null
    ) {
    
      return { islegal: true, state: 'fine' };
    }
    // illegal-move
    else {
      return { islegal: false, state: 'fine' };
    }
  }
}

exports.pawn = pawn;
