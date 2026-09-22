/**
 * Drawing layer and pencil case.
 *
 * There is one drawing surface over the sheet and one over everything stuck
 * onto it: printouts, sticky notes, the business card, the name sticker. A
 * stroke is cut wherever it crosses from one surface to another, so ink drawn
 * across a printout's edge tears along that edge when the printout moves.
 * Strokes are stored in fractions of their surface's width and survive a
 * resize. Nothing is persisted.
 *
 * The eraser is a real eraser: it paints each surface's own material back over
 * whatever is under it, ruled paper on the sheet, white on a printout, the
 * sticker's red and white on the sticker, so text, doodles and drawings alike
 * can be rubbed out.
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

  function addSurface(el, canvas, kind, material) {
    const s = { el, canvas, kind, material, ctx: canvas.getContext('2d'), dpr: 1, pattern: null };
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

  /** What the eraser paints on a surface: its own material, aligned with it. */
  function paperFill(s) {
    if (s.pattern) return s.pattern;
    if (s.kind === 'sheet') s.pattern = ruledPaper(s);
    else if (typeof s.material === 'function') s.pattern = s.material(s);
    else s.pattern = s.material;
    return s.pattern;
  }

  function ruledPaper(s) {
    // the tile is 1760px tall: the ruling repeats every 32px and the grain every 220px
    const tile = document.createElement('canvas');
    const w = s.el.clientWidth;
    const th = 1760;
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
    return patternOf(s, tile);
  }

  /** The HELLO sticker: red band on top, white below. */
  function stickerPaper(s) {
    const tile = document.createElement('canvas');
    const w = s.el.clientWidth;
    const h = s.el.clientHeight;
    const band = s.el.querySelector('.top');
    const bandH = band ? band.offsetHeight : h * 0.45;
    tile.width = Math.round(w * s.dpr);
    tile.height = Math.round(h * s.dpr);
    const c = tile.getContext('2d');
    c.scale(s.dpr, s.dpr);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = band ? getComputedStyle(band).backgroundColor : '#b8392e';
    c.fillRect(0, 0, w, bandH);
    return patternOf(s, tile);
  }

  function patternOf(s, tile) {
    const pattern = s.ctx.createPattern(tile, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(1 / s.dpr)); // pattern space is device pixels
    return pattern;
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
    const scale = stroke.surface.kind === 'sheet' ? w / BASE_WIDTH : Math.min(1, sheet.clientWidth / BASE_WIDTH);
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

  const sheetSurface = addSurface(sheet, document.getElementById('ink'), 'sheet', null);
  grain.addEventListener('load', () => {
    sheetSurface.pattern = null;
    redraw(sheetSurface);
  });
  const stuck = [
    ['.clip', PRINTOUT],
    ['.card', PRINTOUT],
    ['.postit', (s) => getComputedStyle(s.el).backgroundColor],
    ['.tag.big', stickerPaper],
  ];
  stuck.forEach(([selector, material]) => {
    document.querySelectorAll(selector).forEach((el) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'ink-layer';
      canvas.setAttribute('aria-hidden', 'true');
      el.appendChild(canvas);
      addSurface(el, canvas, 'stuck', material);
    });
  });
  const pointer = sheetSurface.canvas; // the sheet's canvas receives all drawing input

  function surfaceAt(clientX, clientY) {
    for (const s of surfaces) {
      if (s.kind !== 'stuck') continue;
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
    const surface = surfaceAt(ev.clientX, ev.clientY);
    if (surface !== current.surface) {
      // crossed an edge: finish the piece on the old surface, start one on the new,
      // both reaching this point so the line stays continuous until the paper moves
      current.points.push(pointOn(current.surface, ev.clientX, ev.clientY));
      finishPiece();
      current = { tool: current.tool, pressure: current.pressure, surface, points: [] };
    }
    current.points.push(pointOn(surface, ev.clientX, ev.clientY));
  }

  function finishPiece() {
    const done = current;
    if (done.points.length > 1) strokes.push(done);
    strokes = strokes.slice(-MAX_STROKES);
    redraw(done.surface);
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
    finishPiece();
    current = null;
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
    get strokeCount() {
      return strokes.length;
    },
    get erasedCount() {
      return strokes.filter((s) => s.tool === 'eraser').length;
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
