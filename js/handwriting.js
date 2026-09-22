/**
 * The intro writes itself.
 *
 * The paragraphs are re-set as SVG using the real glyph outlines of Caveat
 * (parsed at runtime with opentype.js from the font file in /fonts), wrapped
 * to the paragraph's width. Each glyph is first stroked along its outline,
 * with a pen nib travelling ahead of the ink, then filled. If the font or
 * the parser fails to load, the plain text stays as it is.
 */

const FONT_URL = 'fonts/Caveat-Variable.ttf';
const PARSER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js';
const CHARS_PER_SECOND = 32;
const STROKE_MS = 90; // how long a single glyph takes to be traced

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Greedy word wrap using the font's own advance widths. */
function wrap(font, text, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.getAdvanceWidth(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildParagraph(font, p) {
  const style = getComputedStyle(p);
  const size = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) || size * 1.35;
  const width = p.clientWidth;
  const color = style.color;
  const marks = [...p.querySelectorAll('mark')].map((m) => m.textContent.trim());
  const text = p.textContent.replace(/\s+/g, ' ').trim();
  const lines = wrap(font, text, size, width);
  const height = lines.length * lineHeight;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.classList.add('handwriting');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', text);

  const glyphs = [];
  lines.forEach((line, row) => {
    const baseline = row * lineHeight + size * 0.95;
    let x = 0;
    // highlighter behind marked phrases
    marks.forEach((phrase) => {
      const at = line.indexOf(phrase);
      if (at < 0) return;
      const x0 = font.getAdvanceWidth(line.slice(0, at), size);
      const w = font.getAdvanceWidth(phrase, size);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x0 - 3);
      rect.setAttribute('y', baseline - size * 0.72);
      rect.setAttribute('width', w + 6);
      rect.setAttribute('height', size * 0.92);
      rect.setAttribute('class', 'hl');
      svg.appendChild(rect);
    });
    for (const glyph of font.stringToGlyphs(line)) {
      const d = glyph.getPath(x, baseline, size).toPathData(2);
      x += (glyph.advanceWidth / font.unitsPerEm) * size;
      if (!d) continue;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', color);
      path.setAttribute('stroke', color);
      svg.appendChild(path);
      glyphs.push(path);
    }
  });
  return { svg, glyphs, height };
}

export async function writeIntro() {
  const paragraphs = [...document.querySelectorAll('.intro p')].slice(0, 2);
  if (!paragraphs.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.fonts || !window.fetch) return;

  let font;
  try {
    await loadScript(PARSER_URL);
    const buffer = await (await fetch(FONT_URL)).arrayBuffer();
    font = window.opentype.parse(buffer);
  } catch {
    return; // plain text stays
  }

  const nib = document.createElement('div');
  nib.className = 'nib';
  nib.innerHTML = '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M6 28 L 9 19 L 25 3 L 31 9 L 15 25 Z" fill="#35342f"/><path d="M6 28 L 9 19 L 15 25 Z" fill="#c9bfae"/><path d="M6 28 L 8.5 25.5" stroke="#f5f1e6" stroke-width="1.2"/></svg>';
  document.body.appendChild(nib);

  const built = paragraphs.map((p) => {
    const b = buildParagraph(font, p);
    p.dataset.text = p.innerHTML;
    p.innerHTML = '';
    p.appendChild(b.svg);
    p.classList.add('writing');
    return b;
  });

  const queue = built.flatMap((b) => b.glyphs);
  const per = 1000 / CHARS_PER_SECOND;
  queue.forEach((path) => {
    const len = path.getTotalLength();
    path.style.setProperty('--len', len.toFixed(1));
  });

  let i = 0;
  const start = performance.now();
  const nibOffset = { x: -6, y: 28 };
  function tick(now) {
    const target = Math.min(queue.length, Math.floor((now - start) / per) + 1);
    while (i < target) {
      queue[i].classList.add('ink');
      queue[i].style.setProperty('--dur', `${STROKE_MS}ms`);
      i++;
    }
    const current = queue[Math.min(i, queue.length) - 1];
    if (current) {
      const len = parseFloat(current.style.getPropertyValue('--len'));
      const t = Math.min(1, ((now - start) % per) / per);
      const pt = current.getPointAtLength(len * t);
      const r = current.ownerSVGElement.getBoundingClientRect();
      const vb = current.ownerSVGElement.viewBox.baseVal;
      const sx = r.width / vb.width;
      nib.style.transform = `translate(${r.left + pt.x * sx + nibOffset.x}px, ${r.top + pt.y * sx - nibOffset.y + window.scrollY}px)`;
    }
    if (i < queue.length) requestAnimationFrame(tick);
    else {
      setTimeout(() => nib.classList.add('lift'), 200);
      setTimeout(() => nib.remove(), 900);
    }
  }
  nib.classList.add('show');
  requestAnimationFrame(tick);
}
