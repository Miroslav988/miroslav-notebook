/**
 * Wolf and eggs, after the Elektronika IM-02 handheld, drawn on the terminal's
 * LCD as segments: active ones dark, inactive ones faintly visible.
 *
 * Chutes: 0 top-left, 1 bottom-left, 2 top-right, 3 bottom-right. An egg rolls
 * through positions 0..3 along a chute; position 4 is the basket (caught) or
 * the ground below it (broken).
 */

const W = 380;
const H = 220;
const CX = W / 2;
const BASKET = [[CX - 60, 112], [CX - 60, 166], [CX + 60, 112], [CX + 60, 166]];
const HEN = [[36, 70], [36, 130], [W - 36, 70], [W - 36, 130]];

const LCD_BG = '#a9b79c';
const LCD_LIGHT = '#b4c2a5';
const ON = '#1c2a1e';
const GHOST = 'rgba(28,42,30,.10)';

const START_TICK = 820;
const MIN_TICK = 340;
const TICK_PER_POINT = 5;
const PENALTY_RESET_AT = [200, 500]; // like the original: misses are forgiven at these scores

const KEY_MAP = { q: 0, a: 1, p: 2, l: 3, w: 0, s: 1, o: 2, k: 3 };

const KEYS_HTML = `
  <button class="key" type="button" data-move="0" aria-label="top left" style="grid-column:1;grid-row:1">◤</button>
  <button class="key" type="button" data-move="1" aria-label="bottom left" style="grid-column:1;grid-row:2">◣</button>
  <button class="key c quit" type="button" data-cmd="quit">QUIT</button>
  <button class="key" type="button" data-move="2" aria-label="top right" style="grid-column:5;grid-row:1">◥</button>
  <button class="key" type="button" data-move="3" aria-label="bottom right" style="grid-column:5;grid-row:2">◢</button>
`;

function eggPosition(chute, p) {
  const [hx, hy] = HEN[chute];
  const [bx, by] = BASKET[chute];
  if (p >= 4) return [bx, by - 4];
  const t = (p + 1) / 5;
  return [hx + (bx - hx) * t, hy + (by - hy) * t + 6];
}

export function initEggGame(terminal) {
  const game = { on: false, wolf: 0, eggs: [], score: 0, miss: 0, tick: START_TICK, timer: 0, caught: null, broken: null, over: false, best: 0 };
  let canvas = null;
  let ctx = null;

  const seg = (active) => {
    ctx.fillStyle = ctx.strokeStyle = active ? ON : GHOST;
  };
  const poly = (points) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  const dot = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  function egg(x, y, active) {
    seg(active);
    ctx.beginPath();
    ctx.ellipse(x, y, 5.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function hen(x, y, faceRight) {
    const d = faceRight ? 1 : -1;
    seg(true);
    poly([[x - d * 14, y + 4], [x - d * 10, y - 6], [x + d * 2, y - 10], [x + d * 14, y - 6], [x + d * 16, y + 2], [x + d * 10, y + 10], [x - d * 8, y + 10]]);
    poly([[x - d * 12, y - 4], [x - d * 22, y - 16], [x - d * 20, y - 2]]); // tail
    dot(x + d * 15, y - 14, 6); // head
    poly([[x + d * 13, y - 22], [x + d * 17, y - 26], [x + d * 20, y - 20]]); // comb
    poly([[x + d * 20, y - 15], [x + d * 28, y - 12], [x + d * 20, y - 10]]); // beak
    ctx.fillStyle = LCD_LIGHT;
    dot(x + d * 16, y - 15, 1.4); // eye
    seg(true);
    ctx.fillRect(x - 5, y + 10, 2.5, 8);
    ctx.fillRect(x + 3, y + 10, 2.5, 8);
  }

  function basket(bx, by, active) {
    seg(active);
    poly([[bx - 20, by - 6], [bx + 20, by - 6], [bx + 15, by + 12], [bx - 15, by + 12]]);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(bx, by - 6, 15, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = LCD_LIGHT;
    ctx.fillRect(bx - 17, by - 3, 34, 1.6);
    ctx.fillRect(bx - 16, by + 3, 32, 1.6);
  }

  // Cap, long snout, jacket, standing tall; the whole body turns to the chosen
  // side, the way the two wolf segments alternate on the real LCD.
  function wolf() {
    const d = game.wolf < 2 ? -1 : 1;
    const x = CX;
    const y = 78;
    seg(true);
    poly([[x - d * 14, y + 6], [x - d * 10, y - 8], [x + d * 6, y - 12], [x + d * 16, y - 6], [x + d * 40, y + 4], [x + d * 42, y + 10], [x + d * 18, y + 14], [x + d * 8, y + 22], [x - d * 8, y + 22]]);
    poly([[x - d * 12, y - 6], [x - d * 20, y - 26], [x - d * 4, y - 12]]); // ear
    poly([[x - d * 18, y - 10], [x + d * 4, y - 20], [x + d * 26, y - 12], [x + d * 30, y - 8], [x - d * 14, y - 4]]); // cap
    poly([[x + d * 22, y - 10], [x + d * 40, y - 4], [x + d * 40, y]]); // visor
    ctx.fillStyle = LCD_LIGHT;
    dot(x + d * 8, y + 2, 2.4); // eye
    ctx.fillRect(x + d * 20, y + 8, 14 * d, 1.6); // mouth
    seg(true);
    poly([[x - d * 6, y + 22], [x + d * 8, y + 22], [x + d * 6, y + 32], [x - d * 4, y + 32]]); // neck
    poly([[x - 28, y + 32], [x + 28, y + 32], [x + 24, y + 96], [x - 24, y + 96]]); // jacket
    ctx.fillStyle = LCD_LIGHT;
    ctx.fillRect(x - 1, y + 40, 2, 50);
    seg(true);
    poly([[x - 22, y + 96], [x - 8, y + 96], [x - 10, y + 124], [x - 30, y + 124], [x - 30, y + 118], [x - 22, y + 116]]);
    poly([[x + 8, y + 96], [x + 22, y + 96], [x + 22, y + 116], [x + 30, y + 118], [x + 30, y + 124], [x + 10, y + 124]]);

    BASKET.forEach(([bx, by], i) => {
      const active = i === game.wolf;
      const side = i < 2 ? -1 : 1;
      const top = i % 2 === 0;
      seg(active);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + side * 24, y + 44);
      ctx.lineTo(bx - side * 12, by + (top ? 2 : -2));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + side * 20, y + 62);
      ctx.lineTo(bx - side * 10, by + 6);
      ctx.stroke();
      basket(bx, by, active);
    });
  }

  function render() {
    if (!ctx) return;
    ctx.fillStyle = LCD_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.font = '600 30px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = GHOST;
    ctx.fillText('8888', CX, 8);
    ctx.fillStyle = ON;
    ctx.fillText(String(game.score).padStart(4, '0'), CX, 8);
    ctx.font = '15px "Patrick Hand", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(game.over ? 'GAME OVER' : 'GAME A', 10, 12);

    for (let i = 0; i < 3; i++) {
      // penalties: chicks in the top-right corner
      const x = W - 70 + i * 24;
      const y = 20;
      seg(i < game.miss);
      dot(x, y + 3, 6);
      dot(x + 6, y - 3, 4);
      poly([[x + 9, y - 3], [x + 14, y - 2], [x + 9, y]]);
    }

    [0, 1, 2, 3].forEach((c) => {
      const [hx, hy] = HEN[c];
      const [bx, by] = BASKET[c];
      const d = c < 2 ? 1 : -1;
      seg(true);
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(hx - d * 12, hy + 18);
      ctx.lineTo(bx - d * 22, by + 4);
      ctx.stroke();
      hen(hx, hy, c < 2);
      for (let p = 0; p < 4; p++) egg(...eggPosition(c, p), false);
    });
    game.eggs.forEach((e) => egg(...eggPosition(e.chute, e.p), true));
    wolf();

    if (game.caught !== null) {
      const [x, y] = eggPosition(game.caught, 4);
      egg(x, y - 6, true);
    }
    if (game.broken !== null) {
      const [bx, by] = BASKET[game.broken];
      const y = by + 24;
      seg(true);
      poly([[bx - 9, y + 6], [bx - 5, y - 3], [bx - 1, y + 2], [bx + 3, y - 4], [bx + 9, y + 6]]);
      dot(bx + 20, y + 2, 5);
      dot(bx + 25, y - 3, 3.5);
    }
    if (game.over) {
      ctx.fillStyle = 'rgba(169,183,156,.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ON;
      ctx.font = '600 34px "VT323", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`GAME OVER ${String(game.score).padStart(4, '0')}`, CX, 92);
    }
    canvas.setAttribute('aria-label', `Wolf and eggs. Score ${game.score}, misses ${game.miss}`);
  }

  function step() {
    if (!game.on) return;
    game.caught = null;
    game.broken = null;
    game.eggs.forEach((e) => e.p++);
    const arrived = game.eggs.filter((e) => e.p >= 4);
    game.eggs = game.eggs.filter((e) => e.p < 4);
    arrived.forEach((e) => {
      if (e.chute === game.wolf) {
        game.score++;
        game.caught = e.chute;
      } else {
        game.miss++;
        game.broken = e.chute;
      }
    });
    if (PENALTY_RESET_AT.includes(game.score)) game.miss = 0;
    if (game.miss >= 3) {
      game.over = true;
      render();
      setTimeout(end, 1300);
      return;
    }

    // One egg on screen at first, then two, then three. A new egg waits until
    // the previous one has rolled away, so two never arrive on the same tick.
    const maxEggs = game.score < 20 ? 1 : game.score < 60 ? 2 : 3;
    const canSpawn = game.eggs.length < maxEggs && game.eggs.every((e) => e.p >= 2);
    if (canSpawn && Math.random() < (game.eggs.length ? 0.45 : 0.7)) {
      const busy = new Set(game.eggs.map((e) => e.chute));
      const free = [0, 1, 2, 3].filter((c) => !busy.has(c));
      if (free.length) game.eggs.push({ chute: free[Math.floor(Math.random() * free.length)], p: 0 });
    }
    game.tick = Math.max(MIN_TICK, START_TICK - game.score * TICK_PER_POINT);
    render();
    game.timer = setTimeout(step, game.tick);
  }

  function move(chute) {
    if (!game.on || game.over) return;
    game.wolf = chute;
    render();
  }

  function start() {
    Object.assign(game, { on: true, wolf: 0, eggs: [], score: 0, miss: 0, tick: START_TICK, caught: null, broken: null, over: false });
    terminal.lock(KEYS_HTML);
    canvas = document.createElement('canvas');
    canvas.className = 'game';
    canvas.width = W * 2;
    canvas.height = H * 2;
    canvas.setAttribute('role', 'img');
    terminal.lcd.appendChild(canvas);
    ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    terminal.keys.querySelectorAll('.key[data-move]').forEach((key) => key.addEventListener('click', () => move(+key.dataset.move)));
    terminal.keys.querySelector('[data-cmd="quit"]').addEventListener('click', end);
    render();
    game.timer = setTimeout(step, game.tick);
  }

  function end() {
    if (!game.on) return;
    clearTimeout(game.timer);
    game.on = false;
    game.best = Math.max(game.best, game.score);
    canvas = null;
    ctx = null;
    terminal.unlock();
    terminal.print([`game over. score ${game.score} · best ${game.best}`, 'type egg to play again']);
  }

  document.addEventListener(
    'keydown',
    (ev) => {
      if (!game.on) return;
      const key = ev.key.toLowerCase();
      const side = game.wolf >= 2 ? 2 : 0;
      const level = game.wolf % 2;
      if (key in KEY_MAP) move(KEY_MAP[key]);
      else if (ev.key === 'ArrowLeft') move(level);
      else if (ev.key === 'ArrowRight') move(2 + level);
      else if (ev.key === 'ArrowUp') move(side);
      else if (ev.key === 'ArrowDown') move(side + 1);
      else if (ev.key === 'Escape') end();
      else return;
      ev.preventDefault();
    },
    true,
  );

  terminal.register(['egg', 'play', 'nu pogodi'], start);
  terminal.gauge('eggs caught, best run', () => game.best);
}
