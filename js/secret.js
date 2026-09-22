/**
 * A word scribbled over with a marker. The eraser from the pencil case rubs
 * the scribble off; once most of it is gone the word is revealed.
 */

const SCRIBBLE_COLOR = '#24437a';
const REVEAL_BELOW = 0.18;
const CHECK_EVERY = 8;
const PASSES = [
  { angle: -0.28, step: 4.5, width: 4.5, alpha: 0.8 },
  { angle: 0.18, step: 5, width: 4, alpha: 0.75 },
  { angle: -0.06, step: 5.5, width: 5, alpha: 0.75 },
  { angle: 0.4, step: 4, width: 5, alpha: 0.85 },
  { angle: -0.45, step: 4.5, width: 4.5, alpha: 0.85 },
];

const rnd = (a, b) => a + Math.random() * (b - a);

export function initSecret(ink) {
  const secret = document.getElementById('secret');
  const canvas = document.getElementById('scribble');
  let revealed = false;
  let checks = 0;

  function draw() {
    if (revealed) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.strokeStyle = SCRIBBLE_COLOR;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // The word sits in the middle of the canvas with a margin around it.
    // Strokes overshoot the word by a random amount so the edges stay ragged.
    const mx = 12;
    const my = 9;
    const W = r.width - mx * 2;
    const H = r.height - my * 2;
    const cx = r.width / 2;
    const cy = r.height / 2;
    const rotate = (x, y, a) => [
      cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
      cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
    ];

    PASSES.forEach((pass) => {
      c.globalAlpha = pass.alpha;
      c.lineWidth = pass.width;
      c.beginPath();
      let dir = 1;
      let first = true;
      for (let t = my - 4; t < my + H + 4; t += pass.step) {
        const over0 = rnd(2, 10);
        const over1 = rnd(2, 10);
        const xa = dir > 0 ? mx - over0 : mx + W + over0;
        const xb = dir > 0 ? mx + W + over1 : mx - over1;
        const p0 = rotate(xa, t + rnd(-2, 2), pass.angle);
        const p1 = rotate(xb, t + pass.step * 0.55 + rnd(-2, 2), pass.angle);
        const qx = (p0[0] + p1[0]) / 2 + rnd(-5, 5);
        const qy = (p0[1] + p1[1]) / 2 + rnd(-4, 4);
        if (first) {
          c.moveTo(p0[0], p0[1]);
          first = false;
        }
        c.quadraticCurveTo(qx, qy, p1[0], p1[1]);
        dir = -dir;
      }
      c.stroke();
    });

    c.globalAlpha = 0.8;
    c.lineWidth = 4.5;
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      c.moveTo(mx + rnd(-6, W * 0.25), my + rnd(-4, H));
      c.lineTo(mx + W - rnd(-6, W * 0.25), my + rnd(-4, H));
      c.stroke();
    }
  }

  function coverage(c) {
    const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let on = 0;
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 37) {
      n++;
      if (data[i] > 40) on++;
    }
    return on / n;
  }

  function eraseAt(clientX, clientY) {
    if (revealed) return;
    const r = canvas.getBoundingClientRect();
    if (clientX < r.left - 20 || clientX > r.right + 20 || clientY < r.top - 20 || clientY > r.bottom + 20) return;
    const scale = canvas.width / r.width;
    const c = canvas.getContext('2d');
    c.save();
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(clientX - r.left, clientY - r.top, 11, 0, Math.PI * 2);
    c.fill();
    c.restore();
    if (++checks % CHECK_EVERY === 0 && coverage(c) < REVEAL_BELOW) {
      revealed = true;
      secret.classList.add('revealed');
      ink.showHint('There it is. Type it into the terminal.');
    }
  }

  ink.onErase(eraseAt);
  new ResizeObserver(draw).observe(canvas);
  draw();
}
