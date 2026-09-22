/**
 * Section headings write themselves as they scroll into view.
 *
 * The heading text is re-set as SVG from the real glyph outlines of Permanent
 * Marker (the font file in /fonts, parsed in the browser with opentype.js).
 * Each glyph is revealed left to right behind a moving clip, the way a marker
 * lays down a letter, with the marker tip travelling along; when the last
 * letter is done the underline sketch beneath the heading is drawn. If the font or
 * the parser fails to load, the headings stay as plain text and the
 * underlines draw on their own.
 */

const FONT_URL = 'fonts/PermanentMarker-Regular.ttf';
const PARSER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js';
const GLYPH_MS = 90; // pace: one letter every 90 ms
let clipCounter = 0;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function buildHeading(font, h2) {
  const textNode = [...h2.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (!textNode) return null;
  const text = textNode.textContent.trim();
  const style = getComputedStyle(h2);
  const size = parseFloat(style.fontSize);
  const width = font.getAdvanceWidth(text, size) + 4;
  const height = size * 1.25;
  const baseline = size * 0.95;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('class', 'handwriting');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', text);

  const NS = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs);
  const glyphs = [];
  let x = 2;
  for (const glyph of font.stringToGlyphs(text)) {
    const advance = (glyph.advanceWidth / font.unitsPerEm) * size;
    const x0 = x;
    x += advance;
    const path2d = glyph.getPath(x0, baseline, size);
    const d = path2d.toPathData(2);
    if (!d) continue;
    const box = path2d.getBoundingBox();
    const id = `hw-clip-${clipCounter++}`;
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', id);
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', box.x1 - 2);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', 0);
    rect.setAttribute('height', height);
    clip.appendChild(rect);
    defs.appendChild(clip);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('clip-path', `url(#${id})`);
    svg.appendChild(path);
    glyphs.push({ rect, x0: box.x1 - 2, w: box.x2 - box.x1 + 4, y: baseline - size * 0.4 });
  }
  h2.replaceChild(svg, textNode);
  h2.classList.add('writing');
  return { svg, glyphs, underline: h2.querySelector('.ul') };
}

function makeNib() {
  const nib = document.createElement('div');
  nib.className = 'nib';
  nib.innerHTML = '<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><path d="M14 44 L 22 26 L 44 4 L 52 12 L 30 34 Z" fill="#24437a"/><path d="M14 44 L 22 26 L 30 34 Z" fill="#c9bfae"/><path d="M44 4 L 52 12 L 48 16 L 40 8 Z" fill="#1a2f55"/></svg>';
  document.body.appendChild(nib);
  return nib;
}

function write({ svg, glyphs, underline }) {
  const nib = makeNib();
  const start = performance.now();
  nib.classList.add('show');

  function tick(now) {
    const elapsed = now - start;
    const index = Math.min(glyphs.length - 1, Math.floor(elapsed / GLYPH_MS));
    const t = Math.min(1, (elapsed - index * GLYPH_MS) / GLYPH_MS);
    glyphs.forEach((g, k) => g.rect.setAttribute('width', k < index ? g.w : k === index ? g.w * t : 0));
    const g = glyphs[index];
    const r = svg.getBoundingClientRect();
    const scale = r.width / svg.viewBox.baseVal.width;
    nib.style.transform = `translate(${r.left + (g.x0 + g.w * t) * scale - 14}px, ${r.top + g.y * scale - 44 + window.scrollY}px)`;
    if (elapsed < glyphs.length * GLYPH_MS) requestAnimationFrame(tick);
    else {
      glyphs.forEach((gl) => gl.rect.setAttribute('width', gl.w));
      if (underline) underline.classList.add('on');
      nib.classList.add('lift');
      setTimeout(() => nib.remove(), 600);
    }
  }
  requestAnimationFrame(tick);
}

export async function writeHeadings() {
  const headings = [...document.querySelectorAll('h2')];
  const underlines = () => headings.forEach((h) => h.querySelector('.ul')?.classList.add('on'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!headings.length || reduced || !window.fetch) return underlines();
  document.documentElement.classList.add('handwriting');

  let font;
  try {
    await loadScript(PARSER_URL);
    font = window.opentype.parse(await (await fetch(FONT_URL)).arrayBuffer());
  } catch {
    document.documentElement.classList.remove('handwriting');
    return underlines();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const built = buildHeading(font, entry.target);
        if (built) write(built);
        else entry.target.querySelector('.ul')?.classList.add('on');
      });
    },
    { threshold: 0.6 },
  );
  headings.forEach((h) => observer.observe(h));
}
