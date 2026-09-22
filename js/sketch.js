/**
 * Hand-drawn feel for the SVG doodles and charts.
 *
 * - Elements with `.draw` get their strokes measured so CSS can animate them
 *   in when they scroll into view.
 * - Outlined shapes inside doodles are duplicated with a slightly offset,
 *   fainter copy, the way a pencil line looks when you go over it twice.
 */

export function initSketch() {
  document.querySelectorAll('.draw path.stroke').forEach((path) => {
    path.style.setProperty('--len', path.getTotalLength().toFixed(1));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('on');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.2 },
  );
  document.querySelectorAll('.draw').forEach((el) => observer.observe(el));

  document.querySelectorAll('.doodle svg, .note-margin svg').forEach((svg) => {
    const outlined = [...svg.querySelectorAll('path, rect, circle, line')].filter(
      (el) => el.getAttribute('fill') === 'none' || el.tagName === 'line',
    );
    outlined.forEach((el) => {
      let box;
      try {
        box = el.getBBox();
      } catch {
        return;
      }
      const ghost = el.cloneNode(false);
      const dx = (Math.random() - 0.5) * 2.4;
      const dy = (Math.random() - 0.5) * 2.4;
      const rot = (Math.random() - 0.5) * 3;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      ghost.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})`);
      ghost.setAttribute('data-ghost', '1');
      const width = parseFloat(el.getAttribute('stroke-width') || '2');
      ghost.setAttribute('stroke-width', (width * 0.8).toFixed(2));
      el.parentNode.insertBefore(ghost, el);
    });
  });
}
