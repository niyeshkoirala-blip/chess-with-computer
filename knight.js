  const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');
 const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
  function knight(moveData){
       const { from, to, piece, boardstate, turn, state } = moveData;
      let edibleResult = edible(moveData);
    if(Math.abs(from.row-to.row)=== 2 && Math.abs(from.col - to.col)===1){
        return {islegal:true, state:'fine', eatenpeices: edibleResult.eatenpeices, eatencolor:edibleResult.eatencolor}
    }
    else if(Math.abs(from.row-to.row)=== 1 && Math.abs(from.col - to.col)===2){
        return {islegal:true, state:'fine', eatenpeices: edibleResult.eatenpeices, eatencolor:edibleResult.eatencolor}
    } 
    else{
        return { islegal:false , state: 'fine'}
    }

  }
  exports.knight=knight;