# Miroslav's Notebook

My personal site, built as a paper notebook: a HELLO sticker, taped-in printouts, pencil notes in the
margins, hand-drawn charts, a pocket terminal, and a few things you can only find by poking around.

**Live:** https://miroslav988.github.io/miroslav-notebook/

## What's on the page

- **Drawing layer.** The pencil case in the corner is real: pencil, two markers, a highlighter and an
  eraser. Strokes are smoothed with quadratic curves, support pen pressure and coalesced pointer events,
  and are stored in fractions of the page width so a drawing survives a resize. Nothing is saved.
- **Desk objects.** The pencil, eraser, paper clip and ruler on the page can be dragged and thrown.
  Velocity is estimated from the last few pointer samples; the objects slide with friction and bounce
  off the sheet's edges.
- **Pocket terminal.** A small command line (`help` lists the commands). It answers things the page
  itself doesn't say, keeps a history, and doubles as a calculator. One command isn't listed.
- **Charts and doodles drawn in.** SVG strokes are measured at load and animated as the reader scrolls
  to them. Doodles get a pencil-wobble filter and a second, fainter stroke so they don't read as icons.
- **The egg.** Find it, erase it, type it.

## Stack

Plain HTML, CSS and ES modules. No framework, no build step, no dependencies beyond Google Fonts.

```
index.html          markup
css/notebook.css    styles
js/main.js          wires the modules together
js/ink.js           drawing layer and pencil case
js/desk.js          draggable desk objects
js/terminal.js      pocket terminal and its commands
js/egg.js           the hidden game
js/secret.js        the scribbled-over word
js/sketch.js        draw-in animations and hand-drawn strokes
```

## Run locally

ES modules need an HTTP origin, so open it through any static server:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Deploy

It's a static folder. GitHub Pages serves it from the `main` branch root; any other static host works
the same way.

## License

MIT for the code. The texts and drawings are mine; please don't reuse them as your own.
