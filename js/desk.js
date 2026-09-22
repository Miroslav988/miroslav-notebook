/**
 * Objects lying on the sheet (pencil, eraser, paper clip, ruler): drag them,
 * throw them, they slide with friction and bounce off the sheet's edges.
 */

const FRICTION = 0.95;
const BOUNCE = -0.5;
const REST_SPEED = 0.12;
const HISTORY = 6;

export function createDesk(sheet) {
  const state = new Map();

  function place(el) {
    const s = state.get(el);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(2)}deg)`;
  }

  function grab(ev) {
    if (sheet.classList.contains('drawing')) return;
    const el = ev.currentTarget;
    const s = state.get(el);
    cancelAnimationFrame(s.raf);
    s.drag = { x: ev.clientX, y: ev.clientY, t: performance.now(), history: [] };
    s.vx = 0;
    s.vy = 0;
    el.classList.add('dragging');
    el.setPointerCapture(ev.pointerId);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
    ev.preventDefault();
  }

  function move(ev) {
    const el = ev.currentTarget;
    const s = state.get(el);
    if (!s.drag) return;
    const dx = ev.clientX - s.drag.x;
    const dy = ev.clientY - s.drag.y;
    const now = performance.now();
    s.drag.history.push({ dx, dy, dt: now - s.drag.t });
    if (s.drag.history.length > HISTORY) s.drag.history.shift();
    s.drag.x = ev.clientX;
    s.drag.y = ev.clientY;
    s.drag.t = now;
    s.x += dx;
    s.y += dy;
    s.rot = s.baseRot + Math.max(-18, Math.min(18, dx * 0.8));
    place(el);
  }

  function drop(ev) {
    const el = ev.currentTarget;
    const s = state.get(el);
    if (!s.drag) return;
    const h = s.drag.history;
    const dt = h.reduce((a, b) => a + b.dt, 0) || 16;
    s.vx = (h.reduce((a, b) => a + b.dx, 0) / dt) * 16; // px per frame
    s.vy = (h.reduce((a, b) => a + b.dy, 0) / dt) * 16;
    s.drag = null;
    el.classList.remove('dragging');
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', drop);
    el.removeEventListener('pointercancel', drop);
    slide(el);
  }

  function slide(el) {
    const s = state.get(el);
    const step = () => {
      s.vx *= FRICTION;
      s.vy *= FRICTION;
      s.x += s.vx;
      s.y += s.vy;
      const r = el.getBoundingClientRect();
      const b = sheet.getBoundingClientRect();
      if ((r.left < b.left + 4 && s.vx < 0) || (r.right > b.right - 4 && s.vx > 0)) {
        s.vx *= BOUNCE;
        s.x += s.vx * 2;
      }
      if ((r.top < b.top + 4 && s.vy < 0) || (r.bottom > b.bottom - 4 && s.vy > 0)) {
        s.vy *= BOUNCE;
        s.y += s.vy * 2;
      }
      s.rot += (s.baseRot + s.vx * 1.5 - s.rot) * 0.1;
      place(el);
      if (Math.abs(s.vx) + Math.abs(s.vy) > REST_SPEED) s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }

  document.querySelectorAll('.item').forEach((el) => {
    const rot = parseFloat(el.dataset.rot || '0');
    state.set(el, { x: 0, y: 0, vx: 0, vy: 0, rot, baseRot: rot, drag: null, raf: 0 });
    place(el);
    el.addEventListener('pointerdown', grab);
  });
}
