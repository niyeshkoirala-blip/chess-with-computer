 const { edible } = require('./edible.js');
const { aftereat } = require('./edible.js');
 const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
  function rook(moveData){
    const { from, to, piece, boardstate, turn, state } = moveData;
      let edibleResult = edible(moveData);
      let empty = 0;
        let middlerows = (Math.abs(from.row - to.row))-1; 
        let middlecols = (Math.abs(from.col - to.col))-1;
       if( from.row === to.row && from.col !== to.col){
          if(from.col < to.col){
            for(let i=from.col+1; i<to.col; i++){
              if(boardstate[from.row][i] === null){
                empty++;
              }
            }
            if(empty === middlecols){
                 return { islegal: true, state: 'fine', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
            }
            else{
                 return { islegal: false, state: 'fine'}
            }
       }
          else if(from.col > to.col){
            for(let i=to.col+1; i<from.col; i++){
              if(boardstate[from.row][i] === null){
                empty++;
              }
            }
            if(empty === middlecols){
               return { islegal: true, state: 'fine', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
            }
            else {
              return { islegal: false, state: 'fine'}
            }
       }
      }
       else if(from.col === to.col && from.row !== to.row){
        if(from.row < to.row){
          for(let i=from.row+1; i<to.row; i++){
            if(boardstate[i][from.col] === null){
              empty++;
            }
          }
          if(empty === middlerows){
            return { islegal: true, state: 'fine', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
          } 
          else{
            return{ islegal:false, state:'fine'}
          }

       } 
        else if(from.row > to.row){
          for(let i=to.row+1; i<from.row; i++){
            if(boardstate[i][from.col] === null){
              empty++;
            }
          }
          if(empty === middlerows){
            return { islegal: true, state: 'fine', eatenpeices: edibleResult.eatenpeices, eatencolor: edibleResult.eatencolor };
          } 
          else {
              return { islegal: false, state: 'fine' }; 
         }
        
    }

  }  

    else {
      return { islegal: false, state: 'fine' }; 
    }
  }
  
exports .rook = rook