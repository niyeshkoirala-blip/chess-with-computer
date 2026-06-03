const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');

const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
const allpieces = blackpieces.concat(whitepieces);
function enpassant(moveData) {
  const { from, to, piece, boardstate, turn, state } = moveData;
  let edibleResult = edible(moveData);
 if ( piece === "♟" || piece === "♙"){
  if(blackpieces.includes(piece) && global.jump.get(`${to.row-1},${to.col}`) === true && whitepieces.includes(boardstate[to.row -1][to.col])){
    
     let eatenpeices = boardstate[to.row -1][ to.col];
     boardstate[to.row -1][ to.col]=null;
     let clearedsquare = {row: to.row - 1, col: to.col};
    // Black pawn capturing white
return { islegal: true, state: 'fine', eatenpeices: eatenpeices, eatencolor: 'white', clearedsquare: clearedsquare};

  }
  else if ( whitepieces.includes(piece) && global.jump.get(`${to.row+1},${to.col}`) === true && blackpieces.includes(boardstate[to.row+1][to.col])){
       let eatenpeices = boardstate[to.row + 1 ][ to.col];
       boardstate[to.row + 1 ][ to.col]=null;
       let clearedsquare =  {row: to.row + 1, col: to.col};
     // White pawn capturing black  
return { islegal: true, state: 'fione', eatenpeices: eatenpeices, eatencolor: 'black', clearedsquare:clearedsquare  };

  }
  else{
    return {islegal:false ,state:'fone'}
  }
}
else{
     return{ islegal: false};
} 
}
exports.enpassant=enpassant;      