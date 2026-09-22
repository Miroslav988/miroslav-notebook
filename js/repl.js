/**
 * The `lisp` command: a REPL on the pocket terminal with a turtle canvas
 * at the top of the LCD. See lisp.js for the language itself.
 */

import { Interpreter, createTurtle, show, DEMOS, HELP } from './lisp.js';

const W = 380;
const H = 150;
const INK = '#1c2a1e';

const KEYS_HTML = `
  <button class="key" type="button" data-insert="(">(</button>
  <button class="key" type="button" data-insert=")">)</button>
  <button class="key" type="button" data-insert="(fd 50) ">fd</button>
  <button class="key" type="button" data-insert="(rt 90) ">rt</button>
  <button class="key" type="button" data-insert="(repeat 4 ">repeat</button>
  <button class="key" type="button" data-cmd="(demo tree)">demo</button>
  <button class="key" type="button" data-cmd="(cs)">cs</button>
  <button class="key c" type="button" data-cmd="exit">EXIT</button>
`;

export function initLisp(terminal) {
  let interp = null;
  let canvas = null;
  let pane = null;
  let resizer = null;

  function enter() {
    canvas = document.createElement('canvas');
    canvas.className = 'turtle';
    canvas.width = W * 2;
    canvas.height = H * 2;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Turtle graphics canvas');
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';

    const turtle = createTurtle(ctx, W, H);
    interp = new Interpreter({
      ...turtle.builtins,
      demo: (name) => {
        const src = DEMOS[typeof name === 'string' ? name : show(name)];
        if (!src) throw new Error(`no such demo. try: ${Object.keys(DEMOS).join(', ')}`);
        return interp.run(src);
      },
      print: (...xs) => say(xs.map(show).join(' ')),
      help: () => say(HELP.slice(1, 6).join('   ')),
    });

    pane = document.createElement('div');
    pane.className = 'repl-out';
    terminal.lcd.innerHTML = '';
    terminal.lcd.classList.add('repl');
    terminal.lcd.append(canvas, pane);
    fit();
    resizer = new ResizeObserver(fit);
    resizer.observe(terminal.lcd.parentElement);
    terminal.enterMode(evaluate, KEYS_HTML, pane);
    say('λ ready. (help) for the tour, exit to leave.');
    terminal.input.placeholder = '(repeat 36 (fd 90) (rt 170))';
  }

  // The canvas spans the LCD's width and keeps its aspect; the LCD grows to fit.
  function fit() {
    if (!canvas) return;
    const style = getComputedStyle(terminal.lcd);
    const innerW = terminal.lcd.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    canvas.style.width = `${Math.floor(innerW)}px`;
    canvas.style.height = `${Math.floor(innerW * (H / W))}px`;
  }

  // Two lines under the drawing: the latest results, errors or notes.
  function say(text, cls) {
    terminal.print(text, cls);
    while (pane.children.length > 2) pane.firstChild.remove();
  }

  function leave() {
    if (resizer) resizer.disconnect();
    terminal.exitMode();
    terminal.lcd.classList.remove('repl');
    terminal.lcd.innerHTML = '';
    terminal.input.placeholder = 'help';
    interp = null;
    canvas = null;
    terminal.print('back to the shell. type help');
  }

  function evaluate(line) {
    if (line.toLowerCase() === 'exit' || line.toLowerCase() === '(exit)') return leave();
    // (demo tree) reads naturally but `tree` would be evaluated as a variable;
    // treat the demo name as a bare word instead of asking for a quote.
    const demo = line.match(/^\(\s*demo\s+'?([a-z]+)\s*\)$/i);
    try {
      const result = demo ? interp.run(DEMOS[demo[1].toLowerCase()] ?? `(demo "${demo[1]}")`) : interp.run(line);
      const text = show(result);
      say(text || 'ok');
    } catch (e) {
      say(`error: ${e.message}`, 'err');
    }
  }

  terminal.register(['lisp', 'repl', 'scheme'], enter);
}
