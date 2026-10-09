import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildSvg, renderBrat, BRAT_GREEN } from '../src/brat/render.js';
import { parseBratInput, toBratOptions } from '../src/brat/schema.js';
import { measureTextEm } from '../src/brat/fonts.js';

test('buildSvg genera un SVG con el texto y el fondo correctos', () => {
  const { svg, width, height } = buildSvg({ text: 'brat', size: 512, background: 'brat', color: '#123456' });
  assert.equal(width, 512);
  assert.equal(height, 512);
  assert.ok(svg.includes('#8ACE00'));
  assert.ok(svg.includes('#123456'));
  assert.ok(svg.includes('>brat</text>'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
});

test('por defecto el texto pasa a minúsculas y el fondo es el verde brat', () => {
  const { svg } = buildSvg({ text: 'BRAT', size: 300 });
  assert.ok(svg.includes('>brat</text>'));
  assert.ok(svg.includes(BRAT_GREEN));
});

test('transform=none respeta las mayúsculas', () => {
  const { svg } = buildSvg({ text: 'BRAT', size: 300, transform: 'none' });
  assert.ok(svg.includes('>BRAT</text>'));
});

test('el texto multilínea genera un <text> por línea', () => {
  const { svg } = buildSvg({ text: 'hola\nmundo', size: 400 });
  assert.equal(svg.match(/<text /g)?.length, 2);
});

test('renderBrat devuelve PNG, JPEG y WebP válidos', async () => {
  const png = await renderBrat({ text: 'brat', size: 256, format: 'png' });
  assert.equal(png.contentType, 'image/png');
  const meta = await sharp(png.buffer).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.format, 'png');

  const jpeg = await renderBrat({ text: 'brat', size: 128, format: 'jpeg' });
  assert.equal((await sharp(jpeg.buffer).metadata()).format, 'jpeg');

  const webp = await renderBrat({ text: 'brat', size: 128, format: 'webp' });
  assert.equal((await sharp(webp.buffer).metadata()).format, 'webp');
});

test('renderBrat devuelve SVG como texto', async () => {
  const svg = await renderBrat({ text: 'brat', size: 200, format: 'svg' });
  assert.equal(svg.contentType, 'image/svg+xml');
  assert.ok(svg.buffer.toString('utf8').startsWith('<svg'));
});

test('el texto se ajusta al ancho disponible', async () => {
  const short = await renderBrat({ text: 'brat', size: 600, format: 'svg' });
  const long = await renderBrat({ text: 'un texto mucho más largo que el anterior', size: 600, format: 'svg' });
  assert.ok(long.fontSize < short.fontSize, 'el texto largo debe usar una fuente menor');
});

test('el sticker queda centrado en el lienzo', async () => {
  const { buffer, width, height } = await renderBrat({ text: 'brat', size: 400, blur: 0, format: 'png' });
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const isInk = (i: number) => Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 120;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * info.channels;
      if (!isInk(i)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  assert.ok(Math.abs(centerX - width / 2) < width * 0.02, `centro horizontal ${centerX}`);
  assert.ok(Math.abs(centerY - height / 2) < height * 0.02, `centro vertical ${centerY}`);
});

test('parseBratInput valida y normaliza la entrada', () => {
  const parsed = parseBratInput({ t: 'hola', s: '512', bold: 'false', fmt: 'svg' });
  assert.equal(parsed.text, 'hola');
  assert.equal(parsed.size, 512);
  assert.equal(parsed.bold, false);
  assert.equal(parsed.format, 'svg');

  const detailsOf = (input: Record<string, unknown>) => {
    try {
      parseBratInput(input);
      assert.fail('debería lanzar');
    } catch (err) {
      return (err as { details?: { field: string; message: string }[] }).details ?? [];
    }
  };

  const missingText = detailsOf({});
  assert.ok(missingText.some((d) => d.field === 'text'), JSON.stringify(missingText));

  const badBlur = detailsOf({ text: 'hola', blur: 'mucho' });
  assert.ok(badBlur.some((d) => d.field === 'blur' && /Número/.test(d.message)), JSON.stringify(badBlur));
});

test('los límites se recortan al rango permitido', () => {
  const options = toBratOptions(parseBratInput({ text: 'x', size: '99999', blur: '-40', padding: '80' }));
  assert.equal(options.size, 4096);
  assert.equal(options.blur, 0);
  assert.equal(options.padding, 40);
});

test('las tablas de avance distinguen negrita de regular', () => {
  assert.ok(measureTextEm('brat', { bold: true }) > measureTextEm('brat', { bold: false }));
  assert.ok(measureTextEm('mm', { bold: false }) > measureTextEm('ii', { bold: false }));
});
