/**
 * Drawing layer: a full-page canvas over the sheet plus the pencil case.
 *
 * Strokes are stored in fractions of the sheet width so a drawing survives a
 * resize. Nothing is persisted: this is a landing page, not the visitor's
 * notebook.
 */

const TOOLS = {
  pencil: { color: 'rgba(59,58,54,.85)', width: 2.2, composite: 'source-over', jitter: 0.6 },
  pen: { color: '#2857c9', width: 3.4, composite: 'source-over', jitter: 0 },
  red: { color: '#d3372b', width: 3.4, composite: 'source-over', jitter: 0 },
  hl: { color: 'rgba(255,233,77,.55)', width: 22, composite: 'multiply', jitter: 0 },
  eraser: { color: '#000', width: 26, composite: 'destination-out', jitter: 0 },
};

const HINTS = {
  pencil: 'Pencil. Draw anywhere on the page. Esc to put it back.',
  pen: 'Blue marker. Esc to put it back.',
  red: 'Red marker. Esc to put it back.',
  hl: 'Highlighter. Try it on a sentence.',
  eraser: 'Eraser. Z undoes the last stroke.',
  inkwell: 'Ink. Tap for a drop, drag to stir it. It dries on its own.',
};

const SHORTCUTS = { 1: 'pencil', 2: 'pen', 3: 'red', 4: 'hl', 5: 'eraser', 6: 'inkwell' };
const MAX_STROKES = 400;
const BASE_WIDTH = 960;

export function createInk(sheet, fluid) {
  const canvas = document.getElementById('ink');
  const ctx = canvas.getContext('2d');
  const buttons = [...document.querySelectorAll('.tool[data-tool]')];
  const hint = document.getElementById('hint');

  let strokes = [];
  let current = null;
  let tool = null;
  let dpr = 1;
  let hintTimer = 0;
  const eraseListeners = [];

  function showHint(text, ms = 2600) {
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), ms);
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = sheet.clientWidth;
    const h = sheet.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    redraw();
  }

  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = sheet.clientWidth;
    strokes.forEach((stroke) => paint(stroke, w));
    if (current) paint(current, w);
  }

  function paint(stroke, w) {
    const t = TOOLS[stroke.tool];
    if (!t || stroke.points.length < 2) return;
    ctx.globalCompositeOperation = t.composite;
    ctx.strokeStyle = t.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = t.width * stroke.pressure * (w / BASE_WIDTH);
    const p = stroke.points.map(([x, y]) => [x * w, y * w]);
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      const my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
    }
    const last = p[p.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // offsetX/Y are relative to the canvas and already account for scroll and
  // transforms; the sheet's bounding box does not.
  function pointAt(ev) {
    const r = canvas.getBoundingClientRect();
    const t = TOOLS[tool];
    const jitter = t && t.jitter ? (Math.random() - 0.5) * t.jitter : 0;
    const local = ev.target === canvas && typeof ev.offsetX === 'number';
    const x = local ? ev.offsetX : ev.clientX - r.left;
    const y = local ? ev.offsetY : ev.clientY - r.top;
    return [(x + jitter) / r.width, (y + jitter) / r.width];
  }

  function coalesced(ev) {
    return ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
  }

  let last = null;

  function onDown(ev) {
    if (!tool) return;
    canvas.setPointerCapture(ev.pointerId);
    if (tool === 'inkwell') {
      fluid.drop(ev.clientX, ev.clientY);
      last = [ev.clientX, ev.clientY];
      ev.preventDefault();
      return;
    }
    const pressure = ev.pressure && ev.pressure !== 0.5 ? 0.6 + ev.pressure : 1;
    current = { tool, pressure, points: [pointAt(ev)] };
    if (tool === 'eraser') eraseListeners.forEach((fn) => fn(ev.clientX, ev.clientY));
    ev.preventDefault();
  }

  function onMove(ev) {
    if (tool === 'inkwell' && last) {
      for (const e of coalesced(ev)) {
        fluid.smear(e.clientX, e.clientY, (e.clientX - last[0]) * 0.03, (e.clientY - last[1]) * 0.03);
        last = [e.clientX, e.clientY];
      }
      return;
    }
    if (!current) return;
    for (const e of coalesced(ev)) {
      current.points.push(pointAt(e));
      if (tool === 'eraser') eraseListeners.forEach((fn) => fn(e.clientX, e.clientY));
    }
    redraw();
  }

  function onUp() {
    last = null;
    if (!current) return;
    if (current.points.length > 1) strokes.push(current);
    strokes = strokes.slice(-MAX_STROKES);
    current = null;
    redraw();
  }

  function undo() {
    strokes.pop();
    redraw();
  }

  function clear() {
    fluid.clear();
    if (!strokes.length) return;
    strokes = [];
    redraw();
    showHint('Page wiped clean.');
  }

  function setTool(name) {
    tool = tool === name ? null : name;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    sheet.classList.toggle('drawing', Boolean(tool));
    showHint(tool ? HINTS[tool] : 'Tools away. Links and desk objects work again.');
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
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

  new ResizeObserver(resize).observe(sheet);
  resize();

  return {
    get tool() {
      return tool;
    },
    showHint,
    onErase(fn) {
      eraseListeners.push(fn);
    },
  };
}
