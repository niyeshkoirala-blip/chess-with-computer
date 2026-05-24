const tileContainer = document.getElementById('chessTiles');

for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    const tile = document.createElement('div');
    const isLight = (row + col) % 2 === 0;
    tile.className = isLight ? 'light-tile' : 'dark-tile';
    tileContainer.appendChild(tile);
  }
}

let chosenMode  = null;
let chosenColor = null;

function pickMode(mode) {
  chosenMode = mode;

  document.getElementById('cardVsBot').classList.toggle('active', mode === 'bot');
  document.getElementById('cardVsHuman').classList.toggle('active', mode === 'human');

  const colorPicker = document.getElementById('colorPicker');

  if (mode === 'bot') {
    colorPicker.classList.remove('hidden');
    colorPicker.classList.add('slide-up');
  } else {
    colorPicker.classList.add('hidden');
    chosenColor = null;
    document.getElementById('choiceWhite').classList.remove('active');
    document.getElementById('choiceBlack').classList.remove('active');
  }

  refreshStartButton();
}

function pickColor(color) {
  chosenColor = color;
  document.getElementById('choiceWhite').classList.toggle('active', color === 'white');
  document.getElementById('choiceBlack').classList.toggle('active', color === 'black');
  refreshStartButton();
}

function refreshStartButton() {
  const button = document.getElementById('startButton');
  const isReady = chosenMode === 'human' || (chosenMode === 'bot' && chosenColor !== null);
  button.disabled = !isReady;
}

function startGame() {
  const queryParams = new URLSearchParams();
  queryParams.set('mode', chosenMode);

  if (chosenMode === 'bot') {
    queryParams.set('playerColor', chosenColor);
  }
   
  const button = document.getElementById('startButton');
  button.textContent = 'ENTERING THE BOARD…';
  button.style.opacity = '0.7';
  button.disabled = true;

  setTimeout(() => {
    window.location.href = 'chess.html?' + queryParams.toString();
  }, 800);
}