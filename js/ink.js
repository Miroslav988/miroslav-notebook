/**
 * Drawing layer and pencil case.
 *
 * There is one drawing surface over the sheet and one over every taped-in
 * printout. A stroke belongs to the surface it started on, so ink drawn on a
 * printout moves with that printout. Strokes are stored in fractions of their
 * surface's width and survive a resize. Nothing is persisted.
 *
 * The eraser is a real eraser: it paints paper back over whatever is under it,
 * ruled paper on the sheet, plain paper on a printout, so text, doodles and
 * drawings alike can be rubbed out.
 */

const TOOLS = {
  pencil: { color: 'rgba(59,58,54,.85)', width: 2.2, composite: 'source-over', jitter: 0.6 },
  pen: { color: '#2857c9', width: 3.4, composite: 'source-over', jitter: 0 },
  red: { color: '#d3372b', width: 3.4, composite: 'source-over', jitter: 0 },
  hl: { color: 'rgba(255,233,77,.55)', width: 22, composite: 'multiply', jitter: 0 },
  eraser: { paper: true, width: 30, composite: 'source-over', jitter: 0 },
};

const HINTS = {
  pencil: 'Pencil. Draw anywhere on the page. Esc to put it back.',
  pen: 'Blue marker. Esc to put it back.',
  red: 'Red marker. Esc to put it back.',
  hl: 'Highlighter. Try it on a sentence.',
  eraser: 'Eraser. It rubs out anything: text, drawings, the lot. Z undoes.',
};

const SHORTCUTS = { 1: 'pencil', 2: 'pen', 3: 'red', 4: 'hl', 5: 'eraser' };
const MAX_STROKES = 600;
const BASE_WIDTH = 960;

// the sheet's ruling and grain, so the eraser can paint them back
const PAPER = { color: '#f5f1e6', line: '#c3cfdb', lineEvery: 32, lineAt: 13, margin: '#d98b86', marginX: 62 };
const PRINTOUT = '#fffdf7';
const GRAIN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
const grain = new Image();
grain.src = `data:image/svg+xml;utf8,${encodeURIComponent(GRAIN_SVG)}`;

export function createInk(sheet) {
  const buttons = [...document.querySelectorAll('.tool[data-tool]')];
  const hint = document.getElementById('hint');
  const surfaces = [];
  let strokes = [];
  let current = null;
  let tool = null;
  let hintTimer = 0;
  const eraseListeners = [];
  const eraserHoles = [];

  // ---- surfaces -------------------------------------------------------

  function addSurface(el, canvas, kind) {
    const s = { el, canvas, kind, ctx: canvas.getContext('2d'), dpr: 1, pattern: null };
    surfaces.push(s);
    new ResizeObserver(() => resize(s)).observe(el);
    resize(s);
    return s;
  }

  function resize(s) {
    s.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = s.el.clientWidth;
    const h = s.el.clientHeight;
    s.canvas.width = Math.round(w * s.dpr);
    s.canvas.height = Math.round(h * s.dpr);
    s.canvas.style.width = `${w}px`;
    s.canvas.style.height = `${h}px`;
    s.pattern = null;
    redraw(s);
  }

  /** What the eraser paints: ruled paper aligned with the sheet, or plain printout paper. */
  function paperFill(s) {
    if (s.kind !== 'sheet') return PRINTOUT;
    if (s.pattern) return s.pattern;
    // the tile is 220px tall: the ruling repeats every 32px and the grain every 220px,
    // so one 32*220 tile lines up with both
    const tile = document.createElement('canvas');
    const w = s.el.clientWidth;
    const th = 220 * 32 / 4; // 1760: a common multiple of 220 and 32
    tile.width = Math.round(w * s.dpr);
    tile.height = Math.round(th * s.dpr);
    const c = tile.getContext('2d');
    c.scale(s.dpr, s.dpr);
    c.fillStyle = PAPER.color;
    c.fillRect(0, 0, w, th);
    if (grain.complete && grain.naturalWidth) {
      for (let y = 0; y < th; y += 220) for (let x = 0; x < w; x += 220) c.drawImage(grain, x, y);
    }
    c.fillStyle = PAPER.line;
    for (let y = PAPER.lineAt; y < th; y += PAPER.lineEvery) c.fillRect(0, y, w, 1);
    c.fillStyle = PAPER.margin;
    c.globalAlpha = 0.8;
    c.fillRect(PAPER.marginX, 0, 2, th);
    s.pattern = s.ctx.createPattern(tile, 'repeat');
    // pattern space is device pixels; scale it back to css pixels
    const m = new DOMMatrix().scale(1 / s.dpr);
    s.pattern.setTransform(m);
    return s.pattern;
  }

  function redraw(s) {
    const { ctx } = s;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    const w = s.el.clientWidth;
    strokes.forEach((stroke) => stroke.surface === s && paint(stroke, w));
    if (current && current.surface === s) paint(current, w);
  }

  function paint(stroke, w) {
    const t = TOOLS[stroke.tool];
    const { ctx } = stroke.surface;
    if (!t || stroke.points.length < 2) return;
    ctx.globalCompositeOperation = t.composite;
    ctx.strokeStyle = t.paper ? paperFill(stroke.surface) : t.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const scale = stroke.surface.kind === 'sheet' ? w / BASE_WIDTH : 1;
    ctx.lineWidth = t.width * stroke.pressure * scale;
    const p = stroke.points.map(([x, y]) => [x * w, y * w]);
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    }
    const last = p[p.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- input ----------------------------------------------------------

  const sheetSurface = addSurface(sheet, document.getElementById('ink'), 'sheet');
  grain.addEventListener('load', () => {
    sheetSurface.pattern = null;
    redraw(sheetSurface);
  });
  document.querySelectorAll('.clip').forEach((clip) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'ink-layer';
    canvas.setAttribute('aria-hidden', 'true');
    clip.appendChild(canvas);
    addSurface(clip, canvas, 'clip');
  });
  const pointer = sheetSurface.canvas; // the sheet's canvas receives all drawing input

  function surfaceAt(clientX, clientY) {
    for (const s of surfaces) {
      if (s.kind !== 'clip') continue;
      const r = s.el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return s;
    }
    return sheetSurface;
  }

  function pointOn(s, clientX, clientY) {
    const r = s.el.getBoundingClientRect();
    const t = TOOLS[tool];
    const jitter = t && t.jitter ? (Math.random() - 0.5) * t.jitter : 0;
    return [(clientX - r.left + jitter) / r.width, (clientY - r.top + jitter) / r.width];
  }

  function inHole(clientX, clientY) {
    return eraserHoles.some((el) => {
      const r = el.getBoundingClientRect();
      return clientX >= r.left - 16 && clientX <= r.right + 16 && clientY >= r.top - 16 && clientY <= r.bottom + 16;
    });
  }

  function addPoint(ev) {
    if (tool === 'eraser') {
      eraseListeners.forEach((fn) => fn(ev.clientX, ev.clientY));
      if (inHole(ev.clientX, ev.clientY)) return; // that spot has its own eraser logic
    }
    current.points.push(pointOn(current.surface, ev.clientX, ev.clientY));
  }

  function onDown(ev) {
    if (!tool) return;
    pointer.setPointerCapture(ev.pointerId);
    const pressure = ev.pressure && ev.pressure !== 0.5 ? 0.6 + ev.pressure : 1;
    current = { tool, pressure, surface: surfaceAt(ev.clientX, ev.clientY), points: [] };
    addPoint(ev);
    ev.preventDefault();
  }

  function onMove(ev) {
    if (!current) return;
    for (const e of ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]) addPoint(e);
    redraw(current.surface);
  }

  function onUp() {
    if (!current) return;
    const done = current;
    current = null;
    if (done.points.length > 1) strokes.push(done);
    strokes = strokes.slice(-MAX_STROKES);
    redraw(done.surface);
  }

  function undo() {
    const last = strokes.pop();
    if (last) redraw(last.surface);
  }

  function clear() {
    if (!strokes.length) return;
    strokes = [];
    surfaces.forEach(redraw);
    showHint('Page wiped clean.');
  }

  function showHint(text, ms = 2600) {
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), ms);
  }

  function setTool(name) {
    tool = tool === name ? null : name;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    sheet.classList.toggle('drawing', Boolean(tool));
    showHint(tool ? HINTS[tool] : 'Tools away. Links and desk objects work again.');
  }

  pointer.addEventListener('pointerdown', onDown);
  pointer.addEventListener('pointermove', onMove);
  pointer.addEventListener('pointerup', onUp);
  pointer.addEventListener('pointercancel', onUp);
  buttons.forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('clear').addEventListener('click', clear);

  document.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, textarea')) return;
    if (SHORTCUTS[ev.key]) setTool(SHORTCUTS[ev.key]);
    else if (ev.key === 'Escape' && tool) setTool(tool);
    else if (ev.key.toLowerCase() === 'z' && !ev.metaKey && !ev.ctrlKey) undo();
  });

  // On small screens the pencil case starts folded into one button.
  const pencilCase = document.getElementById('pencilcase');
  const toggle = document.getElementById('pencilcase-toggle');
  toggle.addEventListener('click', () => {
    const open = pencilCase.classList.toggle('collapsed') === false;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '×' : '✎';
    if (!open && tool) setTool(tool);
  });

  return {
    get tool() {
      return tool;
    },
    showHint,
    /** Called with the pointer position for every eraser sample. */
    onErase(fn) {
      eraseListeners.push(fn);
    },
    /** An element the eraser must not paint over (it handles erasing itself). */
    keepFromEraser(el) {
      eraserHoles.push(el);
    },
  };
}
