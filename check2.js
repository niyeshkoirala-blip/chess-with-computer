const { movecheck } = require("./movecheck.js");

const blackpieces = ["♜", "♞", "♝", "♛", "♚", "♟"];
const whitepieces = ["♖", "♘", "♗", "♕", "♔", "♙"];

function isKingInCheck(boardstate, kingcolor) {
    // Find the king
    let kingslot;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (boardstate[i][j] === kingcolor) {
                kingslot = { row: i, col: j };
            }
        }
    }
    if (!kingslot) return false;

    let enemypieces = kingcolor === "♔" ? blackpieces : whitepieces;
    let enemyturn = kingcolor === "♔" ? "black" : "white";

    for (let k = 0; k < 8; k++) {
        for (let l = 0; l < 8; l++) {
            if (enemypieces.includes(boardstate[k][l])) {
                let fakemove = {
                    from: { row: k, col: l },
                    to: kingslot,
                    piece: boardstate[k][l],
                    turn: enemyturn,
                    boardstate: boardstate,
                    state: "fine",     
                    real: "fake"
                };
                let result = movecheck(fakemove);
                if (result && result.islegal === true) return true;
            }
        }
    }
    return false;
}     

function check(simBoard, turn) {
    const myKing    = turn === "white" ? "♔" : "♚";
    const enemyKing = turn === "white" ? "♚" : "♔";
 
    const myKingInCheck    = isKingInCheck(simBoard, myKing);
    const enemyKingInCheck = isKingInCheck(simBoard, enemyKing);

    if (myKingInCheck) {
        // Move is illegal — own king is in check
        return { islegal: false, state: "check" };
    } else if (enemyKingInCheck) {
        // Move is legal and puts enemy in check
        return { islegal: true, state: "check" };
    } else {
        return { islegal: true, state: "fine" };
    }
}

exports.check = check;
exports.isKingInCheck = isKingInCheck;
    