// Copia las fuentes TTF (Liberation Sans, métricas compatibles con Arial)
// desde node_modules a apps/api/assets/fonts para que el generador Brat
// funcione igual en local y en Vercel (sin depender de fuentes del sistema).
import { copyFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/@typopro/dtp-liberation');
const dest = path.join(root, 'apps/api/assets/fonts');

const files = [
  ['TypoPRO-LiberationSans-Regular.ttf', 'LiberationSans-Regular.ttf'],
  ['TypoPRO-LiberationSans-Bold.ttf', 'LiberationSans-Bold.ttf'],
  ['TypoPRO-LiberationSans-Italic.ttf', 'LiberationSans-Italic.ttf'],
  ['TypoPRO-LiberationSans-BoldItalic.ttf', 'LiberationSans-BoldItalic.ttf'],
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(src))) {
    console.warn('[fonts] @typopro/dtp-liberation no encontrado: se usarán las fuentes del sistema.');
    return;
  }
  await mkdir(dest, { recursive: true });
  await Promise.all(
    files.map(async ([from, to]) => {
      if (await exists(path.join(src, from))) {
        await copyFile(path.join(src, from), path.join(dest, to));
      }
    })
  );
  console.log('[fonts] fuentes Brat listas en apps/api/assets/fonts');
}

main().catch((err) => {
  console.warn('[fonts] no se pudieron copiar las fuentes:', err.message);
});
