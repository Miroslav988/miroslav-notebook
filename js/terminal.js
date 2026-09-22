/**
 * The pocket terminal: a command line that knows things the page doesn't say.
 * Other modules register commands through `register`; the egg game also takes
 * over the LCD and the key row for a while.
 */

const SHIPPING_SINCE = new Date('2022-03-01T00:00:00Z');

const RESPONSES = {
  help: [
    'commands: stack, experience, projects, numbers, contact',
    '          path, origin, renairo, flame, desk, story, wiki',
    '          decisions, uptime, fortune, whoami, ls, cat <file>, now, clear',
    '          lisp  (a small Lisp with turtle graphics, written for this page)',
    '(one more is not listed)',
  ],
  stack: [
    'FRONT  React, Next.js, Vue 3, Nuxt 3, TypeScript',
    'BACK   Node.js, Express, Python, FastAPI',
    'DATA   PostgreSQL, pgvector, Drizzle, TypeORM',
    'INFRA  Docker, GitLab CI/CD, AWS, Nginx, Traefik',
    'AI     RAG pipelines, LLM APIs, multi-model routing',
  ],
  experience: [
    '2025-now  Renairo — co-founder, lead full-stack engineer',
    '2024-25   Siberian Neural Networks — full-stack developer',
    '2022-23   Media Research Family — web developer, automation',
    '',
    '4+ years total. Details taped in above.',
  ],
  projects: [
    'Flame          relationship-management app, AI voice input, encryption',
    'Rental tool    payments, meters, reports for landlords (in use)',
    'Knowledge wiki RAG over internal data + external news',
  ],
  numbers: [
    'cloud spend after infra rebuild ...... -50%',
    'feature delivery cycle ......... 14d -> 3-4d',
    'years shipping ........................ 4+',
    'bench press ......................... 125kg',
  ],
  contact: [
    'mail   mirokbaka@gmail.com',
    'github github.com/Miroslav988',
    'li     linkedin.com/in/miroslav-bakaev-2569103ab',
    'base   Amsterdam, NL · visa sponsorship needed',
  ],
  path: [
    'Novosibirsk  economics at NSU, unfinished. a restaurant job.',
    '             then: someone who built websites, and I asked to try.',
    'remote       Practicum + freeCodeCamp -> first web job (2022)',
    'Bangkok      own flat, too quiet. co-founded a B2B SaaS from there',
    'Amsterdam    2026. here now. next: a team stronger than mine',
  ],
  origin: [
    'I was packing delivery orders in a restaurant. decided something',
    'had to change. a family friend made websites, so I asked to try.',
    'he took my learning on himself. first code I ever copied was his.',
  ],
  renairo: [
    'B2B SaaS: analyse a sales team, then build one that works.',
    'started at a conference: I sat in a corner with a laptop, working.',
    'someone asked what I was building. year one was not about code,',
    'it was about finding out what to build. many theories, one worked.',
  ],
  flame: [
    'built for me, used by me. not released: it holds personal data',
    'and doing that right means studying privacy law properly.',
    'no time to do that honestly, so it stays private.',
  ],
  desk: [
    'laptop 1  mac, macOS + linux',
    'laptop 2  windows',
    'monitor, coffee, a book, a paper notebook (this page is that notebook)',
  ],
  story: ['stories: story leak | story scraper | story blame | story disks'],
  'story leak': [
    'A container leaked memory slowly for days. No per-container metrics, so',
    'nobody saw it until it got killed under load. Fixed the leak, then fixed',
    'the real thing: limits, metrics, alerts on every service, day one.',
  ],
  'story scraper': [
    'Target sites detected headless browsers. So: a HEADED browser on a VM',
    'with no GPU and no display. Flags, rendering, resource limits, a pipeline',
    'that survives crashes and rate limits. Then an LLM that had to return the',
    'same structure every time: prompt iterations, strict validation, retries.',
  ],
  'story blame': [
    'A lead asked me to fix "my" bad code. git blame said it was his.',
    "I fixed it and pushed. Nobody needed to know. The product didn't care.",
  ],
  'story disks': [
    'I forget to watch leftover build artifacts on VM disks. the disk fills,',
    "I lose access, everything gets reset. more than once. it's on the list.",
  ],
  wiki: [
    'from my security wiki, top of the page:',
    ' 1. every input is hostile, including your own admin panel',
    ' 2. secrets never reach the client. check the bundle, not the docs',
    ' 3. least privilege for ports, tokens, IAM, people',
    " 4. if you can't explain how it breaks, you don't know how it works",
  ],
  decisions: [
    'would do differently today:',
    ' - memory limits + metrics before the first feature',
    ' - observability as part of the feature, not after',
    ' - review every AI suggestion: they leak env vars and open ports',
    'would do again:',
    ' - rebuild the infra nobody asked for (-50% spend, 14d -> 3-4d)',
  ],
  english: ['learned everywhere, all the time. working in it daily is the point.'],
  routine: ["the one thing I can't stand. I want to build something new, always."],
  weekend: ['mostly: work. otherwise: active rest. bench press 125kg.'],
  whoami: [
    'miroslav bakaev',
    'full-stack engineer · ex co-founder · amsterdam',
    'uid=4+years gid=react,node,python groups=rag,llm,aws',
  ],
  ls: ['cv.txt  stack.txt  wiki.md  flame/  rental/  notebook.html  .secrets (permission denied)'],
  'cat cv.txt': ['see the taped-in pages above. or: linkedin.com/in/miroslav-bakaev-2569103ab'],
  'cat wiki.md': ["that's private. try: wiki"],
  'cat .secrets': ["nice try. that's rule 2."],
  hi: ['hi. type help.'],
  hello: ['hi. type help.'],
};

const FORTUNES = [
  'observability is part of the feature.',
  'fix the code, not the blame.',
  'the tool optimises for "it works". you optimise for "it\'s safe".',
  'a leak found late is expensive. a limit set early is free.',
  'nobody asks for the infra rebuild. do it anyway.',
  'read the cloud bill like an accountant.',
];

const ARITHMETIC = /^[\d\s+\-*/().%]+$/;

function uptime() {
  const days = Math.floor((Date.now() - SHIPPING_SINCE) / 864e5);
  const years = Math.floor(days / 365.25);
  const rest = days - Math.floor(years * 365.25);
  const load = (base) => (base + Math.random() * 0.3).toFixed(2);
  return [
    `up ${years} years, ${rest} days  (shipping since 2022-03)`,
    `load: react ${load(0.6)}, node ${load(0.4)}, python ${load(0.3)}`,
  ];
}

function calculate(expr) {
  try {
    const value = Function(`"use strict"; return (${expr.replace(/%/g, '/100')})`)();
    return Number.isFinite(value) ? String(+value.toFixed(6)) : 'ERR';
  } catch {
    return 'ERR';
  }
}

export function createTerminal() {
  const lcd = document.getElementById('lcd');
  const input = document.getElementById('cmd');
  const form = document.getElementById('termform');
  const keys = document.querySelector('.device .keys');
  const defaultKeys = keys.innerHTML;
  const history = [];
  const commands = new Map();
  let historyIndex = -1;
  let locked = false;
  let mode = null; // a handler that owns the input line (the Lisp REPL)
  let output = lcd; // where print() writes; a mode may swap in its own pane

  function print(lines, cls) {
    (Array.isArray(lines) ? lines : [lines]).forEach((line) => {
      const row = document.createElement('div');
      if (cls) row.className = cls;
      row.textContent = line;
      output.appendChild(row);
    });
    output.scrollTop = output.scrollHeight;
  }

  function clear() {
    output.innerHTML = '';
  }

  function run(raw) {
    const line = (raw || '').trim();
    if (!line) return;
    if (locked) {
      print('game running. arrows / WASD to move, Esc to quit', 'err');
      return;
    }
    history.push(line);
    historyIndex = -1;
    if (mode) return mode(line);

    const cmd = line.toLowerCase().replace(/\s+/g, ' ');
    print(`> ${cmd}`, 'in');

    if (['clear', 'c', 'cls'].includes(cmd)) return clear();
    if (commands.has(cmd)) return commands.get(cmd)();
    if (cmd === 'now') {
      const d = new Date();
      return print(`${d.toISOString().slice(0, 10)}  ${d.toTimeString().slice(0, 5)}  status: open to work`);
    }
    if (cmd === 'uptime') return print(uptime());
    if (cmd === 'fortune') return print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]);
    if (cmd === 'history') return print(history.slice(0, -1).map((h, i) => `${i + 1}  ${h}`).join('\n') || '(empty)');
    if (cmd === 'sudo hire' || cmd === 'hire') return print('permission granted. write to mirokbaka@gmail.com');
    if (RESPONSES[cmd]) return print(RESPONSES[cmd]);
    if (cmd.startsWith('cat ')) return print(`cat: ${cmd.slice(4)}: no such file`, 'err');
    if (ARITHMETIC.test(cmd)) return print(calculate(cmd));
    return print(`ERR: unknown command "${cmd}". try help`, 'err');
  }

  function bindKeys() {
    keys.querySelectorAll('.key[data-cmd]').forEach((key) => {
      key.addEventListener('click', () => {
        run(key.dataset.cmd);
        if (!locked) input.focus({ preventScroll: true });
      });
    });
    keys.querySelectorAll('.key[data-insert]').forEach((key) => {
      key.addEventListener('click', () => {
        const text = key.dataset.insert;
        const at = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, at) + text + input.value.slice(at);
        input.focus({ preventScroll: true });
        input.setSelectionRange(at + text.length, at + text.length);
      });
    });
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    run(input.value);
    input.value = '';
  });

  input.addEventListener('keydown', (ev) => {
    if (locked) {
      ev.preventDefault();
      return;
    }
    if (ev.key === 'ArrowUp') {
      historyIndex = Math.max(0, (historyIndex < 0 ? history.length : historyIndex) - 1);
      input.value = history[historyIndex] || '';
      ev.preventDefault();
    } else if (ev.key === 'ArrowDown') {
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    }
  });

  bindKeys();
  print('MB-4 ready. type help');

  return {
    lcd,
    keys,
    print,
    clear,
    register(names, handler) {
      (Array.isArray(names) ? names : [names]).forEach((name) => commands.set(name, handler));
    },
    /** Route every input line to `handler` until it calls exit(); swap the key row meanwhile. */
    enterMode(handler, keysHtml, pane) {
      mode = handler;
      output = pane || lcd;
      if (keysHtml) {
        keys.innerHTML = keysHtml;
        keys.classList.add('mode');
        bindKeys();
      }
    },
    exitMode() {
      mode = null;
      output = lcd;
      keys.innerHTML = defaultKeys;
      keys.classList.remove('mode');
      bindKeys();
    },
    get input() {
      return input;
    },
    /** Hand the LCD and the key row to another mode (the game). */
    lock(keysHtml) {
      locked = true;
      input.blur();
      clear();
      lcd.classList.add('playing');
      keys.innerHTML = keysHtml;
      keys.classList.add('game');
      bindKeys();
    },
    unlock() {
      locked = false;
      lcd.classList.remove('playing');
      clear();
      keys.innerHTML = defaultKeys;
      keys.classList.remove('game');
      bindKeys();
    },
  };
}
