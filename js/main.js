import { openNotebook } from './cover.js';
import { initSketch } from './sketch.js';
import { createInk } from './ink.js';
import { createFluid } from './fluid.js';
import { createDesk } from './desk.js';
import { createTerminal } from './terminal.js';
import { initEggGame } from './egg.js';
import { initLisp } from './repl.js';
import { initSecret } from './secret.js';

const sheet = document.getElementById('sheet');

openNotebook();

initSketch();
createDesk(sheet);
const ink = createInk(sheet, createFluid(sheet));
initSecret(ink);
const terminal = createTerminal();
initEggGame(terminal);
initLisp(terminal);
