const board = document.getElementById('chess-board');

// Generate all 64 squares with JS — no need to write them by hand in HTML!

let boardstate = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"]
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


let selectedSquare = [{ row: null, col: null }, { row: null, col: null }];
let nooftimes=0;
document.querySelectorAll('.square').forEach(square => {
  square.addEventListener('click', () => {
    const [row, col] = square.id.split('-').map(Number);
    let peice = boardstate[row][col];
    if (blackpeices.includes(peice) && turn === 'black' || whitepeices.includes(peice) && turn === 'white') {
    selectedSquare[nooftimes] = { row, col };
    console.log(`Selected square: selectedSquare[${nooftimes}] = { row: ${row}, col: ${col} }`);
    nooftimes++;
    if (nooftimes === 2) {
      boardstate[selectedSquare[1].row][selectedSquare[1].col] =
        boardstate[selectedSquare[0].row][selectedSquare[0].col];
      boardstate[selectedSquare[0].row][selectedSquare[0].col] = null;

      let selecteddiv1 = document.getElementById(`${selectedSquare[0].row}-${selectedSquare[0].col}`);
      let selecteddiv2 = document.getElementById(`${selectedSquare[1].row}-${selectedSquare[1].col}`);
      selecteddiv2.textContent = selecteddiv1.textContent;
      selecteddiv1.textContent = '';

      nooftimes = 0;
      turn = color[(color.indexOf(turn) + 1) % color.length];

      fetch('/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: selectedSquare[0],
          to: selectedSquare[1],
          piece: boardstate[selectedSquare[1].row][selectedSquare[1].col],
          turn: turn,
          boardstate: boardstate
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('Move data sent to server:', data);
      });
    }
  }
  else {
    alert(`It's ${turn}'s turn! Please select a ${turn} piece.`);
  }
  });
});
