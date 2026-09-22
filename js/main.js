import { initSketch } from './sketch.js';
import { createInk } from './ink.js';
import { createDesk } from './desk.js';
import { createTerminal } from './terminal.js';
import { initEggGame } from './egg.js';
import { initSecret } from './secret.js';

const sheet = document.getElementById('sheet');

initSketch();
createDesk(sheet);
const ink = createInk(sheet);
initSecret(ink);
initEggGame(createTerminal());
