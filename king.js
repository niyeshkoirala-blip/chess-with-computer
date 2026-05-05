  const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');
 const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
  function king(moveData){
       const { from, to, piece, boardstate, turn, state } = moveData;
      let edibleResult = edible(moveData);
      let rowdif=Math.abs(from.row - to.row);
      let coldif=Math.abs(from.col -to.col)
      if (rowdif<2 && coldif<2){
        return {islegal:true, state:'fine', eatenpeices: edibleResult.eatenpeices, eatencolor:edibleResult.eatencolor};
      }
      else {
        return { islegal:false, state: 'fine'}
      }
  }
  exports.king=king;