/**
 * A desk lamp that follows the pointer (or the phone's tilt): everything that
 * sits on the paper casts its shadow away from the light, and the paper is a
 * touch brighter under it.
 *
 * Each shadowed element gets --sx/--sy (shadow offset) and --sd (shadow
 * softness) from the vector between the light and the element's centre; the
 * stylesheet reads them. Updates are batched into one frame.
 */

const SELECTOR = '.clip, .tag.big, .postit, .card, .device';
const REACH = 900; // px: how far the lamp's influence is felt
const MAX_OFFSET = 18;
const MIN_MOVE = 8; // px of pointer travel before shadows are recomputed
const FRAME_MS = 40; // ~25 updates a second is plenty for shadows

export function initLamp(sheet) {
  const targets = [...document.querySelectorAll(SELECTOR)];
  const glow = document.createElement('div');
  glow.className = 'lamp-glow';
  sheet.appendChild(glow);

  let light = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.2 };
  let applied = { x: -1e9, y: -1e9 };
  let centres = []; // document coordinates, measured once and on layout changes
  let raf = 0;
  let last = 0;

  function measure() {
    centres = targets.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY, h: r.height };
    });
  }

  function update(now) {
    raf = 0;
    if (now - last < FRAME_MS) return schedule();
    last = now;
    applied = light;
    const sheetRect = sheet.getBoundingClientRect();
    glow.style.setProperty('--lx', `${light.x - sheetRect.left}px`);
    glow.style.setProperty('--ly', `${light.y - sheetRect.top}px`);
    const lx = light.x + window.scrollX;
    const ly = light.y + window.scrollY;
    const top = window.scrollY - 300;
    const bottom = window.scrollY + window.innerHeight + 300;
    centres.forEach(({ el, x, y, h }) => {
      if (y + h / 2 < top || y - h / 2 > bottom) return; // off screen
      const dx = x - lx;
      const dy = y - ly;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, dist / REACH);
      el.style.setProperty('--sx', `${((dx / dist) * MAX_OFFSET * strength).toFixed(1)}px`);
      el.style.setProperty('--sy', `${(6 + (dy / dist) * MAX_OFFSET * strength).toFixed(1)}px`);
      el.style.setProperty('--sd', `${(14 + strength * 16).toFixed(0)}px`);
    });
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(update);
  }

  window.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    if (Math.abs(ev.clientX - applied.x) + Math.abs(ev.clientY - applied.y) < MIN_MOVE) return;
    light = { x: ev.clientX, y: ev.clientY };
    schedule();
  }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => { measure(); schedule(); });
  new ResizeObserver(() => { measure(); schedule(); }).observe(sheet);
  measure();

  // On phones the lamp hangs above the desk; tilting the phone moves it.
  if ('DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches) {
    window.addEventListener('deviceorientation', (ev) => {
      if (ev.gamma === null || ev.beta === null) return;
      light = {
        x: window.innerWidth * (0.5 - Math.max(-30, Math.min(30, ev.gamma)) / 60),
        y: window.innerHeight * (0.3 - Math.max(-30, Math.min(30, ev.beta - 40)) / 90),
      };
      schedule();
    }, { passive: true });
  }

  document.documentElement.classList.add('lamp');
  update();
}
