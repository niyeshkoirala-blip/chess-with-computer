
function stalemate(boardstate){
    const { checkmate } = require("./checkmate");
    const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
     const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];
     let leftwhite = [];
     let leftblack = [];
     let result = [];
     let legalleftblack = false;
     let legalleftwhite = false;
     for(let i =0; i<8; i++){
        for(let j=0; j<8; j++){
            if (blackpieces.includes(boardstate[i][j])){
                leftblack.push(boardstate[i][j]);
            }
            else if(whitepieces.includes(boardstate[i][j])){
                leftwhite.push(boardstate[i][j]);
            }
        }
     }
         if (leftblack.length === 1 && leftblack[0] === "♚") {
             legalleftblack =checkmate(boardstate,'white');
        }
         else if (leftwhite.length === 1 && leftwhite[0] === "♔") {
            legalleftwhite =checkmate(boardstate,'black');
        }
        if (legalleftblack === true || legalleftwhite === true)  return true;
        else return false;
        
        
        

}
exports.stalemate = stalemate;
         
