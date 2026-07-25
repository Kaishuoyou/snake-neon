/**
 * Snake Neon — Game Logic
 * Features: Canvas rendering, Guest Login, LocalStorage data, Leaderboard
 */

// ============================================================
// CONSTANTS & CONFIG
// ============================================================
const GRID_SIZE    = 20;    // cells per row/col
const CELL_SIZE    = 20;    // px per cell (canvas 400x400)
const INIT_SPEED   = 150;   // ms per tick (lower = faster)
const SPEED_STEP   = 8;     // ms reduction per level up
const MIN_SPEED    = 60;    // fastest possible
const FOOD_PER_LEVEL = 5;   // food eaten to level up
const MAX_RECORDS  = 10;    // leaderboard entries to keep
const STORAGE_KEY  = 'snakeNeonData';

// Canvas gradient colors for snake
const SNAKE_HEAD_COLOR   = '#06b6d4';
const SNAKE_TAIL_COLOR   = '#d946ef';
const FOOD_COLOR         = '#fbbf24';
const GRID_LINE_COLOR    = 'rgba(255,255,255,0.03)';

// Directions
const DIR = {
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x: 1,  y:  0 },
};

// ============================================================
// STATE
// ============================================================
let state = {
  player:        null,         // current player name
  sessionStart:  null,         // Date of login
  snake:         [],
  dir:           DIR.RIGHT,
  nextDir:       DIR.RIGHT,
  food:          null,
  score:         0,
  level:         1,
  foodEaten:     0,
  gameRunning:   false,
  gamePaused:    false,
  gameOver:      false,
  loopTimer:     null,
  durationTimer: null,
  elapsedSec:    0,
  foodAngle:     0,            // for food spin animation
  foodPulse:     0,            // for food pulse animation
  animFrame:     null,
};

// ============================================================
// DOM REFERENCES
// ============================================================
const $ = id => document.getElementById(id);

const loginScreen    = $('login-screen');
const gameScreen     = $('game-screen');
const nicknameInput  = $('nickname-input');
const inputHint      = $('input-hint');
const startLoginBtn  = $('start-login-btn');
const loginStats     = $('login-stats');
const loginHighscore = $('login-highscore');
const loginGames     = $('login-games');

const playerName     = $('player-name');
const playerAvatar   = $('player-avatar');
const currentScore   = $('current-score');
const highScore      = $('high-score');
const currentLevel   = $('current-level');
const foodEatenEl    = $('food-eaten');
const sessionTime    = $('session-time');
const gameDuration   = $('game-duration');

const startBtn       = $('start-btn');
const pauseBtn       = $('pause-btn');
const resetBtn       = $('reset-btn');
const switchPlayerBtn = $('switch-player-btn');

const canvas         = $('game-canvas');
const ctx            = canvas.getContext('2d');
const canvasOverlay  = $('canvas-overlay');
const overlayContent = $('overlay-content');

const leaderboardList = $('leaderboard-list');
const totalGamesEl    = $('total-games');
const totalTimeEl     = $('total-time');
const clearRecordsBtn = $('clear-records-btn');
const scorePopContainer = $('score-pop-container');

// ============================================================
// LOCAL STORAGE
// ============================================================
function loadData(player) {
  const raw = localStorage.getItem(`${STORAGE_KEY}_${player}`);
  if (!raw) return { highScore: 0, totalGames: 0, totalTimeSec: 0, records: [] };
  return JSON.parse(raw);
}

function saveData(player, data) {
  localStorage.setItem(`${STORAGE_KEY}_${player}`, JSON.stringify(data));
}

function saveLastPlayer(name) {
  localStorage.setItem(`${STORAGE_KEY}_lastPlayer`, name);
}

function getLastPlayer() {
  return localStorage.getItem(`${STORAGE_KEY}_lastPlayer`) || '';
}

function addRecord(player, score, level, durationSec) {
  const data = loadData(player);
  const record = {
    score,
    level,
    durationSec,
    date: formatDateShort(new Date()),
    loginTime: state.sessionStart ? formatDateTime(state.sessionStart) : '--',
  };
  data.records.unshift(record);
  if (data.records.length > MAX_RECORDS) data.records.length = MAX_RECORDS;
  if (score > data.highScore) data.highScore = score;
  data.totalGames += 1;
  data.totalTimeSec += durationSec;
  saveData(player, data);
  return data;
}

// ============================================================
// DATE / TIME HELPERS
// ============================================================
function formatTime(date) {
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateTime(date) {
  return date.toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function formatDateShort(date) {
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(sec) {
  const m = Math.round(sec / 60);
  return `${m} 分鐘`;
}

// ============================================================
// LOGIN SCREEN LOGIC
// ============================================================
function initLoginScreen() {
  const last = getLastPlayer();
  if (last) {
    nicknameInput.value = last;
    showLoginStats(last);
  }
  nicknameInput.focus();
}

function showLoginStats(name) {
  const data = loadData(name);
  if (data.totalGames > 0) {
    loginHighscore.textContent = data.highScore;
    loginGames.textContent     = data.totalGames;
    loginStats.style.display   = 'flex';
  } else {
    loginStats.style.display = 'none';
  }
}

function validateAndLogin() {
  const name = nicknameInput.value.trim();
  if (!name) {
    showInputError('請輸入暱稱！');
    return;
  }
  if (name.length > 12) {
    showInputError('暱稱最多 12 字元');
    return;
  }
  clearInputError();
  loginPlayer(name);
}

function showInputError(msg) {
  inputHint.textContent = msg;
  nicknameInput.classList.add('error');
}

function clearInputError() {
  inputHint.textContent = '';
  nicknameInput.classList.remove('error');
}

function loginPlayer(name) {
  state.player       = name;
  state.sessionStart = new Date();
  saveLastPlayer(name);

  playerName.textContent   = name;
  sessionTime.textContent  = formatTime(state.sessionStart);

  const data = loadData(name);
  highScore.textContent = data.highScore;

  updateLeaderboard();
  updateTotalStats();
  switchScreen(loginScreen, gameScreen);
  initGame();
  showOverlay('ready');
}

// ============================================================
// SCREEN SWITCHING
// ============================================================
function switchScreen(from, to) {
  from.classList.remove('active');
  to.classList.add('active');
}

// ============================================================
// GAME INITIALIZATION
// ============================================================
function initGame() {
  clearTimers();

  state.snake     = [
    { x: 10, y: 10 },
    { x: 9,  y: 10 },
    { x: 8,  y: 10 },
  ];
  state.dir        = DIR.RIGHT;
  state.nextDir    = DIR.RIGHT;
  state.score      = 0;
  state.level      = 1;
  state.foodEaten  = 0;
  state.gameRunning = false;
  state.gamePaused  = false;
  state.gameOver    = false;
  state.elapsedSec  = 0;
  state.food = spawnFood();

  updateScoreUI();
  updateLevelUI();
  renderFrame();

  startBtn.textContent = '開始';
  startBtn.disabled    = false;
  pauseBtn.disabled    = true;
  gameDuration.textContent = '0:00';
}

// ============================================================
// GAME LOOP
// ============================================================
function startGame() {
  if (state.gameRunning && !state.gamePaused) return;

  if (state.gameOver) {
    initGame();
    showOverlay('ready');
    return;
  }

  state.gameRunning = true;
  state.gamePaused  = false;
  hideOverlay();

  startBtn.textContent = '重新開始';
  pauseBtn.disabled    = false;

  scheduleNextTick();
  startDurationTimer();
  renderLoop();
}

function pauseGame() {
  if (!state.gameRunning || state.gameOver) return;
  state.gamePaused = !state.gamePaused;

  if (state.gamePaused) {
    clearTimers();
    pauseBtn.textContent = '繼續';
    showOverlay('paused');
  } else {
    pauseBtn.textContent = '暫停';
    hideOverlay();
    scheduleNextTick();
    startDurationTimer();
    renderLoop();
  }
}

function resetGame() {
  clearTimers();
  if (state.animFrame) { cancelAnimationFrame(state.animFrame); state.animFrame = null; }
  initGame();
  hideOverlay();
  showOverlay('ready');
}

function scheduleNextTick() {
  if (state.loopTimer) clearTimeout(state.loopTimer);
  const speed = Math.max(MIN_SPEED, INIT_SPEED - (state.level - 1) * SPEED_STEP);
  state.loopTimer = setTimeout(gameTick, speed);
}

function gameTick() {
  if (!state.gameRunning || state.gamePaused || state.gameOver) return;

  moveSnake();

  if (checkWallCollision() || checkSelfCollision()) {
    endGame();
    return;
  }

  if (state.snake[0].x === state.food.x && state.snake[0].y === state.food.y) {
    eatFood();
  } else {
    state.snake.pop();
  }

  scheduleNextTick();
}

function renderLoop() {
  if (!state.gameRunning || state.gamePaused || state.gameOver) return;
  renderFrame();
  state.animFrame = requestAnimationFrame(renderLoop);
}

function startDurationTimer() {
  if (state.durationTimer) clearInterval(state.durationTimer);
  state.durationTimer = setInterval(() => {
    state.elapsedSec++;
    gameDuration.textContent = formatDuration(state.elapsedSec);
  }, 1000);
}

function clearTimers() {
  if (state.loopTimer)    { clearTimeout(state.loopTimer);     state.loopTimer = null; }
  if (state.durationTimer){ clearInterval(state.durationTimer); state.durationTimer = null; }
}

// ============================================================
// SNAKE MOVEMENT & COLLISION
// ============================================================
function moveSnake() {
  state.dir = state.nextDir;
  const head = state.snake[0];
  const newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };
  state.snake.unshift(newHead);
}

function checkWallCollision() {
  const { x, y } = state.snake[0];
  return x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE;
}

function checkSelfCollision() {
  const head = state.snake[0];
  return state.snake.slice(1).some(seg => seg.x === head.x && seg.y === head.y);
}

// ============================================================
// FOOD
// ============================================================
function spawnFood() {
  let pos;
  const occupied = new Set(state.snake.map(s => `${s.x},${s.y}`));
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

function eatFood() {
  state.score     += 10;
  state.foodEaten += 1;

  // Level up check
  if (state.foodEaten % FOOD_PER_LEVEL === 0) {
    state.level++;
    updateLevelUI();
    showLevelUpPop();
  }

  state.food = spawnFood();
  updateScoreUI();
  showScorePop('+10');

  const data = loadData(state.player);
  if (state.score > data.highScore) {
    highScore.textContent = state.score;
  }
}

// ============================================================
// GAME OVER
// ============================================================
function endGame() {
  state.gameRunning = false;
  state.gameOver    = true;
  clearTimers();
  if (state.animFrame) { cancelAnimationFrame(state.animFrame); state.animFrame = null; }

  renderFrame(); // draw final frame

  // Screen shake effect
  const wrapper = canvas.closest('.canvas-wrapper');
  wrapper.classList.remove('shake');
  void wrapper.offsetWidth; // force reflow to restart animation
  wrapper.classList.add('shake');
  wrapper.addEventListener('animationend', () => wrapper.classList.remove('shake'), { once: true });

  const data = addRecord(state.player, state.score, state.level, state.elapsedSec);
  highScore.textContent = data.highScore;
  updateLeaderboard();
  updateTotalStats();
  showOverlay('gameover');

  pauseBtn.disabled    = true;
  startBtn.textContent = '再玩一次';
}

// ============================================================
// UI UPDATES
// ============================================================
function updateScoreUI() {
  const scoreEl = currentScore;
  scoreEl.textContent = state.score;
  foodEatenEl.textContent = state.foodEaten;

  // Pulse animation
  scoreEl.classList.remove('pulse-anim');
  void scoreEl.offsetWidth; // reflow
  scoreEl.classList.add('pulse-anim');
}

function updateLevelUI() {
  currentLevel.textContent = state.level;
}

function updateLeaderboard() {
  const data = loadData(state.player);
  if (!data.records.length) {
    leaderboardList.innerHTML = '<div class="leaderboard-empty">尚無記錄<br/>快來挑戰吧！</div>';
    return;
  }

  leaderboardList.innerHTML = data.records.map((r, i) => `
    <div class="leaderboard-row ${i === 0 ? 'top-1' : ''}">
      <span class="lb-rank ${i === 0 ? 'gold' : ''}">${i === 0 ? '🥇' : i + 1}</span>
      <span class="lb-score">${r.score}</span>
      <span class="lb-level">Lv.${r.level}</span>
      <span class="lb-date">${r.date}</span>
    </div>
  `).join('');
}

function updateTotalStats() {
  const data = loadData(state.player);
  totalGamesEl.textContent = `${data.totalGames} 局`;
  totalTimeEl.textContent  = formatMinutes(data.totalTimeSec);
}

// ============================================================
// OVERLAY
// ============================================================
function showOverlay(type) {
  let html = '';
  if (type === 'ready') {
    html = `
      <div class="overlay-title gradient-text">準備好了嗎？</div>
      <div class="overlay-score">按下「開始」或 <kbd class="key" style="color:#fff">Space</kbd> 出發！</div>
      <div style="color:var(--color-text-muted);font-size:0.8rem;">WASD 或方向鍵移動</div>
    `;
  } else if (type === 'paused') {
    html = `
      <div class="overlay-title gradient-text">遊戲暫停</div>
      <div class="overlay-score">按 <kbd class="key" style="color:#fff">Space</kbd> 繼續</div>
    `;
  } else if (type === 'gameover') {
    html = `
      <div class="overlay-title" style="color:var(--color-danger);text-shadow:0 0 20px rgba(244,63,94,0.6)">遊戲結束</div>
      <div class="overlay-score">最終分數：<strong>${state.score}</strong></div>
      <div style="color:var(--color-text-muted);font-size:0.82rem;margin-bottom:16px;">等級 ${state.level}・${formatDuration(state.elapsedSec)}</div>
      <button class="btn btn-primary" onclick="startGame()" style="margin:0 auto;">再玩一次</button>
    `;
  }
  overlayContent.innerHTML = html;
  canvasOverlay.classList.add('visible');
}

function hideOverlay() {
  canvasOverlay.classList.remove('visible');
}

// ============================================================
// SCORE POP ANIMATIONS
// ============================================================
function showScorePop(text) {
  const rect = canvas.getBoundingClientRect();
  const head = state.snake[0];
  const pop  = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = text;
  pop.style.left = `${rect.left + head.x * CELL_SIZE + CELL_SIZE / 2}px`;
  pop.style.top  = `${rect.top  + head.y * CELL_SIZE}px`;
  scorePopContainer.appendChild(pop);
  setTimeout(() => pop.remove(), 1000);
}

function showLevelUpPop() {
  const rect = canvas.getBoundingClientRect();
  const pop  = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = `⬆ Level ${state.level}!`;
  pop.style.left  = `${rect.left + rect.width / 2}px`;
  pop.style.top   = `${rect.top  + rect.height / 2}px`;
  pop.style.color = '#d946ef';
  pop.style.fontSize = '1.5rem';
  scorePopContainer.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

// ============================================================
// CANVAS RENDERING
// ============================================================
function renderFrame() {
  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#080e1f';
  ctx.fillRect(0, 0, W, H);

  drawGrid();
  drawFood();
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth   = 0.5;
  for (let x = 0; x <= GRID_SIZE; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE, 0);
    ctx.lineTo(x * CELL_SIZE, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_SIZE; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL_SIZE);
    ctx.lineTo(canvas.width, y * CELL_SIZE);
    ctx.stroke();
  }
}

function drawFood() {
  if (!state.food) return;

  state.foodAngle  += 0.06;
  state.foodPulse   = Math.sin(state.foodAngle * 2) * 2;

  const fx = state.food.x * CELL_SIZE + CELL_SIZE / 2;
  const fy = state.food.y * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE / 2 - 2 + state.foodPulse;

  // Glow
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius * 2.5);
  glow.addColorStop(0,   'rgba(251, 191, 36, 0.35)');
  glow.addColorStop(1,   'rgba(251, 191, 36, 0)');
  ctx.beginPath();
  ctx.arc(fx, fy, radius * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Core circle
  const grad = ctx.createRadialGradient(fx - 2, fy - 2, 0, fx, fy, radius);
  grad.addColorStop(0, '#fff6c0');
  grad.addColorStop(0.4, FOOD_COLOR);
  grad.addColorStop(1,   '#d97706');
  ctx.beginPath();
  ctx.arc(fx, fy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Shine
  ctx.beginPath();
  ctx.arc(fx - 2, fy - 2, radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

function drawSnake() {
  const len = state.snake.length;
  if (!len) return;

  state.snake.forEach((seg, i) => {
    const ratio   = i / Math.max(len - 1, 1);
    const color   = lerpColor(SNAKE_HEAD_COLOR, SNAKE_TAIL_COLOR, ratio);
    const px      = seg.x * CELL_SIZE;
    const py      = seg.y * CELL_SIZE;
    const padding = i === 0 ? 1 : 2;
    const size    = CELL_SIZE - padding * 2;

    ctx.save();
    // Glow for head
    if (i === 0) {
      ctx.shadowColor = SNAKE_HEAD_COLOR;
      ctx.shadowBlur  = 10;
    }

    const r = i === 0 ? 5 : 4;
    roundRect(ctx, px + padding, py + padding, size, size, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Eyes on head
    if (i === 0) drawEyes(seg);
  });
}

function drawEyes(head) {
  const d = state.dir;
  const cx = head.x * CELL_SIZE + CELL_SIZE / 2;
  const cy = head.y * CELL_SIZE + CELL_SIZE / 2;
  const eyeR = 2;
  const dist = 4;

  let e1, e2;
  if (d === DIR.RIGHT) { e1 = { x: cx + 3, y: cy - dist }; e2 = { x: cx + 3, y: cy + dist }; }
  else if (d === DIR.LEFT)  { e1 = { x: cx - 3, y: cy - dist }; e2 = { x: cx - 3, y: cy + dist }; }
  else if (d === DIR.UP)    { e1 = { x: cx - dist, y: cy - 3 }; e2 = { x: cx + dist, y: cy - 3 }; }
  else                       { e1 = { x: cx - dist, y: cy + 3 }; e2 = { x: cx + dist, y: cy + 3 }; }

  [e1, e2].forEach(e => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(e.x + 0.5, e.y + 0.5, eyeR * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#0f162a';
    ctx.fill();
  });
}

// ============================================================
// HELPERS
// ============================================================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lerpColor(c1, c2, t) {
  const p = (c) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

// ============================================================
// INPUT HANDLING
// ============================================================
const KEY_MAP = {
  ArrowUp:    DIR.UP,
  ArrowDown:  DIR.DOWN,
  ArrowLeft:  DIR.LEFT,
  ArrowRight: DIR.RIGHT,
  KeyW:       DIR.UP,
  KeyS:       DIR.DOWN,
  KeyA:       DIR.LEFT,
  KeyD:       DIR.RIGHT,
};

const OPPOSITE = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

function getDirName(dir) {
  return Object.keys(DIR).find(k => DIR[k] === dir);
}

document.addEventListener('keydown', (e) => {
  // Space: pause/start
  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.gameRunning || state.gameOver) startGame();
    else pauseGame();
    return;
  }

  // Arrow keys / WASD — use e.code for reliable detection
  const newDir = KEY_MAP[e.code];
  if (!newDir) return;

  // Prevent default scroll behavior
  e.preventDefault();

  if (!state.gameRunning || state.gamePaused || state.gameOver) return;

  const currentName = getDirName(state.dir);
  const newName     = getDirName(newDir);
  if (OPPOSITE[currentName] !== newName) {
    state.nextDir = newDir;
  }
});

// Touch swipe support
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

  let newDir;
  if (Math.abs(dx) > Math.abs(dy)) {
    newDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
  } else {
    newDir = dy > 0 ? DIR.DOWN : DIR.UP;
  }

  const currentName = getDirName(state.dir);
  const newName     = getDirName(newDir);
  if (!state.gameOver && !state.gamePaused && OPPOSITE[currentName] !== newName) {
    state.nextDir = newDir;
  }
  e.preventDefault();
}, { passive: false });

// ============================================================
// BUTTON EVENT LISTENERS
// ============================================================
startLoginBtn.addEventListener('click', validateAndLogin);

nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') validateAndLogin();
  clearInputError();
});

nicknameInput.addEventListener('input', () => {
  clearInputError();
  const name = nicknameInput.value.trim();
  if (name) showLoginStats(name);
  else loginStats.style.display = 'none';
});

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
resetBtn.addEventListener('click', resetGame);

switchPlayerBtn.addEventListener('click', () => {
  clearTimers();
  if (state.animFrame) { cancelAnimationFrame(state.animFrame); state.animFrame = null; }
  state.gameRunning = false;
  state.gameOver    = false;
  switchScreen(gameScreen, loginScreen);
  const last = getLastPlayer();
  nicknameInput.value = last;
  clearInputError();
  if (last) showLoginStats(last);
});

clearRecordsBtn.addEventListener('click', () => {
  if (!state.player) return;
  if (confirm(`確定要清除「${state.player}」的所有記錄嗎？`)) {
    localStorage.removeItem(`${STORAGE_KEY}_${state.player}`);
    highScore.textContent = 0;
    updateLeaderboard();
    updateTotalStats();
  }
});

// ============================================================
// BOOT
// ============================================================
initLoginScreen();
renderFrame(); // draw empty canvas at load
