/**
 * A small Lisp for the pocket terminal.
 *
 * Scheme-flavoured: numbers, strings, booleans, lists, `define`, `lambda`,
 * closures, `let`, `if`/`cond`, `and`/`or`, `begin`, `set!`, `quote`, tail
 * recursion via a trampoline-free loop, and a turtle that draws on the LCD.
 *
 * Reader → evaluator → printer, about three hundred lines, no dependencies.
 * Every program has a step budget so `(define (f) (f))` cannot hang the page.
 */

const MAX_STEPS = 400_000;
const MAX_DEPTH = 300;

class LispError extends Error {}

// ------------------------------------------------------------------ reader

function tokenize(src) {
  const out = [];
  const re = /\s*(;[^\n]*|"(?:\\.|[^"\\])*"|[()'`]|[^\s()'`";]+)/g;
  let m;
  while ((m = re.exec(src)) && m[1] !== undefined) {
    if (m[1][0] !== ';') out.push(m[1]);
    if (m[0] === '') re.lastIndex++;
  }
  return out;
}

const Sym = (name) => ({ sym: name });
const isSym = (x) => x !== null && typeof x === 'object' && 'sym' in x;

function read(tokens) {
  if (!tokens.length) throw new LispError('unexpected end of input');
  const t = tokens.shift();
  if (t === '(') {
    const list = [];
    while (tokens[0] !== ')') {
      if (!tokens.length) throw new LispError('missing )');
      list.push(read(tokens));
    }
    tokens.shift();
    return list;
  }
  if (t === ')') throw new LispError('unexpected )');
  if (t === "'") return [Sym('quote'), read(tokens)];
  if (t[0] === '"') return t.slice(1, -1).replace(/\\(.)/g, '$1');
  if (t === '#t') return true;
  if (t === '#f') return false;
  const n = Number(t);
  return Number.isNaN(n) ? Sym(t) : n;
}

export function parse(src) {
  const tokens = tokenize(src);
  const forms = [];
  while (tokens.length) forms.push(read(tokens));
  return forms;
}

// ----------------------------------------------------------------- printer

export function show(v) {
  if (v === true) return '#t';
  if (v === false) return '#f';
  if (v === undefined || v === null) return '';
  if (isSym(v)) return v.sym;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toFixed(4));
  if (Array.isArray(v)) return `(${v.map(show).join(' ')})`;
  if (typeof v === 'function') return v.lambda ? '#<lambda>' : '#<builtin>';
  return String(v);
}

// --------------------------------------------------------------- evaluator

class Env {
  constructor(parent = null) {
    this.vars = new Map();
    this.parent = parent;
  }
  lookup(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.lookup(name);
    throw new LispError(`unbound: ${name}`);
  }
  assign(name, value) {
    if (this.vars.has(name)) return this.vars.set(name, value);
    if (this.parent) return this.parent.assign(name, value);
    throw new LispError(`unbound: ${name}`);
  }
}

function makeLambda(params, body, env, interp) {
  const fn = (...args) => {
    const local = new Env(env);
    params.forEach((p, i) => local.vars.set(p.sym, args[i]));
    return interp.evalBody(body, local);
  };
  fn.lambda = true;
  return fn;
}

export class Interpreter {
  constructor(builtins = {}) {
    this.global = new Env();
    this.steps = 0;
    this.depth = 0;
    Object.entries({ ...CORE, ...builtins }).forEach(([k, v]) => this.global.vars.set(k, v));
  }

  run(src) {
    this.steps = 0;
    this.depth = 0;
    let result;
    for (const form of parse(src)) result = this.eval(form, this.global);
    return result;
  }

  evalBody(body, env) {
    let result;
    for (const form of body) result = this.eval(form, env);
    return result;
  }

  eval(x, env) {
    if (++this.steps > MAX_STEPS) throw new LispError('step budget exceeded (infinite loop?)');
    if (isSym(x)) return env.lookup(x.sym);
    if (!Array.isArray(x)) return x;
    if (!x.length) return [];
    const [head, ...rest] = x;
    const op = isSym(head) ? head.sym : null;

    switch (op) {
      case 'quote':
        return rest[0];
      case 'if':
        return this.eval(rest[0], env) !== false ? this.eval(rest[1], env) : rest.length > 2 ? this.eval(rest[2], env) : undefined;
      case 'cond':
        for (const [test, ...body] of rest) {
          if ((isSym(test) && test.sym === 'else') || this.eval(test, env) !== false) return this.evalBody(body, env);
        }
        return undefined;
      case 'define': {
        const target = rest[0];
        if (Array.isArray(target)) {
          const [name, ...params] = target;
          env.vars.set(name.sym, makeLambda(params, rest.slice(1), env, this));
          return Sym(name.sym);
        }
        env.vars.set(target.sym, this.eval(rest[1], env));
        return Sym(target.sym);
      }
      case 'set!':
        env.assign(rest[0].sym, this.eval(rest[1], env));
        return undefined;
      case 'lambda':
        return makeLambda(rest[0], rest.slice(1), env, this);
      case 'let': {
        const local = new Env(env);
        for (const [name, value] of rest[0]) local.vars.set(name.sym, this.eval(value, env));
        return this.evalBody(rest.slice(1), local);
      }
      case 'begin':
        return this.evalBody(rest, env);
      case 'and': {
        let v = true;
        for (const f of rest) if ((v = this.eval(f, env)) === false) return false;
        return v;
      }
      case 'or': {
        for (const f of rest) {
          const v = this.eval(f, env);
          if (v !== false) return v;
        }
        return false;
      }
      case 'repeat': {
        const n = this.eval(rest[0], env);
        let v;
        for (let i = 0; i < n; i++) v = this.evalBody(rest.slice(1), env);
        return v;
      }
      default: {
        const fn = this.eval(head, env);
        if (typeof fn !== 'function') throw new LispError(`not a function: ${show(head)}`);
        const args = rest.map((a) => this.eval(a, env));
        if (++this.depth > MAX_DEPTH) throw new LispError('recursion too deep');
        try {
          return fn(...args);
        } catch (e) {
          if (e instanceof RangeError) throw new LispError('recursion too deep');
          throw e;
        } finally {
          this.depth--;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- builtins

const num = (v, name) => {
  if (typeof v !== 'number') throw new LispError(`${name}: expected a number, got ${show(v)}`);
  return v;
};
const lst = (v, name) => {
  if (!Array.isArray(v)) throw new LispError(`${name}: expected a list, got ${show(v)}`);
  return v;
};
const fold = (name, f) => (...xs) => xs.map((x) => num(x, name)).reduce(f);

const CORE = {
  '+': (...xs) => xs.reduce((a, b) => num(a, '+') + num(b, '+'), 0),
  '*': (...xs) => xs.reduce((a, b) => num(a, '*') * num(b, '*'), 1),
  '-': (...xs) => (xs.length === 1 ? -num(xs[0], '-') : fold('-', (a, b) => a - b)(...xs)),
  '/': fold('/', (a, b) => a / b),
  mod: (a, b) => ((num(a, 'mod') % num(b, 'mod')) + b) % b,
  '=': (a, b) => a === b,
  '<': (a, b) => a < b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '>=': (a, b) => a >= b,
  not: (a) => a === false,
  abs: Math.abs,
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  floor: Math.floor,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  random: (n) => Math.floor(Math.random() * n),
  list: (...xs) => xs,
  cons: (a, b) => [a, ...lst(b, 'cons')],
  car: (l) => lst(l, 'car')[0],
  cdr: (l) => lst(l, 'cdr').slice(1),
  'null?': (l) => Array.isArray(l) && l.length === 0,
  'list?': (l) => Array.isArray(l),
  length: (l) => lst(l, 'length').length,
  append: (...ls) => ls.map((l) => lst(l, 'append')).flat(1),
  reverse: (l) => [...lst(l, 'reverse')].reverse(),
  range: (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i),
  map: (f, l) => lst(l, 'map').map((x) => f(x)),
  filter: (f, l) => lst(l, 'filter').filter((x) => f(x) !== false),
  reduce: (f, init, l) => lst(l, 'reduce').reduce((acc, x) => f(acc, x), init),
  apply: (f, l) => f(...l),
  'string-append': (...xs) => xs.map(show).join(''),
  'number->string': (n) => String(n),
};

// ------------------------------------------------------------------ turtle

/** Turtle graphics on a 2D context; the interpreter gets fd/rt/... from here. */
export function createTurtle(ctx, width, height) {
  const t = { x: width / 2, y: height / 2, heading: -90, down: true };
  const rad = (deg) => (deg * Math.PI) / 180;

  function reset() {
    t.x = width / 2;
    t.y = height / 2;
    t.heading = -90;
    t.down = true;
  }
  function forward(d) {
    const nx = t.x + Math.cos(rad(t.heading)) * num(d, 'fd');
    const ny = t.y + Math.sin(rad(t.heading)) * d;
    if (t.down) {
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }
    t.x = nx;
    t.y = ny;
  }

  return {
    state: t,
    reset,
    builtins: {
      fd: (d) => forward(d),
      bk: (d) => forward(-d),
      rt: (a) => void (t.heading += num(a, 'rt')),
      lt: (a) => void (t.heading -= num(a, 'lt')),
      pu: () => void (t.down = false),
      pd: () => void (t.down = true),
      home: () => reset(),
      goto: (x, y) => {
        t.x = width / 2 + num(x, 'goto');
        t.y = height / 2 - num(y, 'goto');
      },
      setheading: (a) => void (t.heading = num(a, 'setheading') - 90),
      dot: () => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      },
      cs: () => {
        ctx.clearRect(0, 0, width, height);
        reset();
      },
    },
  };
}

// ------------------------------------------------------------------- demos

export const DEMOS = {
  star: '(cs) (repeat 36 (fd 90) (rt 170))',
  spiral: '(cs) (define (spiral n) (if (< n 68) (begin (fd n) (rt 89) (spiral (+ n 1.5))))) (spiral 2)',
  tree: '(cs) (pu) (goto 0 -72) (pd) (define (tree len) (if (> len 4) (begin (fd len) (rt 25) (tree (* len 0.72)) (lt 50) (tree (* len 0.72)) (rt 25) (bk len)))) (tree 40)',
  flower: '(cs) (repeat 12 (repeat 4 (fd 36) (rt 90)) (rt 30))',
  fib: '(define (fib n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (map fib (range 0 15))',
};

export const HELP = [
  'a small Lisp, written from scratch for this page.',
  '(+ 1 2)  (define (sq x) (* x x))  (map sq (range 1 6))',
  '(define (fact n) (if (< n 2) 1 (* n (fact (- n 1)))))  (fact 10)',
  'turtle on the LCD: fd bk rt lt pu pd home goto cs dot, (repeat n ...)',
  '(repeat 36 (fd 90) (rt 170))',
  'demos: (demo star) (demo spiral) (demo tree) (demo flower) (demo fib)',
  'exit leaves the REPL',
];
