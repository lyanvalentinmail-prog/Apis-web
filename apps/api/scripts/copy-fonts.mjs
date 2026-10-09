// Copia las fuentes TTF (Liberation Sans, mismas métricas que Arial) desde
// node_modules a assets/fonts. Se ejecuta en el postinstall para que el
// generador Brat funcione igual en local y en Vercel, sin depender de las
// fuentes del sistema. Las fuentes también están versionadas como respaldo.
import { copyFile, mkdir, access } from 'node:fs/promises';
import { accessSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, '../node_modules/@typopro/dtp-liberation'), // install dentro de apps/api
  path.resolve(here, '../../../node_modules/@typopro/dtp-liberation'), // workspaces (raíz del repo)
];
const dest = path.resolve(here, '../assets/fonts');

const files = [
  ['TypoPRO-LiberationSans-Regular.ttf', 'LiberationSans-Regular.ttf'],
  ['TypoPRO-LiberationSans-Bold.ttf', 'LiberationSans-Bold.ttf'],
  ['TypoPRO-LiberationSans-Italic.ttf', 'LiberationSans-Italic.ttf'],
  ['TypoPRO-LiberationSans-BoldItalic.ttf', 'LiberationSans-BoldItalic.ttf'],
];

function exists(p) {
  try {
    accessSync(p);
    return true;
  } catch {
    return false;
  }
}

const src = candidates.find(exists);

if (!src) {
  console.warn('[fonts] @typopro/dtp-liberation no encontrado; se usarán las fuentes versionadas o las del sistema.');
} else {
  await mkdir(dest, { recursive: true });
  for (const [from, to] of files) {
    if (exists(path.join(src, from))) {
      await copyFile(path.join(src, from), path.join(dest, to));
    }
  }
  console.log('[fonts] fuentes listas en apps/api/assets/fonts');
}
