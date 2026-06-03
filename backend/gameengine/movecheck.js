  // Global arrays declared once
  const { bishop } = require('./bishop.js');
  const { rook } = require('./rook.js');
  const { pawn }  = require('./pawn.js');
  const { queen } = require('./queen.js');
  const { knight }= require('./knight.js')
  const { king } = require('./king.js');
  const{ enpassant } = require("./enpassant.js")
  const { castlecheck } = require("./castlecheck.js");
  const { check } = require('./check2.js');
const { checkmate } = require('./checkmate.js');
const { stalemate } = require('./stalemate.js');
const { cloneBoard } = require('./cloneBoard.js')
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
      let kingresult = king(moveData);
      if (kingresult && kingresult.state === "castle"){
        const castleResult = castlecheck(moveData, kingresult);
        if (castleResult && castleResult.islegal === true) {
            result = castleResult;
        } else {
          result = { islegal: false , state: 'fine'};
        }
      } else {
        result = kingresult || { islegal: false, state: 'fine' };
      }

    }
         
    else{
      result= {islegal: false , state :'fine'}
    }

   let simboard = cloneBoard(moveData.boardstate);
      simboard[moveData.to.row][moveData.to.col]  =  simboard[moveData.from.row][moveData.from.col]
      simboard[moveData.from.row][moveData.from.col] = null;
        if (result.islegal) {
      checkresult = check(simboard,moveData.turn);
      if (checkresult.islegal === true  && checkresult.state ==='check') {
         checkmateresult = checkmate(simboard,moveData.turn);
         stalemateresult = stalemate(simboard);
         if (checkmateresult){
          result.state = 'checkmate';
         }
         
         else {
          result.state = 'check'
         }
       }
       else if (checkresult.islegal === true  && checkresult.state ==='check'){
          if (stalemateresult) result.state = 'stalemate';
       }
     else if(checkresult.islegal === false){
          result.islegal = false;
       }
    }
    else{
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
  
 