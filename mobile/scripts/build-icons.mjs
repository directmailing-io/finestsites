#!/usr/bin/env node
/**
 * Baut App-Icons und Startbildschirm-Logos reproduzierbar aus den Quell-SVGs in assets/brand/:
 *   f-mark.svg      – das „f“ aus der Wortmarke (nur der Buchstabe, viewBox zugeschnitten)
 *   logo-black.svg  – Wortmarke dunkel (public/logos/logo-black.svg)
 *   logo-white.svg  – Wortmarke hell  (public/logos/logo-white.svg)
 *
 * Benötigt: rsvg-convert (librsvg) und magick (ImageMagick), z. B. `brew install librsvg imagemagick`.
 * Aufruf:   node scripts/build-icons.mjs
 *
 * Ergebnis (assets/brand/):
 *   icon.png                1024² opak, ohne Alpha-Kanal: weißer Grund, f in #1a1a1a (wie Sidebar/Wortmarke)
 *   icon-dark.png           iOS 18+ dunkel: transparenter Grund, f weiß (iOS legt den dunklen Verlauf darunter)
 *   icon-tinted.png         iOS 18+ getönt: transparenter Grund, f weiß (iOS färbt ein)
 *   adaptive-foreground.png Android: f in #1a1a1a, innerhalb der 66-%-Sicherheitszone
 *   adaptive-monochrome.png Android 13+ Themen-Icon: Silhouette
 *   notification-icon.png   Android-Mitteilungen: weißes f auf transparent
 *   splash-logo.png         Startbildschirm hell: Wortmarke dunkel (3× für imageWidth 200)
 *   splash-logo-dark.png    Startbildschirm dunkel: Wortmarke weiß
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const brand = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'brand');
const tmp = mkdtempSync(join(tmpdir(), 'fs-icons-'));

const INK = '#1a1a1a';
const fSvg = readFileSync(join(brand, 'f-mark.svg'), 'utf8');
const fPath = /<path[^>]* d="([^"]+)"/.exec(fSvg)[1];
const [, , F_W, F_H] = /viewBox="([^"]+)"/.exec(fSvg)[1].split(/\s+/).map(Number);

/**
 * Leinwand mit dem f. `glyphHeight` = Anteil der Kantenlänge, den das f hoch sein soll.
 * Das f ist hoch und schmal; optisch mittig heißt hier: Begrenzungsrahmen exakt mittig
 * (die beiden Schlaufen gleichen sich oben/unten aus).
 */
function fCanvas(size, { bg, fill, glyphHeight }) {
  const h = size * glyphHeight;
  const scale = h / F_H;
  const w = F_W * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
<g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(5)})"><path fill="${fill}" d="${fPath}"/></g>
</svg>`;
}

function render(svg, out, { opaque = false, width } = {}) {
  const src = join(tmp, 'in.svg');
  writeFileSync(src, svg);
  const args = width ? ['-w', String(width), '-o', join(brand, out), src] : ['-o', join(brand, out), src];
  execFileSync('rsvg-convert', args);
  // Apple: App-Icon ohne Transparenz und ohne Alpha-Kanal
  if (opaque) execFileSync('magick', [join(brand, out), '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-type', 'TrueColor', 'PNG24:' + join(brand, out)]);
  console.log('✓', out);
}

// iOS: Innenabstand oben/unten je 24 % → f ist 52 % der Kantenlänge hoch (Breite ≈ 28 %).
render(fCanvas(1024, { bg: '#FFFFFF', fill: INK, glyphHeight: 0.52 }), 'icon.png', { opaque: true });
render(fCanvas(1024, { fill: '#FFFFFF', glyphHeight: 0.52 }), 'icon-dark.png');
render(fCanvas(1024, { fill: '#FFFFFF', glyphHeight: 0.52 }), 'icon-tinted.png');

// Android adaptiv: sichtbarer Kreis ≈ 66 % → f 40 % hoch bleibt sicher innen.
render(fCanvas(1024, { fill: INK, glyphHeight: 0.4 }), 'adaptive-foreground.png');
render(fCanvas(1024, { fill: '#000000', glyphHeight: 0.4 }), 'adaptive-monochrome.png');
render(fCanvas(96, { fill: '#FFFFFF', glyphHeight: 0.8 }), 'notification-icon.png');

// Startbildschirm: Wortmarke, 600 px breit (= 200 pt @3x)
render(readFileSync(join(brand, 'logo-black.svg'), 'utf8'), 'splash-logo.png', { width: 600 });
render(readFileSync(join(brand, 'logo-white.svg'), 'utf8'), 'splash-logo-dark.png', { width: 600 });

rmSync(tmp, { recursive: true, force: true });
