const board = document.getElementById('chess-board');
const upgradeModal = document.getElementById('upgrade-modal');

function upgradepiece(row, col) {
  upgradeModal.style.display = 'block';
  document.getElementById('upgrade-queen').onclick =() => {
    boardstate[row][col] = turn !== 'white' ? '♕' : '♛';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    upgradeModal.style.display = 'none';
  }
  document.getElementById('upgrade-rook').onclick =() => {
    boardstate[row][col] = turn !== 'white' ? '♖' : '♜';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    upgradeModal.style.display = 'none';
  }
  document.getElementById('upgrade-bishop').onclick =() => {
    boardstate[row][col] = turn !== 'white' ? '♗' : '♝';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    upgradeModal.style.display = 'none';
  }
  document.getElementById('upgrade-knight').onclick =() => {
    boardstate[row][col] = turn !== 'white' ? '♘' : '♞';
    document.getElementById(`${row}-${col}`).textContent = boardstate[row][col];
    upgradeModal.style.display = 'none';
  }
}


let boardstate = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗","♕" ,"♔" , "♗", "♘", "♖"]
];

for (let row = 0; row < 8; row++) { 
  for (let col = 0; col < 8; col++) {
    const square = document.createElement('div');
    square.className = 'square';
    square.id = `${row}-${col}`;
    square.textContent = boardstate[row][col] || '';

    if(row %2 === col %2) {
      square.classList.add('light');
    } else {
      square.classList.add('dark');
    }
    board.appendChild(square);
  }
}

let color = ['white', 'black'];
let turn = color[0];
let blackpeices = ["♜", "♞", "♝", "♛", "♚", "♟"];
let whitepeices = ["♖", "♘", "♗", "♕", "♔", "♙"];
let allpeices = blackpeices.concat(whitepeices);
let islegal;
let state = "fine";
let eatenpeicesblack = [];
let eatenpeiceswhite = [];
let selectedSquare = [{ row: null, col: null }, { row: null, col: null }];
let nooftimes = 0;
const real = "real";

document.querySelectorAll('.square').forEach(square => {
  square.addEventListener('click', () => {
    const [row, col] = square.id.split('-').map(Number);
    let peice = boardstate[row][col];
    if (blackpeices.includes(peice) && turn === 'black' || whitepeices.includes(peice) && turn === 'white' || nooftimes === 1) {
      selectedSquare[nooftimes] = { row, col };
      console.log(`Selected square: selectedSquare[${nooftimes}] = { row: ${row}, col: ${col} }`);
      nooftimes++;
      if (nooftimes === 2) {
        fetch('/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: selectedSquare[0],
            to: selectedSquare[1],
            piece: boardstate[selectedSquare[0].row][selectedSquare[0].col],
            turn: turn,
            boardstate: boardstate,
            state: state,
            real: real,
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Data received from server:', data);
          islegal = data.islegal;
          state = data.state;

          if (data.eatencolor === 'black') {
            eatenpeicesblack.push(data.eatenpeices);
            document.getElementsByClassName('eaten-black')[0].innerHTML = eatenpeicesblack.join(' ');
          } else if (data.eatencolor === 'white') {
            eatenpeiceswhite.push(data.eatenpeices);
            document.getElementsByClassName('eaten-white')[0].innerHTML = eatenpeiceswhite.join(' ');
          }

          if (state === 'checkmate') {
            alert(`Checkmate! ${turn} wins!`);
            nooftimes = 0;
          } else if (state === 'stalemate') {
            alert(`Stalemate! It's a draw!`);
            nooftimes = 0;
          } else if (!islegal) {
            alert('Illegal move! Please try again.');
            nooftimes = 0;
          } else {
            // Move is legal — update the board visuals
            boardstate[selectedSquare[1].row][selectedSquare[1].col] =
              boardstate[selectedSquare[0].row][selectedSquare[0].col];
            boardstate[selectedSquare[0].row][selectedSquare[0].col] = null;

            let selecteddiv1 = document.getElementById(`${selectedSquare[0].row}-${selectedSquare[0].col}`);
            let selecteddiv2 = document.getElementById(`${selectedSquare[1].row}-${selectedSquare[1].col}`);
            selecteddiv2.textContent = selecteddiv1.textContent;
            selecteddiv1.textContent = '';

            // handle en passant cleared square
            if (data.clearedsquare) {
              const clearedDiv = document.getElementById(`${data.clearedsquare.row}-${data.clearedsquare.col}`);
              clearedDiv.textContent = '';
              boardstate[data.clearedsquare.row][data.clearedsquare.col] = null;
            }

            // handle castling — move rook visually (rook always starts at col 0 or 7)
            if (state === 'castle' && data.rookTo) {
              const rookSymbol = turn === 'white' ? '♖' : '♜';
              const rookFromCol = data.castleSide === 'king' ? 7 : 0;
              const rookRow = data.rookTo.row;
              document.getElementById(`${rookRow}-${rookFromCol}`).textContent = '';
              document.getElementById(`${rookRow}-${data.rookTo.col}`).textContent = rookSymbol;
              boardstate[rookRow][rookFromCol] = null;
              boardstate[rookRow][data.rookTo.col] = rookSymbol;
            }

            // handle pawn promotion
            if (state === 'upgrade') {
              upgradepiece(selectedSquare[1].row, selectedSquare[1].col);
            }

            // handle check highlight
            if (state === 'check') {
              const enemyKing = turn === 'white' ? '♚' : '♔';
              document.querySelectorAll('.square').forEach(div => div.classList.remove('check'));
              const squarewithking = Array.from(document.querySelectorAll('.square')).find(div => div.textContent === enemyKing);
              if (squarewithking) squarewithking.classList.add('check');
            } else {
              document.querySelectorAll('.square').forEach(div => div.classList.remove('check'));
            }

            nooftimes = 0;
            turn = color[(color.indexOf(turn) + 1) % color.length];
          }
        });
      }
    } else {
      alert(`It's ${turn}'s turn! Please select a ${turn} piece.`);
    }
  });
});