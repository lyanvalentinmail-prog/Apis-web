/**
 * Tablas de avance de Liberation Sans / Arial (unidades por 1000 em, índice = charCode - 32).
 * Sirven para ajustar el texto al lienzo sin depender de un motor de tipografía.
 */
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Métricas verticales de Arial/Liberation Sans en em. */
export const FONT_METRICS = {
  capHeight: 0.716,
  xHeight: 0.519,
  descender: 0.212,
  ascender: 0.905,
} as const;

const ASCENDERS = 'bdfhkltABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$&@#%?!/\\()[]{}|';
const DESCENDERS = 'gjpqyQ$&@#()[]{}/\\,';

function widthOf(char: string, bold: boolean): number {
  const index = char.charCodeAt(0) - 32;
  if (index < 0 || index >= REGULAR.length) return 556;
  return (bold ? BOLD : REGULAR)[index] ?? 556;
}

/** Ancho aproximado del texto en em (1 em = fontSize). */
export function measureTextEm(text: string, opts: { bold?: boolean; tracking?: number } = {}): number {
  const { bold = false, tracking = 0 } = opts;
  let width = 0;
  for (const char of text) width += widthOf(char, bold) / 1000;
  return width + tracking * Math.max(0, text.length - 1);
}

export interface LineMetrics {
  /** Altura sobre la línea base (em). */
  above: number;
  /** Profundidad bajo la línea base (em). */
  below: number;
}

export function lineMetrics(line: string): LineMetrics {
  const hasAscender = [...line].some((c) => ASCENDERS.includes(c));
  const hasDescender = [...line].some((c) => DESCENDERS.includes(c));
  return {
    above: hasAscender ? FONT_METRICS.capHeight : FONT_METRICS.xHeight,
    below: hasDescender ? FONT_METRICS.descender : 0,
  };
}

export const FONT_STACK = "'Liberation Sans', Arial, Helvetica, sans-serif";
