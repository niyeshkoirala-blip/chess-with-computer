  // Global arrays declared once
  const { rook } = require('./rook.js');
  const { pawn }  = require('./pawn.js');
  const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);

  function movecheck(moveData) {
    const { from, to, piece, boardstate, turn, state } = moveData;
   

  if (boardstate[from.row][from.col] !== boardstate[to.row][to.col]) {
    if (piece === "♙" || piece === "♟") {
      return pawn(moveData);
    } 
    else if(piece === "♖" || piece === "♜"){
      console.log(rook(moveData));
        return rook(moveData);
      
    }
    else{
      return {islegal: true , state :'fine'}
    }

  }
  

 
  else {
    return { islegal: false, state: 'fine' }; 
  }
  

  }
  exports.movecheck = movecheck;
  
 