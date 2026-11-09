'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

let started = false;
let combo = 0;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
    combo++;
    if (combo > records.bestCombo) records.bestCombo = combo;
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  recordsOnGameOver();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  combo = 0;
  startOverlay.classList.add('hidden');
  overBox.classList.add('hidden');
  nameForm.classList.add('hidden');
  pendingRank = -1;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // No actuar mientras se escribe en un campo de texto
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  // Pantalla de inicio: solo Enter (si no es un botón, que ya lo gestiona su click)
  if (!started) {
    if (e.code === 'Enter' && e.target.tagName !== 'BUTTON') init();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// Tema: siempre inicia en oscuro; no se persiste.
function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  themeToggle.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  // Redibuja los canvas aunque el juego esté en pausa o terminado
  if (current) {
    draw();
    drawNext();
  }
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space (caída) active el botón
});

// ---- Records (localStorage) ----
const RECORDS_KEY = 'tetris.records';
const MAX_TOP = 5;
const startOverlay = document.getElementById('start-overlay');
const playBtn = document.getElementById('play-btn');
const overBox = document.getElementById('over-records-box');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
let pendingRank = -1; // posición (0-based) de la partida en el top pendiente de nombre; -1 si ninguna

function loadRecords() {
  const rec = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && typeof data === 'object') {
      if (Array.isArray(data.top)) {
        rec.top = data.top
          .filter(t => t && Number.isFinite(t.score))
          .map(t => ({ name: String(t.name ?? '').slice(0, 12), score: t.score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_TOP);
      }
      rec.bestCombo = Number.isFinite(data.bestCombo) ? data.bestCombo : 0;
      rec.maxLines = Number.isFinite(data.maxLines) ? data.maxLines : 0;
    }
  } catch (e) { /* localStorage no disponible o JSON inválido */ }
  return rec;
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) { /* ignorar */ }
}

let records = loadRecords();

// Posición que ocuparía la puntuación s en el top, o -1 si no entra
function rankFor(s) {
  if (s <= 0) return -1;
  let i = records.top.findIndex(t => s > t.score);
  if (i === -1) i = records.top.length;
  return i < MAX_TOP ? i : -1;
}

// highlight: índice de fila a resaltar (-1 ninguna). preview: inserta fila provisional "Tú".
function renderRecords(el, highlight, preview) {
  el.textContent = '';
  const rows = records.top.slice();
  if (preview && highlight >= 0) rows.splice(highlight, 0, { name: 'Tú', score });
  rows.length = Math.min(rows.length, MAX_TOP);
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'records-empty';
    p.textContent = 'Aún no hay records';
    el.appendChild(p);
    return;
  }
  rows.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'records-row' + (i === highlight ? ' highlight' : '');
    for (const [cls, txt] of [['rk', i + 1], ['nm', t.name || 'Anónimo'], ['sc', t.score.toLocaleString()]]) {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = txt;
      row.appendChild(s);
    }
    el.appendChild(row);
  });
}

function renderStats(el) {
  el.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx.: ${records.maxLines}`;
}

function renderStart() {
  renderRecords(document.getElementById('start-records'), -1, false);
  renderStats(document.getElementById('start-stats'));
}

function renderOver(highlight, preview) {
  renderRecords(document.getElementById('over-records'), highlight, preview);
  renderStats(document.getElementById('over-stats'));
}

function recordsOnGameOver() {
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords();
  pendingRank = rankFor(score);
  overBox.classList.remove('hidden');
  if (pendingRank >= 0) {
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    renderOver(pendingRank, true);
    nameInput.focus();
  } else {
    nameForm.classList.add('hidden');
    renderOver(-1, false);
  }
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (pendingRank < 0) return;
  const name = nameInput.value.trim().slice(0, 12) || 'Anónimo';
  const rank = pendingRank;
  pendingRank = -1;
  records.top.splice(rank, 0, { name, score });
  records.top.length = Math.min(records.top.length, MAX_TOP);
  saveRecords();
  nameForm.classList.add('hidden');
  renderOver(rank, false);
  restartBtn.focus();
});

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  records = { top: [], bestCombo: 0, maxLines: 0 };
  saveRecords();
  renderStart();
  if (!overBox.classList.contains('hidden')) {
    if (pendingRank >= 0) {
      pendingRank = rankFor(score);
      if (pendingRank < 0) nameForm.classList.add('hidden');
      renderOver(pendingRank, true);
    } else {
      renderOver(-1, false);
    }
  }
}

document.getElementById('start-reset-btn').addEventListener('click', resetRecords);
document.getElementById('over-reset-btn').addEventListener('click', resetRecords);
playBtn.addEventListener('click', init);

renderStart();
applyTheme('dark');
playBtn.focus();
