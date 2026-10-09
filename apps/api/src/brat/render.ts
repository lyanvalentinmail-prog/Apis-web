import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { ApiError } from '../lib/errors.js';
import { FONT_METRICS, FONT_STACK, lineMetrics, measureTextEm } from './fonts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** assets/fonts tanto en local (src/) como compilado (dist/) y en Vercel. */
export const FONT_DIRS = [
  path.resolve(here, '../../assets/fonts'),
  path.resolve(here, '../assets/fonts'),
  path.resolve(process.cwd(), 'assets/fonts'),
];

export type BratFormat = 'png' | 'jpeg' | 'webp' | 'svg';
export type TextTransform = 'lower' | 'upper' | 'none';
export type Align = 'left' | 'center' | 'right';

export interface BratOptions {
  text: string;
  size?: number;
  width?: number;
  height?: number;
  background?: string;
  color?: string;
  /** 0-100 (0 = sin desenfoque). Por defecto 28. */
  blur?: number;
  bold?: boolean;
  italic?: boolean;
  /** 0.6 - 2, separación entre líneas. */
  lineHeight?: number;
  /** Espaciado entre letras en em (negativo = más junto). */
  tracking?: number;
  transform?: TextTransform;
  align?: Align;
  /** Margen interior en % del lado corto. */
  padding?: number;
  /** Tamaño de fuente fijo (px); si se omite se calcula para que encaje. */
  fontSize?: number;
  /** Esquinas redondeadas en px. */
  radius?: number;
  format?: BratFormat;
  /** Calidad 1-100 para jpeg/webp. */
  quality?: number;
}

export const BRAT_GREEN = '#8ACE00';

export const BACKGROUND_PRESETS: Record<string, string> = {
  brat: BRAT_GREEN,
  lime: '#A3FF00',
  white: '#FFFFFF',
  black: '#000000',
  cream: '#EFE6D8',
  pink: '#FF90E8',
  blue: '#0055FF',
  purple: '#8A2BE2',
  orange: '#FF6B00',
  red: '#E4002B',
};

const DEFAULT_COLOR = '#0A2A00';

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function resolveColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const preset = BACKGROUND_PRESETS[value.trim().toLowerCase()];
  if (preset) return preset;
  const raw = value.trim();
  if (HEX_COLOR.test(raw)) return raw;
  if (/^[a-z]+$/i.test(raw) || /^rgb/i.test(raw) || raw.startsWith('hsl')) return raw; // se pasa tal cual al SVG
  throw ApiError.badRequest(`Color inválido: "${value}". Usa un hex (#8ACE00) o un preset: ${Object.keys(BACKGROUND_PRESETS).join(', ')}`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(text: string, transform: TextTransform): string {
  switch (transform) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    default:
      return text;
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fontFiles(): Promise<string[]> {
  for (const dir of FONT_DIRS) {
    try {
      const files = await readdir(dir);
      const ttf = files.filter((f) => f.toLowerCase().endsWith('.ttf')).map((f) => path.join(dir, f));
      if (ttf.length) return ttf;
    } catch {
      /* siguiente candidato */
    }
  }
  return [];
}

interface Layout {
  width: number;
  height: number;
  lines: { text: string; baseline: number; anchor: 'start' | 'middle' | 'end'; x: number }[];
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  blur: number;
}

function layout(options: Required<Pick<BratOptions, 'text' | 'size'>> & BratOptions): Layout {
  const width = Math.round(clamp(options.width ?? options.size, 16, 4096));
  const height = Math.round(clamp(options.height ?? options.size, 16, 4096));
  const bold = options.bold ?? true;
  const italic = options.italic ?? false;
  const tracking = options.tracking ?? 0;
  const lineHeight = options.lineHeight ?? 1.02;
  const paddingPct = clamp(options.padding ?? 9, 0, 40);
  const padding = (Math.min(width, height) * paddingPct) / 100;
  const align = (options.align ?? 'center') as Align;

  const rawLines = normalizeText(options.text, options.transform ?? 'lower').split(/\r?\n/);
  const lines = rawLines.length ? rawLines : [''];

  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  // Ancho en em de la línea más larga.
  const widest = Math.max(...lines.map((l) => measureTextEm(l, { bold, tracking })), 0.001);

  // Altura total en em: Σ(above + below) + (n-1) * lineHeight.
  const metrics = lines.map(lineMetrics);
  const inkEm = metrics.reduce((acc, m) => acc + m.above + m.below, 0) + (lines.length - 1) * lineHeight;

  const fitByWidth = innerWidth / widest;
  const fitByHeight = innerHeight / Math.max(inkEm, 0.001);
  const fontSize = clamp(options.fontSize ?? Math.min(fitByWidth, fitByHeight), 4, 4096);

  // Las métricas vienen en em: se escalan al tamaño de fuente final.
  const lh = fontSize * lineHeight;
  const first = metrics[0] ?? { above: FONT_METRICS.xHeight, below: 0 };
  const last = metrics[metrics.length - 1] ?? first;
  const abovePx = first.above * fontSize;
  const belowPx = last.below * fontSize;
  const blockInk = (lines.length - 1) * lh + belowPx + abovePx;
  /** Centra el bloque de tinta real (sin contar el espacio de descendentes vacío). */
  const baseline0 = height / 2 - blockInk / 2 + abovePx;

  const x = align === 'left' ? padding : align === 'right' ? width - padding : width / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';

  return {
    width,
    height,
    fontSize,
    blur: 0,
    fontFamily: FONT_STACK,
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
    lines: lines.map((text, i) => ({ text, baseline: baseline0 + i * lh, anchor, x })),
  };
}

export function buildSvg(options: BratOptions & { text: string; size: number }): { svg: string; width: number; height: number; fontSize: number } {
  const background = resolveColor(options.background, BRAT_GREEN);
  const color = resolveColor(options.color, DEFAULT_COLOR);
  const blurStrength = clamp(options.blur ?? 28, 0, 100);
  const radius = clamp(options.radius ?? 0, 0, Math.floor(Math.min(options.size, options.height ?? options.size) / 2));

  const l = layout(options);
  const shortSide = Math.min(l.width, l.height);
  const stdDeviation = (blurStrength / 1000) * shortSide;

  const blurFilter =
    stdDeviation > 0
      ? `<filter id="brat-blur" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${stdDeviation.toFixed(3)}"/></filter>`
      : '';

  const clip =
    radius > 0
      ? `<clipPath id="brat-clip"><rect x="0" y="0" width="${l.width}" height="${l.height}" rx="${radius}" ry="${radius}"/></clipPath>`
      : '';

  const textNodes = l.lines
    .map((line) => {
      const letterSpacing = options.tracking ? ` letter-spacing="${(options.tracking * l.fontSize).toFixed(2)}"` : '';
      return `<text x="${line.x.toFixed(2)}" y="${line.baseline.toFixed(2)}" text-anchor="${line.anchor}"${letterSpacing}>${escapeXml(line.text)}</text>`;
    })
    .join('\n      ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}" height="${l.height}" viewBox="0 0 ${l.width} ${l.height}">
  <defs>
    ${blurFilter}
    ${clip}
  </defs>
  <g${radius > 0 ? ' clip-path="url(#brat-clip)"' : ''}>
    <rect x="0" y="0" width="${l.width}" height="${l.height}"${radius > 0 ? ` rx="${radius}" ry="${radius}"` : ''} fill="${background}"/>
    <g${stdDeviation > 0 ? ' filter="url(#brat-blur)"' : ''} fill="${color}" font-family="${l.fontFamily}" font-size="${l.fontSize.toFixed(2)}" font-weight="${l.fontWeight}" font-style="${l.fontStyle}">
      ${textNodes}
    </g>
  </g>
</svg>`;

  return { svg, width: l.width, height: l.height, fontSize: l.fontSize };
}

export interface RenderedBrat {
  buffer: Buffer;
  contentType: string;
  format: BratFormat;
  width: number;
  height: number;
  fontSize: number;
}

/** Renderiza el sticker: SVG directo o PNG/JPEG/WebP rasterizando con resvg (+ sharp). */
export async function renderBrat(options: BratOptions & { text: string }): Promise<RenderedBrat> {
  const size = Math.round(clamp(options.size ?? options.width ?? 1080, 16, 4096));
  const format: BratFormat = options.format ?? 'png';
  const { svg, width, height, fontSize } = buildSvg({ ...options, size });

  if (format === 'svg') {
    return { buffer: Buffer.from(svg, 'utf8'), contentType: 'image/svg+xml', format, width, height, fontSize };
  }

  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Liberation Sans',
      fontFiles: await fontFiles(),
    },
    fitTo: { mode: 'width', value: width },
  });
  const png = Buffer.from(resvg.render().asPng());

  if (format === 'png') {
    return { buffer: png, contentType: 'image/png', format, width, height, fontSize };
  }

  // JPEG / WebP necesitan sharp (dependencia opcional en el bundle).
  let sharp: typeof import('sharp').default | null = null;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    sharp = null;
  }
  if (!sharp) {
    throw ApiError.badRequest('El formato solicitado requiere sharp instalado. Usa format=png o format=svg.');
  }

  const quality = clamp(Math.round(options.quality ?? 90), 1, 100);
  const buffer =
    format === 'jpeg'
      ? await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer()
      : await sharp(png).webp({ quality }).toBuffer();

  return {
    buffer,
    contentType: format === 'jpeg' ? 'image/jpeg' : 'image/webp',
    format,
    width,
    height,
    fontSize,
  };
}
