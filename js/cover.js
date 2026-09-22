/**
 * The notebook opens when the page loads: a cardboard cover swings away in
 * 3D and the sticker on the first page lands. One short moment, skippable
 * with a tap or a key, and skipped entirely when the visitor prefers
 * reduced motion.
 */

const OPEN_DELAY = 500;
const OPEN_DURATION = 1200;
const HOLD = 350;

export function openNotebook() {
  const cover = document.getElementById('cover');
  const sheet = document.getElementById('sheet');
  if (!cover) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    cover.classList.add('gone');
    sheet.classList.add('open');
    document.body.classList.remove('closed');
    setTimeout(() => cover.remove(), 700);
  }

  if (reduced) {
    finish();
    return;
  }

  // The cover sits exactly on the sheet, so the real first page is what shows
  // through as it swings open.
  const front = cover.querySelector('.cover-front');
  const r = sheet.getBoundingClientRect();
  const height = Math.min(r.height, window.innerHeight - r.top + 40);
  front.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${height}px`;

  document.body.classList.add('closed');
  cover.addEventListener('click', finish);
  document.addEventListener('keydown', finish, { once: true });

  setTimeout(() => cover.classList.add('opening'), OPEN_DELAY);
  setTimeout(finish, OPEN_DELAY + OPEN_DURATION + HOLD);
}
