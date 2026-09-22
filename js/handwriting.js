/**
 * Section headings are written by a pencil as they scroll into view.
 *
 * The heading text is set in a stroke font (see hershey.js), so every letter
 * is a set of pen paths rather than an outline. The pencil travels along
 * those paths at a steady speed and the line appears behind its tip; between
 * strokes it lifts and hops. When the last stroke is done, the sketched
 * underline beneath the heading draws itself.
 */

import { GLYPHS, CAP_LINE, BASE_LINE } from './hershey.js';

const SPEED = 520; // px of line per second, in the heading's own pixels
const HOP_MS = 45; // pause between strokes
const WORD_MS = 110; // pause between words
const STROKE_WIDTH = 0.11; // relative to font size

function buildHeading(h2) {
  const textNode = [...h2.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (!textNode) return null;
  const text = textNode.textContent.trim();
  const size = parseFloat(getComputedStyle(h2).fontSize);
  const scale = (size * 0.78) / (BASE_LINE - CAP_LINE); // cap height ≈ 78% of the font size
  const baseline = size * 0.9;
  const height = size * 1.3;
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'handwriting');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', text);

  const strokes = [];
  let x = 4;
  for (const ch of text) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    if (ch === ' ') strokes.push({ pause: WORD_MS });
    g.s.forEach((pts) => {
      const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${(x + (px - g.l) * scale).toFixed(1)} ${(baseline + py * scale).toFixed(1)}`).join(' ');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke-width', (size * STROKE_WIDTH).toFixed(2));
      svg.appendChild(path);
      strokes.push({ path });
    });
    x += g.w * scale;
  }
  const width = x + 4;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  h2.replaceChild(svg, textNode);
  h2.classList.add('writing');
  return { svg, strokes, underline: h2.querySelector('.ul') };
}

function makePencil() {
  const el = document.createElement('div');
  el.className = 'nib';
  el.innerHTML =
    '<svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">' +
    '<g transform="rotate(-38 14 136)">' +
    '<polygon points="14,136 32,128 32,144" fill="#35342f"/>' +
    '<polygon points="30,126 52,122 52,150 30,146" fill="#e8cfa0"/>' +
    '<rect x="52" y="122" width="150" height="28" fill="#d9a441"/>' +
    '<rect x="52" y="122" width="150" height="9" fill="rgba(255,255,255,.28)"/>' +
    '<rect x="52" y="141" width="150" height="9" fill="rgba(0,0,0,.14)"/>' +
    '</g></svg>';
  document.body.appendChild(el);
  return el;
}

/** Build a timeline: for each stroke, when it starts and how long it takes. */
function schedule(strokes, scale) {
  let t = 0;
  return strokes
    .map((s) => {
      if (s.pause) {
        t += s.pause;
        return null;
      }
      const len = s.path.getTotalLength();
      s.path.style.strokeDasharray = `${len}`;
      s.path.style.strokeDashoffset = `${len}`;
      const start = t;
      const dur = ((len * scale) / SPEED) * 1000;
      t += dur + HOP_MS;
      return { path: s.path, len, start, dur };
    })
    .filter(Boolean);
}

function write({ svg, strokes, underline }) {
  const pencil = makePencil();
  const rect = () => svg.getBoundingClientRect();
  const scale = rect().width / svg.viewBox.baseVal.width;
  const timeline = schedule(strokes, scale);
  const last = timeline[timeline.length - 1];
  const total = last ? last.start + last.dur : 0;
  const start = performance.now();
  pencil.classList.add('show');

  function tick(now) {
    const elapsed = now - start;
    let tip = null;
    for (const s of timeline) {
      if (elapsed >= s.start + s.dur) {
        s.path.style.strokeDashoffset = '0';
      } else if (elapsed >= s.start) {
        const t = (elapsed - s.start) / s.dur;
        s.path.style.strokeDashoffset = `${s.len * (1 - t)}`;
        tip = s.path.getPointAtLength(s.len * t);
        break;
      } else {
        tip = s.path.getPointAtLength(0); // hopping to the next stroke
        break;
      }
    }
    if (tip) {
      const r = rect();
      const k = r.width / svg.viewBox.baseVal.width;
      pencil.style.transform = `translate(${r.left + tip.x * k - 14}px, ${r.top + tip.y * k - 136 + window.scrollY}px)`;
    }
    if (elapsed < total) requestAnimationFrame(tick);
    else {
      timeline.forEach((s) => (s.path.style.strokeDashoffset = '0'));
      if (underline) underline.classList.add('on');
      pencil.classList.add('lift');
      setTimeout(() => pencil.remove(), 600);
    }
  }
  requestAnimationFrame(tick);
}

export function writeHeadings() {
  const headings = [...document.querySelectorAll('h2')];
  const underlines = () => headings.forEach((h) => h.querySelector('.ul')?.classList.add('on'));
  if (!headings.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return underlines();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const built = buildHeading(entry.target);
        if (built) write(built);
        else entry.target.querySelector('.ul')?.classList.add('on');
      });
    },
    { threshold: 0.6 },
  );
  headings.forEach((h) => observer.observe(h));
}
