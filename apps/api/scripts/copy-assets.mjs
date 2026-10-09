// Copia assets (fuentes) al dist para que funcionen tras compilar.
import { cp, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(path.join(root, 'dist', 'assets'), { recursive: true });
try {
  await access(path.join(root, 'assets'));
  await cp(path.join(root, 'assets'), path.join(root, 'dist', 'assets'), { recursive: true });
  console.log('[api] assets copiados a dist/assets');
} catch {
  console.warn('[api] sin carpeta assets que copiar');
}
