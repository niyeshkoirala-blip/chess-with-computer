  // Global arrays declared once
  const { bishop } = require('./bishop.js');
  const { rook } = require('./rook.js');
  const { pawn }  = require('./pawn.js');
  const { queen } = require('./queen.js');
  const { knight }= require('./knight.js')
  const { king } = require('./king.js')
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
    
        return rook(moveData);
      
    }
     else if(piece === "♝" || piece === "♗"){
        return bishop(moveData);
     }
     else if(piece === "♛" || piece === "♕"){
      return queen(moveData);

     }
    else if (piece === "♞" || piece === "♘"){
      return knight(moveData);
    }
     else if (piece === "♚" || piece === "♔"){
      return king(moveData);
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
  
 