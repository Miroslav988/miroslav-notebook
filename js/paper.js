/**
 * Taped-in printouts lift slightly towards the pointer, as if you were about
 * to peel one off the page. Ink drawn on a printout lives on the printout's
 * own layer, so it moves with the paper. While a tool is in hand the paper
 * stays flat, so what you draw lands where you point.
 */

const MAX_TILT = 3; // degrees

export function initPaper() {
  document.querySelectorAll('.clip').forEach((clip) => {
    clip.addEventListener('pointermove', (ev) => {
      if (ev.pointerType === 'touch') return;
      const r = clip.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width - 0.5;
      const py = (ev.clientY - r.top) / r.height - 0.5;
      clip.style.setProperty('--rx', `${(-py * MAX_TILT).toFixed(2)}deg`);
      clip.style.setProperty('--ry', `${(px * MAX_TILT).toFixed(2)}deg`);
    });
    clip.addEventListener('pointerleave', () => {
      clip.style.removeProperty('--rx');
      clip.style.removeProperty('--ry');
    });
  });
}
