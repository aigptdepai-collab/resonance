/* ===================== Resonance Game ===================== */
const COLORS = [
  { id: 0, name: 'void',   hex: '#1e1e2e', glow: 'transparent' },
  { id: 1, name: 'violet', hex: '#a78bfa', glow: 'rgba(167,139,250,0.55)' },
  { id: 2, name: 'cyan',   hex: '#67e8f9', glow: 'rgba(103,232,249,0.55)' },
  { id: 3, name: 'rose',   hex: '#fb7185', glow: 'rgba(251,113,133,0.55)' },
  { id: 4, name: 'amber',  hex: '#fbbf24', glow: 'rgba(251,191,36,0.55)' },
  { id: 5, name: 'lime',   hex: '#a3e635', glow: 'rgba(163,230,53,0.55)' },
  { id: 6, name: 'blue',   hex: '#60a5fa', glow: 'rgba(96,165,250,0.55)' },
];

const t = {
  en: {
    tagline: 'Feel the frequency',
    level: 'Level', score: 'Score', moves: 'Moves',
    hint: 'Hint', restart: 'Restart',
    help: 'Tap a crystal to send a pulse. Match 3+ of the same color to clear.',
    complete: 'Level Complete!',
    next: 'Next Level',
    fail: 'Out of Moves',
    retry: 'Try Again',
    great: 'Beautiful resonance!'
  },
  fa: {
    tagline: 'فرکانس را حس کن',
    level: 'مرحله', score: 'امتیاز', moves: 'حرکت',
    hint: 'راهنما', restart: 'شروع مجدد',
    help: 'روی کریستال ضربه بزن تا پالس بفرستی. ۳ تا یا بیشتر هم‌رنگ را پاک کن.',
    complete: 'مرحله تمام شد!',
    next: 'مرحله بعد',
    fail: 'حرکت تمام شد',
    retry: 'دوباره تلاش کن',
    great: 'رزونانس عالی!'
  }
};

let lang = 'en';
let canvas, ctx;
let grid = [];
let cols = 7, rows = 8;
let cellSize = 0;
let offsetX = 0, offsetY = 0;
let score = 0;
let moves = 12;
let level = 1;
let animating = false;
let particles = [];
let pulses = [];
let selected = null;

// Level definitions (simple for now, expandable)
const LEVELS = [
  { moves: 14, colors: [1,2,3], density: 0.75 },
  { moves: 13, colors: [1,2,3,4], density: 0.8 },
  { moves: 12, colors: [1,2,3,4], density: 0.82 },
  { moves: 11, colors: [1,2,3,4,5], density: 0.85 },
  { moves: 10, colors: [1,2,3,4,5,6], density: 0.88 },
];

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', onTap);

  document.getElementById('btn-en').onclick = () => setLang('en');
  document.getElementById('btn-fa').onclick = () => setLang('fa');
  document.getElementById('btn-restart').onclick = () => startLevel(level);
  document.getElementById('btn-hint').onclick = showHint;
  document.getElementById('overlay-btn').onclick = nextLevel;

  setLang('en');
  startLevel(1);
  requestAnimationFrame(loop);
}

function setLang(l) {
  lang = l;
  document.body.classList.toggle('fa', l === 'fa');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');
  document.getElementById('btn-fa').classList.toggle('active', l === 'fa');

  const tr = t[l];
  document.getElementById('tagline').textContent = tr.tagline;
  document.getElementById('label-level').textContent = tr.level;
  document.getElementById('label-score').textContent = tr.score;
  document.getElementById('label-moves').textContent = tr.moves;
  document.getElementById('hint-text').textContent = tr.hint;
  document.getElementById('restart-text').textContent = tr.restart;
  document.getElementById('help').textContent = tr.help;
}

function resize() {
  const wrap = document.getElementById('canvas-wrap');
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  // Fit grid
  const pad = 16;
  cellSize = Math.min(
    Math.floor((w - pad * 2) / cols),
    Math.floor((h - pad * 2) / rows)
  );
  offsetX = (w - cols * cellSize) / 2;
  offsetY = (h - rows * cellSize) / 2;
}

function startLevel(n) {
  level = n;
  const conf = LEVELS[Math.min(n - 1, LEVELS.length - 1)];
  moves = conf.moves;
  score = n === 1 ? 0 : score; // keep score across levels
  animating = false;
  particles = [];
  pulses = [];
  selected = null;

  // Generate grid
  grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      if (Math.random() < conf.density) {
        const c = conf.colors[Math.floor(Math.random() * conf.colors.length)];
        grid[y][x] = { color: c, charge: 0, pulse: 0 };
      } else {
        grid[y][x] = { color: 0, charge: 0, pulse: 0 };
      }
    }
  }

  updateUI();
  hideOverlay();
}

function updateUI() {
  document.getElementById('level').textContent = level;
  document.getElementById('score').textContent = score;
  document.getElementById('moves').textContent = moves;
}

function onTap(e) {
  if (animating || moves <= 0) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const x = Math.floor((mx - offsetX) / cellSize);
  const y = Math.floor((my - offsetY) / cellSize);

  if (x < 0 || x >= cols || y < 0 || y >= rows) return;
  if (grid[y][x].color === 0) return;

  // Send pulse
  moves--;
  updateUI();
  sendPulse(x, y);
}

function sendPulse(sx, sy) {
  animating = true;
  const originColor = grid[sy][sx].color;

  // Directions: up right down left
  const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
  const visited = new Set();
  const queue = [];

  // Start from neighbors
  dirs.forEach(([dx, dy], i) => {
    queue.push({ x: sx + dx, y: sy + dy, dir: i, dist: 1 });
  });

  // Visual pulse from center
  pulses.push({
    x: sx, y: sy, r: 0, maxR: cellSize * 1.8,
    color: COLORS[originColor].hex, life: 1
  });

  let step = 0;
  const interval = setInterval(() => {
    step++;
    if (queue.length === 0 || step > 12) {
      clearInterval(interval);
      setTimeout(() => {
        resolveCharges();
        animating = false;
        checkWinLose();
      }, 220);
      return;
    }

    const nextQueue = [];
    const current = [...queue];
    queue.length = 0;

    current.forEach(p => {
      const key = p.x + ',' + p.y;
      if (visited.has(key)) return;
      if (p.x < 0 || p.x >= cols || p.y < 0 || p.y >= rows) return;

      const cell = grid[p.y][p.x];
      if (cell.color === 0) return;

      visited.add(key);

      // Charge if same color
      if (cell.color === originColor) {
        cell.charge = Math.min(cell.charge + 1, 3);
        cell.pulse = 1;

        // Continue wave
        const [dx, dy] = dirs[p.dir];
        nextQueue.push({ x: p.x + dx, y: p.y + dy, dir: p.dir, dist: p.dist + 1 });
      }

      // Visual
      pulses.push({
        x: p.x, y: p.y, r: 0, maxR: cellSize * 0.7,
        color: COLORS[cell.color].hex, life: 0.9
      });
    });

    queue.push(...nextQueue);
  }, 55);
}

function resolveCharges() {
  let cleared = 0;
  const toClear = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      if (cell.charge >= 1) {
        // Count connected charged same color
        // Simple: any charged cell of same color group clears if >=3 total charged of that color
      }
    }
  }

  // Better: find groups of charged cells
  const chargedByColor = {};
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      if (cell.charge > 0 && cell.color > 0) {
        if (!chargedByColor[cell.color]) chargedByColor[cell.color] = [];
        chargedByColor[cell.color].push({x, y});
      }
    }
  }

  Object.keys(chargedByColor).forEach(col => {
    const list = chargedByColor[col];
    if (list.length >= 3) {
      list.forEach(({x, y}) => {
        toClear.push({x, y, color: grid[y][x].color});
        grid[y][x] = { color: 0, charge: 0, pulse: 0 };
        cleared++;
      });
    } else {
      // Reset charge if not enough
      list.forEach(({x, y}) => {
        grid[y][x].charge = 0;
        grid[y][x].pulse = 0;
      });
    }
  });

  // Particles + score
  toClear.forEach(p => {
    spawnParticles(p.x, p.y, COLORS[p.color].hex);
  });

  if (cleared > 0) {
    const points = cleared * 10 + (cleared > 5 ? cleared * 5 : 0);
    score += points;
    updateUI();
  }

  // Apply gravity
  applyGravity();
}

function applyGravity() {
  for (let x = 0; x < cols; x++) {
    let write = rows - 1;
    for (let y = rows - 1; y >= 0; y--) {
      if (grid[y][x].color !== 0) {
        if (write !== y) {
          grid[write][x] = grid[y][x];
          grid[y][x] = { color: 0, charge: 0, pulse: 0 };
        }
        write--;
      }
    }
  }
}

function spawnParticles(gx, gy, color) {
  const cx = offsetX + gx * cellSize + cellSize / 2;
  const cy = offsetY + gy * cellSize + cellSize / 2;
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 1,
      life: 1,
      color,
      size: Math.random() * 3 + 1.5
    });
  }
}

function checkWinLose() {
  // Win if almost empty
  let remaining = 0;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x].color !== 0) remaining++;

  if (remaining <= 4) {
    showOverlay(true);
    return;
  }
  if (moves <= 0) {
    showOverlay(false);
  }
}

function showOverlay(win) {
  const ov = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const desc = document.getElementById('overlay-desc');
  const btn = document.getElementById('overlay-btn');

  if (win) {
    title.textContent = t[lang].complete;
    desc.textContent = t[lang].great;
    btn.textContent = t[lang].next;
    btn.onclick = nextLevel;
  } else {
    title.textContent = t[lang].fail;
    desc.textContent = '';
    btn.textContent = t[lang].retry;
    btn.onclick = () => startLevel(level);
  }
  ov.classList.remove('hidden');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

function nextLevel() {
  startLevel(level + 1);
}

function showHint() {
  // Simple: highlight a cell that has potential
  // For now just a visual pulse on a random colored cell
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x].color > 0) {
        pulses.push({
          x, y, r: 0, maxR: cellSize * 1.2,
          color: '#ffffff', life: 0.7
        });
        return;
      }
    }
  }
}

/* ===================== Render Loop ===================== */
function loop() {
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, w, h);

  // Background subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(offsetX + x * cellSize, offsetY);
    ctx.lineTo(offsetX + x * cellSize, offsetY + rows * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + y * cellSize);
    ctx.lineTo(offsetX + cols * cellSize, offsetY + y * cellSize);
    ctx.stroke();
  }

  // Cells
  const gap = 4;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      if (cell.color === 0) continue;

      const px = offsetX + x * cellSize + gap / 2;
      const py = offsetY + y * cellSize + gap / 2;
      const size = cellSize - gap;
      const c = COLORS[cell.color];

      // Glow
      if (cell.charge > 0 || cell.pulse > 0) {
        ctx.shadowColor = c.glow;
        ctx.shadowBlur = 18 + cell.charge * 8;
      } else {
        ctx.shadowBlur = 0;
      }

      // Crystal shape (rounded rect with slight 3d)
      ctx.fillStyle = c.hex;
      roundRect(ctx, px, py, size, size, 10);
      ctx.fill();

      // Inner highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, px + 3, py + 3, size * 0.4, size * 0.25, 4);
      ctx.fill();

      // Charge indicator
      if (cell.charge > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(px + size / 2, py + size / 2, 3 + cell.charge, 0, Math.PI * 2);
        ctx.fill();
      }

      cell.pulse = Math.max(0, cell.pulse - 0.08);
    }
  }

  // Pulses
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.r += (p.maxR - p.r) * 0.18;
    p.life -= 0.04;

    ctx.beginPath();
    ctx.arc(
      offsetX + p.x * cellSize + cellSize / 2,
      offsetY + p.y * cellSize + cellSize / 2,
      p.r, 0, Math.PI * 2
    );
    ctx.strokeStyle = p.color + Math.floor(p.life * 180).toString(16).padStart(2, '0');
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (p.life <= 0) pulses.splice(i, 1);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 0.025;

    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (p.life <= 0) particles.splice(i, 1);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Start
init();