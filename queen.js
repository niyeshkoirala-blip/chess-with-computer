 
 const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
  const { rook } = require('./rook.js');
  const { bishop } = require('./bishop.js');
  function queen (moveData){
    let bishopmove= bishop(moveData);
    let rookmove= rook(moveData);
    
    if (bishopmove.islegal === true ){
        return bishopmove;
    }else{
        return rookmove;
    }
    

  }
  exports.queen= queen;