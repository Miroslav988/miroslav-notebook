/**
 * Section headings write themselves as they scroll into view.
 *
 * The heading text is re-set as SVG from the real glyph outlines of Permanent
 * Marker (the font file in /fonts, parsed in the browser with opentype.js).
 * A pen nib traces each glyph, the glyph fills in, and when the last letter
 * is done the underline sketch beneath the heading is drawn. If the font or
 * the parser fails to load, the headings stay as plain text and the
 * underlines draw on their own.
 */

const FONT_URL = 'fonts/PermanentMarker-Regular.ttf';
const PARSER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js';
const GLYPH_MS = 70; // pace: one letter every 70 ms
const TRACE_MS = 120; // how long a letter's outline takes to be traced

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

  const glyphs = [];
  let x = 2;
  for (const glyph of font.stringToGlyphs(text)) {
    const d = glyph.getPath(x, baseline, size).toPathData(2);
    x += (glyph.advanceWidth / font.unitsPerEm) * size;
    if (!d) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    glyphs.push(path);
  }
  h2.replaceChild(svg, textNode);
  h2.classList.add('writing');
  return { svg, glyphs, underline: h2.querySelector('.ul') };
}

function makeNib() {
  const nib = document.createElement('div');
  nib.className = 'nib';
  nib.innerHTML = '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M6 28 L 9 19 L 25 3 L 31 9 L 15 25 Z" fill="#35342f"/><path d="M6 28 L 9 19 L 15 25 Z" fill="#c9bfae"/></svg>';
  document.body.appendChild(nib);
  return nib;
}

function write({ svg, glyphs, underline }) {
  const nib = makeNib();
  glyphs.forEach((p) => p.style.setProperty('--len', p.getTotalLength().toFixed(1)));
  let i = 0;
  const start = performance.now();
  nib.classList.add('show');

  function tick(now) {
    const target = Math.min(glyphs.length, Math.floor((now - start) / GLYPH_MS) + 1);
    while (i < target) glyphs[i++].classList.add('ink');
    const current = glyphs[i - 1];
    if (current) {
      const len = parseFloat(current.style.getPropertyValue('--len'));
      const t = Math.min(1, ((now - start) % GLYPH_MS) / GLYPH_MS);
      const pt = current.getPointAtLength(len * t);
      const r = svg.getBoundingClientRect();
      const scale = r.width / svg.viewBox.baseVal.width;
      nib.style.transform = `translate(${r.left + pt.x * scale - 6}px, ${r.top + pt.y * scale - 28 + window.scrollY}px)`;
    }
    if (i < glyphs.length) requestAnimationFrame(tick);
    else {
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
