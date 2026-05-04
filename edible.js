 const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
  const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
  const allpieces = blackpieces.concat(whitepieces);
  function edible(moveData) {
    const { from, to, piece, boardstate, turn, state } = moveData;
    let aftereatResult = aftereat(moveData);
        
    if (whitepieces.includes(piece)) {
      if ( blackpieces.includes(boardstate[to.row][to.col])) {
        return {
          islegal: true,
          state: 'fine',
          eatenpeices: aftereatResult.eatenpeices,
          eatencolor: aftereatResult.color
        };  
      } else{
        return { islegal: false, state: 'fine' };
      }
    }
    else if (blackpieces.includes(piece)) {
      if (whitepieces.includes(boardstate[to.row][to.col])) {
        console.log(aftereatResult.eatenpeices)
        return {
          islegal: true,
          state: 'fine',
          eatenpeices: aftereatResult.eatenpeices,
          eatencolor: aftereatResult.color
        };
      } else {
        return { islegal: false, state: 'fine',  eatenpeices: null, eatencolor: null};
      }
    } else {
      return { islegal: false, state: 'fine' };
    }
  }

   

  function aftereat(moveData) {
    const { to, boardstate } = moveData;
    const eatenpiece = boardstate[to.row][to.col];

    if (blackpieces.includes(eatenpiece)) {
      console.log("hello hi");
    
      return { color: "black", eatenpeices: eatenpiece };
    } else if (whitepieces.includes(eatenpiece)) {
      return { color: "white", eatenpeices: eatenpiece };
    } else {
      return { color: null, eatenpeices: null };
    }
  }
  exports.edible = edible;
  exports.aftereat = aftereat;