/**
 * A desk lamp that follows the pointer (or the phone's tilt): everything that
 * sits on the paper casts its shadow away from the light, and the paper is a
 * touch brighter under it.
 *
 * Each shadowed element gets --sx/--sy (shadow offset) and --sd (shadow
 * softness) from the vector between the light and the element's centre; the
 * stylesheet reads them. Updates are batched into one frame.
 */

const SELECTOR = '.clip, .tag.big, .postit, .card, .device, .item, .terminal';
const REACH = 900; // px: how far the lamp's influence is felt
const MAX_OFFSET = 22;

export function initLamp(sheet) {
  const targets = [...document.querySelectorAll(SELECTOR)];
  const glow = document.createElement('div');
  glow.className = 'lamp-glow';
  sheet.appendChild(glow);

  let light = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.2 };
  let raf = 0;

  function update() {
    raf = 0;
    const sheetRect = sheet.getBoundingClientRect();
    glow.style.setProperty('--lx', `${light.x - sheetRect.left}px`);
    glow.style.setProperty('--ly', `${light.y - sheetRect.top}px`);
    targets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return; // off screen
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = cx - light.x;
      const dy = cy - light.y;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, dist / REACH);
      el.style.setProperty('--sx', `${((dx / dist) * MAX_OFFSET * strength).toFixed(1)}px`);
      el.style.setProperty('--sy', `${(6 + (dy / dist) * MAX_OFFSET * strength).toFixed(1)}px`);
      el.style.setProperty('--sd', `${(14 + strength * 18).toFixed(0)}px`);
    });
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(update);
  }

  window.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    light = { x: ev.clientX, y: ev.clientY };
    schedule();
  }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

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
