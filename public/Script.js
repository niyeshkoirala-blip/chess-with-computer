const tileContainer = document.getElementById('chessTiles');

for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    const tile = document.createElement('div');
    const isLight = (row + col) % 2 === 0;
    tile.className = isLight ? 'light-tile' : 'dark-tile';
    tileContainer.appendChild(tile);
  }
}

// ─── Difficulty config ───────────────────────────────────────────────────────
const DIFFICULTY_LEVELS = {
  1: { name: 'Novice',  skillLevel: 1,  movetime: 50,  desc: 'Skill 1 · 50ms think time'  },
  2: { name: 'Easy',    skillLevel: 5,  movetime: 150, desc: 'Skill 5 · 150ms think time' },
  3: { name: 'Medium',  skillLevel: 10, movetime: 300, desc: 'Skill 10 · 300ms think time'},
  4: { name: 'Hard',    skillLevel: 15, movetime: 800, desc: 'Skill 15 · 800ms think time'},
  5: { name: 'Master',  skillLevel: 20, movetime: 2000,desc: 'Skill 20 · 2s think time'  },
};

let chosenMode       = null;
let chosenColor      = null;
let chosenSpeed      = null;
let chosenDifficulty = 3; // default Medium

// ─── Difficulty slider wiring ─────────────────────────────────────────────────
const difficultySlider = document.getElementById('difficultySlider');
const difficultyFill   = document.getElementById('difficultyFill');
const badgeLevel       = document.getElementById('badgeLevel');
const badgeDesc        = document.getElementById('badgeDesc');

function updateDifficultyUI(val) {
  const pct = ((val - 1) / 4) * 100;
  difficultyFill.style.width = pct + '%';

  // colour fill: green → amber → red
  const hue = Math.round(120 - (val - 1) * 30);
  difficultyFill.style.background =
    `linear-gradient(90deg, hsl(${hue},70%,38%), hsl(${hue - 15},75%,50%))`;

  const cfg = DIFFICULTY_LEVELS[val];
  badgeLevel.textContent = cfg.name;
  badgeDesc.textContent  = cfg.desc;

  // notch active states
  document.querySelectorAll('#difficultyPicker .notch').forEach((n, i) => {
    n.classList.toggle('active', i + 1 <= val);
  });

  chosenDifficulty = val;
}

difficultySlider.addEventListener('input', e => {
  updateDifficultyUI(Number(e.target.value));
});

// init
updateDifficultyUI(3);

// ─── Mode picker ─────────────────────────────────────────────────────────────
function pickMode(mode) {
  chosenMode = mode;

  document.getElementById('cardVsBot').classList.toggle('active', mode === 'bot');
  document.getElementById('cardVsHuman').classList.toggle('active', mode === 'human');
  document.getElementById('cardBvb').classList.toggle('active', mode === 'bvb');

  const colorPicker      = document.getElementById('colorPicker');
  const speedPicker      = document.getElementById('speedPicker');
  const difficultyPicker = document.getElementById('difficultyPicker');

  if (mode === 'bot') {
    colorPicker.classList.remove('hidden');
    colorPicker.classList.add('slide-up');
    difficultyPicker.classList.remove('hidden');
    difficultyPicker.classList.add('slide-up');
    speedPicker.classList.add('hidden');
    chosenSpeed = null;
    clearSpeedSelection();
  } else if (mode === 'bvb') {
    speedPicker.classList.remove('hidden');
    speedPicker.classList.add('slide-up');
    difficultyPicker.classList.remove('hidden');
    difficultyPicker.classList.add('slide-up');
    colorPicker.classList.add('hidden');
    chosenColor = null;
    clearColorSelection();
  } else {
    // human vs human — no extras
    colorPicker.classList.add('hidden');
    speedPicker.classList.add('hidden');
    difficultyPicker.classList.add('hidden');
    chosenColor = null;
    chosenSpeed = null;
    clearColorSelection();
    clearSpeedSelection();
  }

  refreshStartButton();
}

// ─── Color picker ─────────────────────────────────────────────────────────────
function pickColor(color) {
  chosenColor = color;
  document.getElementById('choiceWhite').classList.toggle('active', color === 'white');
  document.getElementById('choiceBlack').classList.toggle('active', color === 'black');
  refreshStartButton();
}

// ─── Speed picker ─────────────────────────────────────────────────────────────
function pickSpeed(ms) {
  chosenSpeed = ms;
  document.getElementById('speed500').classList.toggle('active', ms === 500);
  document.getElementById('speed1000').classList.toggle('active', ms === 1000);
  document.getElementById('speed1500').classList.toggle('active', ms === 1500);
  document.getElementById('speed2000').classList.toggle('active', ms === 2000);
  refreshStartButton();
}

function clearColorSelection() {
  document.getElementById('choiceWhite').classList.remove('active');
  document.getElementById('choiceBlack').classList.remove('active');
}

function clearSpeedSelection() {
  ['speed500','speed1000','speed1500','speed2000'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );
}

function refreshStartButton() {
  const button = document.getElementById('startButton');
  const isReady =
    chosenMode === 'human' ||
    (chosenMode === 'bot' && chosenColor !== null) ||
    (chosenMode === 'bvb' && chosenSpeed !== null);
  button.disabled = !isReady;
}

// ─── Start ────────────────────────────────────────────────────────────────────
async function startGame() {
  const button = document.getElementById('startButton');
  const originalText = button.textContent;
  button.textContent = 'ENTERING THE BOARD…';
  button.style.opacity = '0.7';
  button.disabled = true;

  try {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: chosenMode,
        difficulty: chosenDifficulty,
        playerColor: chosenColor,
        speed: chosenSpeed,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not create the game.');
    }

    window.location.href = `chess.html?gameId=${data.game.id}`;
  } catch (err) {
    button.textContent = err.message;
    window.setTimeout(() => {
      button.textContent = originalText;
      button.style.opacity = '';
      refreshStartButton();
    }, 1800);
  }
}
