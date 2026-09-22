/**
 * Ink on paper, simulated as a fluid.
 *
 * Jos Stam's "Stable Fluids" (SIGGRAPH 1999): velocity and density fields on
 * a grid, diffusion by Gauss-Seidel relaxation, semi-Lagrangian advection and
 * a pressure projection that keeps the flow divergence-free, which is what
 * makes ink curl into vortices instead of just blurring.
 *
 * Each drop gets its own small simulation tile placed on the sheet, so the
 * cost stays constant no matter how long the page is. Wet ink slowly dries
 * into a stain; a tile stops simulating once nothing in it moves.
 */

const TILE_PX = 420; // css px, square
const GRID = 96; // cells per side
const ITERATIONS = 10;
const DIFFUSION = 0.000006;
const VISCOSITY = 0.00004;
const DT = 0.12;
const DRY_RATE = 0.018;
const IDLE_FRAMES = 90;

class FluidTile {
  constructor(container, left, top) {
    this.left = left;
    this.top = top;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fluid-tile';
    this.canvas.width = GRID;
    this.canvas.height = GRID;
    this.canvas.style.cssText = `left:${left}px;top:${top}px;width:${TILE_PX}px;height:${TILE_PX}px`;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(GRID, GRID);
    const n = (GRID + 2) * (GRID + 2);
    this.dens = new Float32Array(n);
    this.densPrev = new Float32Array(n);
    this.u = new Float32Array(n);
    this.uPrev = new Float32Array(n);
    this.v = new Float32Array(n);
    this.vPrev = new Float32Array(n);
    this.stain = new Float32Array(n);
    this.raf = 0;
    this.idle = 0;
  }

  contains(x, y) {
    return x >= this.left && x < this.left + TILE_PX && y >= this.top && y < this.top + TILE_PX;
  }

  // ---- solver (N = GRID, arrays are (N+2)^2 with a one-cell border) ----

  static ix(i, j) {
    return i + j * (GRID + 2);
  }

  setBoundary(b, x) {
    const N = GRID;
    const ix = FluidTile.ix;
    for (let i = 1; i <= N; i++) {
      x[ix(i, 0)] = b === 2 ? -x[ix(i, 1)] : x[ix(i, 1)];
      x[ix(i, N + 1)] = b === 2 ? -x[ix(i, N)] : x[ix(i, N)];
      x[ix(0, i)] = b === 1 ? -x[ix(1, i)] : x[ix(1, i)];
      x[ix(N + 1, i)] = b === 1 ? -x[ix(N, i)] : x[ix(N, i)];
    }
    x[ix(0, 0)] = 0.5 * (x[ix(1, 0)] + x[ix(0, 1)]);
    x[ix(0, N + 1)] = 0.5 * (x[ix(1, N + 1)] + x[ix(0, N)]);
    x[ix(N + 1, 0)] = 0.5 * (x[ix(N, 0)] + x[ix(N + 1, 1)]);
    x[ix(N + 1, N + 1)] = 0.5 * (x[ix(N, N + 1)] + x[ix(N + 1, N)]);
  }

  linearSolve(b, x, x0, a, c) {
    const N = GRID;
    const ix = FluidTile.ix;
    const inv = 1 / c;
    for (let k = 0; k < ITERATIONS; k++) {
      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          x[ix(i, j)] = (x0[ix(i, j)] + a * (x[ix(i - 1, j)] + x[ix(i + 1, j)] + x[ix(i, j - 1)] + x[ix(i, j + 1)])) * inv;
        }
      }
      this.setBoundary(b, x);
    }
  }

  diffuse(b, x, x0, rate) {
    const a = DT * rate * GRID * GRID;
    this.linearSolve(b, x, x0, a, 1 + 4 * a);
  }

  advect(b, d, d0, u, v) {
    const N = GRID;
    const ix = FluidTile.ix;
    const dt0 = DT * N;
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        let x = i - dt0 * u[ix(i, j)];
        let y = j - dt0 * v[ix(i, j)];
        x = Math.min(Math.max(x, 0.5), N + 0.5);
        y = Math.min(Math.max(y, 0.5), N + 0.5);
        const i0 = Math.floor(x);
        const j0 = Math.floor(y);
        const s1 = x - i0;
        const t1 = y - j0;
        const s0 = 1 - s1;
        const t0 = 1 - t1;
        d[ix(i, j)] = s0 * (t0 * d0[ix(i0, j0)] + t1 * d0[ix(i0, j0 + 1)]) + s1 * (t0 * d0[ix(i0 + 1, j0)] + t1 * d0[ix(i0 + 1, j0 + 1)]);
      }
    }
    this.setBoundary(b, d);
  }

  project(u, v, p, div) {
    const N = GRID;
    const ix = FluidTile.ix;
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        div[ix(i, j)] = (-0.5 * (u[ix(i + 1, j)] - u[ix(i - 1, j)] + v[ix(i, j + 1)] - v[ix(i, j - 1)])) / N;
        p[ix(i, j)] = 0;
      }
    }
    this.setBoundary(0, div);
    this.setBoundary(0, p);
    this.linearSolve(0, p, div, 1, 4);
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        u[ix(i, j)] -= 0.5 * N * (p[ix(i + 1, j)] - p[ix(i - 1, j)]);
        v[ix(i, j)] -= 0.5 * N * (p[ix(i, j + 1)] - p[ix(i, j - 1)]);
      }
    }
    this.setBoundary(1, u);
    this.setBoundary(2, v);
  }

  step() {
    let { u, uPrev, v, vPrev, dens, densPrev } = this;
    [u, uPrev] = [uPrev, u];
    this.diffuse(1, u, uPrev, VISCOSITY);
    [v, vPrev] = [vPrev, v];
    this.diffuse(2, v, vPrev, VISCOSITY);
    this.project(u, v, uPrev, vPrev);
    [u, uPrev] = [uPrev, u];
    [v, vPrev] = [vPrev, v];
    this.advect(1, u, uPrev, uPrev, vPrev);
    this.advect(2, v, vPrev, uPrev, vPrev);
    this.project(u, v, uPrev, vPrev);
    [dens, densPrev] = [densPrev, dens];
    this.diffuse(0, dens, densPrev, DIFFUSION);
    [dens, densPrev] = [densPrev, dens];
    this.advect(0, dens, densPrev, u, v);
    Object.assign(this, { u, uPrev, v, vPrev, dens, densPrev });

    const { stain } = this;
    for (let k = 0; k < dens.length; k++) {
      const wet = dens[k];
      if (wet > 0.006) {
        const dried = wet * DRY_RATE;
        stain[k] = Math.min(1, stain[k] + dried);
        dens[k] = wet - dried;
      } else if (wet > 0) {
        dens[k] = 0; // too thin to leave a mark: it just evaporates
      }
    }
  }

  render() {
    const px = this.image.data;
    const ix = FluidTile.ix;
    let moving = 0;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const k = ix(i + 1, j + 1);
        const wet = this.dens[k];
        const dry = this.stain[k];
        const raw = wet * 2.2 + Math.max(0, dry - 0.01) * 1.5;
        const a = raw < 0.04 ? 0 : Math.min(1, raw);
        const o = (i + j * GRID) * 4;
        px[o] = 20 + dry * 14; // wet ink is blue-black and glossy,
        px[o + 1] = 30 + dry * 12; // the stain flatter and warmer
        px[o + 2] = 82 - dry * 24;
        px[o + 3] = a * 255;
        if (wet > 0.01) moving++;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    return moving;
  }

  wake() {
    this.idle = 0;
    if (!this.raf) this.raf = requestAnimationFrame(() => this.loop());
  }

  loop() {
    this.step();
    const moving = this.render();
    this.idle = moving ? 0 : this.idle + 1;
    this.raf = this.idle < IDLE_FRAMES ? requestAnimationFrame(() => this.loop()) : 0;
  }

  splat(x, y, radius, amount, vx, vy) {
    const N = GRID;
    const ix = FluidTile.ix;
    const ci = Math.round(((x - this.left) / TILE_PX) * N);
    const cj = Math.round(((y - this.top) / TILE_PX) * N);
    const r2 = radius * radius;
    for (let dj = -radius; dj <= radius; dj++) {
      for (let di = -radius; di <= radius; di++) {
        const d2 = di * di + dj * dj;
        const i = ci + di;
        const j = cj + dj;
        if (d2 > r2 || i < 1 || i > N || j < 1 || j > N) continue;
        const k = ix(i, j);
        const falloff = 1 - d2 / (r2 + 1);
        this.dens[k] = Math.min(3, this.dens[k] + amount * falloff);
        this.u[k] += vx * falloff;
        this.v[k] += vy * falloff;
      }
    }
    this.wake();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}

export function createFluid(sheet) {
  const container = document.getElementById('fluid');
  let tiles = [];

  // sheet-local coordinates of a pointer position
  function local(clientX, clientY) {
    const r = sheet.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  }

  function tileAt(x, y, create) {
    let tile = tiles.find((t) => t.contains(x, y));
    if (!tile && create) {
      const left = Math.min(Math.max(x - TILE_PX / 2, 0), sheet.clientWidth - TILE_PX);
      const top = Math.min(Math.max(y - TILE_PX / 2, 0), sheet.clientHeight - TILE_PX);
      tile = new FluidTile(container, left, top);
      tiles.push(tile);
    }
    return tile;
  }

  return {
    /** A drop of ink: a blob with a little random swirl so no two look alike. */
    drop(clientX, clientY) {
      const [x, y] = local(clientX, clientY);
      const angle = Math.random() * Math.PI * 2;
      tileAt(x, y, true).splat(x, y, 6, 2.4, Math.cos(angle) * 0.22, Math.sin(angle) * 0.22);
    },
    /** Dragging pushes the ink along the pointer's motion. */
    smear(clientX, clientY, dx, dy) {
      const [x, y] = local(clientX, clientY);
      const tile = tileAt(x, y, false);
      if (tile) tile.splat(x, y, 3, 0.22, dx * 0.7, dy * 0.7);
    },
    clear() {
      tiles.forEach((t) => t.destroy());
      tiles = [];
    },
  };
}
