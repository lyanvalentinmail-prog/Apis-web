import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import type { Align, BratFormat, BratOptions, TextTransform } from './render.js';

/** Acepta booleanos como true/false, 1/0, yes/no, on/off (típico de query strings). */
const bool = (fallback: boolean) =>
  z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value === '') return fallback;
      if (typeof value === 'boolean') return value;
      const raw = String(value).trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on', 'si', 'sí'].includes(raw)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
      ctx.addIssue({ code: 'custom', message: `Booleano inválido: "${value}"` });
      return z.NEVER;
    });

const num = (min: number, max: number, fallback?: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null || value === '') {
        if (fallback === undefined) return undefined;
        return fallback;
      }
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: 'custom', message: `Número inválido: "${value}"` });
        return z.NEVER;
      }
      return Math.min(max, Math.max(min, parsed));
    });

export const bratSchema = z.object({
  text: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/\r\n/g, '\n'))
    .refine((v) => v.trim().length > 0, { message: 'El parámetro "text" es obligatorio' })
    .refine((v) => v.length <= 240, { message: 'El texto no puede superar 240 caracteres' }),
  size: num(16, 4096, 1080),
  width: num(16, 4096),
  height: num(16, 4096),
  background: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  blur: num(0, 100, 28),
  bold: bool(true),
  italic: bool(false),
  lineHeight: num(0.6, 3, 1.02),
  tracking: num(-0.5, 1, 0),
  transform: z.enum(['lower', 'upper', 'none']).optional().default('lower'),
  align: z.enum(['left', 'center', 'right']).optional().default('center'),
  padding: num(0, 40, 9),
  fontSize: num(4, 4096),
  radius: num(0, 2048, 0),
  format: z.enum(['png', 'jpeg', 'jpg', 'webp', 'svg']).optional().default('png'),
  quality: num(1, 100, 90),
  download: bool(false),
});

export type BratInput = z.infer<typeof bratSchema>;

/** Alias cortos para que la API sea cómoda por query string. */
const ALIASES: Record<string, string> = {
  t: 'text',
  q: 'text',
  s: 'size',
  w: 'width',
  h: 'height',
  bg: 'background',
  fg: 'color',
  text_color: 'color',
  textcolor: 'color',
  font_size: 'fontSize',
  fontsize: 'fontSize',
  line_height: 'lineHeight',
  fmt: 'format',
  jpg: 'format',
};

/** Normaliza query params o cuerpo JSON al mismo objeto de opciones. */
export function parseBratInput(input: Record<string, unknown>): BratInput & { format: BratFormat | 'jpg' } {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const target = ALIASES[key] ?? key;
    if (key === 'jpg' && (value === true || value === '1' || value === 'true')) {
      normalized.format = 'jpeg';
      continue;
    }
    if (normalized[target] === undefined) normalized[target] = value;
  }
  const result = bratSchema.safeParse(normalized);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));
    throw ApiError.badRequest('Parámetros inválidos', details);
  }
  return result.data as BratInput & { format: BratFormat | 'jpg' };
}

export function toBratOptions(input: BratInput & { format: BratFormat | 'jpg' }): BratOptions {
  return {
    text: input.text,
    size: input.size,
    width: input.width,
    height: input.height,
    background: input.background,
    color: input.color,
    blur: input.blur,
    bold: input.bold,
    italic: input.italic,
    lineHeight: input.lineHeight,
    tracking: input.tracking,
    transform: input.transform as TextTransform,
    align: input.align as Align,
    padding: input.padding,
    fontSize: input.fontSize,
    radius: input.radius,
    format: (input.format === 'jpg' ? 'jpeg' : input.format) as BratFormat,
    quality: input.quality,
  };
}

export function bratFilename(input: BratInput & { format: BratFormat | 'jpg' }): string {
  const slug =
    input.text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'brat';
  const format = input.format === 'jpg' ? 'jpeg' : input.format;
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `brat-${slug}-${input.size ?? 1080}.${ext}`;
}
