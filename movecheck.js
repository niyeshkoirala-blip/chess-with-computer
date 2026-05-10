  // Global arrays declared once
  const { bishop } = require('./bishop.js');
  const { rook } = require('./rook.js');
  const { pawn }  = require('./pawn.js');
  const { queen } = require('./queen.js');
  const { knight }= require('./knight.js')
  const { king } = require('./king.js')
  const{ enpassant } = require("./enpassant.js")
  const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
        
 

  function movecheck(moveData) {
    
    const { from, to, piece, boardstate, turn, state , real } = moveData;
    const mypeice = turn === "white" ? whitepieces : blackpieces;
    

  if (boardstate[from.row][from.col] !== boardstate[to.row][to.col] && !mypeice.includes(boardstate[to.row][to.col])) {
    let result;
    if (piece === "♙" || piece === "♟") {
      result= pawn(moveData);
    } 
    else if(piece === "♖" || piece === "♜"){
      
      result= rook(moveData);
      
    }        
     else if(piece === "♝" || piece === "♗"){
       result= bishop(moveData);
     }
     else if(piece === "♛" || piece === "♕"){
      result= queen(moveData);

     }
    else if (piece === "♞" || piece === "♘"){
      result= knight(moveData);
    }
    else if (piece === "♚" || piece === "♔"){
      result= king(moveData);
    }
      
    else{
      result= {islegal: true , state :'fine'}
    }
    // After the result = piece_function(moveData) calls, before the isDoubleJump line:
if (!result) {
    return { islegal: false, state: 'fine' };
}
     const isDoubleJump = (piece === "♙" && from.row === 6 && to.row === 4) ||
                         (piece === "♟" && from.row === 1 && to.row === 3);

    if (result.islegal===true && moveData.real!== "fake" && !isDoubleJump){
      global.jump.clear();
    }
    return result;
    
  }
  else {
    return { islegal: false, state: 'fine' }; 
  }
  

  }
  exports.movecheck = movecheck;
  
 