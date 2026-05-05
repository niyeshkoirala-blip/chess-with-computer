  const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');
 const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
  function bishop (moveData){
    const { from, to, piece, boardstate, turn, state } = moveData;
      let edibleResult = edible(moveData);
      let notempty = 0;
      if (Math.abs(from.row - to.row) === Math.abs(from.col - to .col)){
        let rowstep = from.row < to.row ? 1 : -1;
        let colstep = from.col < to.col ? 1 : -1;
        let i = from.row + rowstep;
        let j = from.col + colstep;
      while( i !== to.row && j !== to.col){
        if(boardstate[i][j]!==null){
          return {islegal : false, state: 'fine'};
        }
        i += rowstep;
        j += colstep;
      }
      if( i === to.row && j === to.col ){
        return { islegal: true , state:'fine' , eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor}
      }
      }
    else{ 
        return { islegal:false, state: 'fi0ne'}
    }
    
  }
  exports .bishop=bishop;