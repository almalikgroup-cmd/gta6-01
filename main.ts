// Entry point for the gta6-01 make.fun bounty: SOLMAR HEAT, an original
// top-down open-world crime game that lives in this directory's game/ folder
// as plain static files (game/index.html plus vanilla ES modules — no
// libraries, no build step, no network requests, so it runs fully offline in
// a desktop browser). This program is only the delivery plumbing: it copies
// game/ and screenshots/ from beside this file into the output directory and
// writes dossier.json there with the vendored make.fun library, which is the
// summary the judges score.
//
// Run it with:  MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container.)
// Then serve the copied game/ folder with any static file server and open
// index.html to play.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps below mirror the scorer's own limits: at most 4 screenshots of
// 256 KiB each, at most 993 game files totalling 48 MiB, no game path longer
// than 1000 bytes, and 160 KiB of dossier text.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`gta6-01: SOLMAR HEAT packaged into ${out} (game/ + screenshots/ + dossier.json)`);
