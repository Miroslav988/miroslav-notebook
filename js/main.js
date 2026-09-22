import { initSketch } from './sketch.js';
import { createInk } from './ink.js';
import { createDesk } from './desk.js';
import { createTerminal } from './terminal.js';
import { initEggGame } from './egg.js';
import { initLisp } from './repl.js';
import { initSecret } from './secret.js';
import { initLamp } from './lamp.js';
import { initPaper } from './paper.js';
import { writeHeadings } from './handwriting.js';

const sheet = document.getElementById('sheet');


initSketch();
createDesk(sheet);
const ink = createInk(sheet);
initSecret(ink);
const terminal = createTerminal();
initEggGame(terminal);
initLisp(terminal);
initLamp(sheet);
initPaper();
writeHeadings();
