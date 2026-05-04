const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');
const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
const allpieces = blackpieces.concat(whitepieces);

function pawn(moveData) {
  const { from, to, piece, boardstate, turn, state } = moveData;
  let edibleResult = edible(moveData);
  let islegal;
  console.log(edibleResult);

  // WHITE PAWN
  if (boardstate[from.row][from.col] === "♙") {

    // 2 steps forward from starting rank
    if (from.row === 6 && to.row === 4 && from.col === to.col &&
        boardstate[to.row][to.col] === null &&
        boardstate[from.row - 1][from.col] === null) {
      return { islegal: true, state: 'fine' };
    }
    // straight move to last rank for promotion
    else if (to.row === 0 && from.row - to.row === 1 && from.col === to.col &&
             boardstate[to.row][to.col] === null) {
      return { islegal: true, state: 'upgrade' };
    }
    // eating a piece diagonally
    else if (from.row - to.row === 1 && Math.abs(to.col - from.col) === 1) {
      if (edibleResult.islegal === true) {   // FIXED: was edibleResult.eatenpeice !== null
        if (to.row === 0) {
          return { islegal: true, state: 'upgrade', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
        } else {
          return { islegal: true, state: 'fine', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
        }
      } else {
        return { islegal: false, state: 'fine' };
      }
    }
    // single step forward
    else if (from.row - to.row === 1 && from.col === to.col &&
             boardstate[to.row][to.col] === null) {
      return { islegal: true, state: 'fine' };
    }
    // anything else is illegal
    else {
      return { islegal: false, state: 'fine' };
    }
  }

  // BLACK PAWN
  else if (boardstate[from.row][from.col] === "♟") {

    // 2 steps forward from starting rank
    if (from.row === 1 && to.row === 3 && from.col === to.col &&
        boardstate[to.row][to.col] === null &&
        boardstate[from.row + 1][from.col] === null) {
      return { islegal: true, state: 'fine' };
    }
    // straight move to last rank for promotion
    else if (to.row === 7 && to.row - from.row === 1 && from.col === to.col &&
             boardstate[to.row][to.col] === null) {
      return { islegal: true, state: 'upgrade' };
    }
    // eating a piece diagonally
    else if (to.row - from.row === 1 && Math.abs(to.col - from.col) === 1) {
      if (edibleResult && edibleResult.islegal === true) {   // FIXED: was edibleResult.eatenpeices !== null
        if (to.row === 7) {
          return { islegal: true, state: 'upgrade', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
        } else {
          return { islegal: true, state: 'fine', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
        }
      } else {
        return { islegal: false, state: 'fine' };
      }
    }
    // single step forward
    else if (to.row - from.row === 1 && from.col === to.col &&
             boardstate[to.row][to.col] === null) {
      return { islegal: true, state: 'fine' };
    }
    // anything else is illegal
    else {
      return { islegal: false, state: 'fine' }; 
    }
  }
}

exports.pawn = pawn;