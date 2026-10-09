import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bratUrl, downloadBrat, fetchBrat } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { BratParams } from '../types';
import { Button, Card, Field, Input, Select, Spinner, cx } from './ui';
import { CopyButton } from './CodeBlock';

export const PRESETS: { name: string; bg: string; color: string }[] = [
  { name: 'brat', bg: '#8ACE00', color: '#0A2A00' },
  { name: 'lima', bg: '#A3FF00', color: '#0A2A00' },
  { name: 'blanco', bg: '#FFFFFF', color: '#111111' },
  { name: 'negro', bg: '#000000', color: '#8ACE00' },
  { name: 'crema', bg: '#EFE6D8', color: '#1A1A1A' },
  { name: 'rosa', bg: '#FF90E8', color: '#2B0020' },
  { name: 'azul', bg: '#0055FF', color: '#FFFFFF' },
  { name: 'morado', bg: '#8A2BE2', color: '#FFFFFF' },
  { name: 'naranja', bg: '#FF6B00', color: '#1A0A00' },
  { name: 'rojo', bg: '#E4002B', color: '#FFFFFF' },
];

const SIZES = [256, 512, 720, 1080, 1440, 2048];

export interface BratStudioProps {
  initial?: Partial<BratParams>;
  className?: string;
  showCode?: boolean;
}

/**
 * Generador en vivo: cada cambio llama a la API real (GET /v1/brat).
 * Si el usuario tiene sesión puede enviar la petición con su API key.
 */
export function BratStudio({ initial, className, showCode = true }: BratStudioProps) {
  const { token } = useAuth();
  const [params, setParams] = useState<BratParams>({
    text: 'brat',
    size: 720,
    background: '#8ACE00',
    color: '#0A2A00',
    blur: 28,
    bold: true,
    italic: false,
    transform: 'lower',
    align: 'center',
    padding: 9,
    radius: 0,
    format: 'png',
    quality: 90,
    ...initial,
  });
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ ms: number; bytes: number } | null>(null);
  const objectUrl = useRef<string | null>(null);

  const update = useCallback(<K extends keyof BratParams>(key: K, value: BratParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const started = performance.now();
      try {
        const url = bratUrl(params);
        // Precargamos para no parpadear: solo se cambia el src cuando la imagen está lista.
        if (params.format === 'svg') {
          const image = await fetchBrat(params, token);
          if (cancelled) return;
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = image.url;
          setSrc(image.url);
          setMeta({ ms: image.ms, bytes: image.blob.size });
        } else {
          const image = new Image();
          image.src = url;
          await image.decode().catch(() => undefined);
          if (cancelled) return;
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = null;
          setSrc(url);
          setMeta({ ms: Math.round(performance.now() - started), bytes: 0 });
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [params, token]);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const curl = useMemo(
    () => `curl "${bratUrl(params)}" -o sticker.${params.format === 'jpeg' ? 'jpg' : params.format}`,
    [params]
  );

  const activePreset = PRESETS.find((p) => p.bg.toLowerCase() === String(params.background).toLowerCase());

  return (
    <div className={cx('grid gap-5 lg:grid-cols-[1fr_420px]', className)}>
      {/* Previsualización */}
      <Card className="flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-black/40">
          {src ? (
            <img
              src={src}
              alt={`Sticker brat: ${params.text}`}
              className={cx('h-full w-full object-contain transition-opacity', loading && 'opacity-50')}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">Generando…</div>
          )}
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="h-6 w-6 text-brat" />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-center text-sm text-red-300">{error}</p>
        ) : meta ? (
          <p className="text-center text-xs text-muted">
            {params.size}×{params.size} px · {params.format?.toUpperCase()}
            {meta.bytes ? ` · ${(meta.bytes / 1024).toFixed(1)} KB` : ''}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => downloadBrat(params)}>Descargar</Button>
          <Button variant="ghost" onClick={() => window.open(bratUrl(params), '_blank')}>
            Abrir
          </Button>
          <CopyButton value={bratUrl(params)} label="Copiar URL" />
        </div>
      </Card>

      {/* Controles */}
      <Card className="space-y-4">
        <Field label="Texto" hint="Usa Enter para varias líneas">
          <textarea
            className="input min-h-[86px] resize-y text-base"
            value={params.text}
            maxLength={240}
            onChange={(e) => update('text', e.target.value)}
            placeholder="escribe algo…"
          />
        </Field>

        <Field label="Fondo">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                onClick={() => {
                  update('background', preset.bg);
                  update('color', preset.color);
                }}
                className={cx(
                  'h-8 w-8 rounded-lg border transition',
                  activePreset?.name === preset.name ? 'border-brat ring-2 ring-brat/40' : 'border-line hover:border-zinc-500'
                )}
                style={{ background: preset.bg }}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              type="color"
              className="h-10 w-14 cursor-pointer p-1"
              value={normalizeHex(params.background)}
              onChange={(e) => update('background', e.target.value)}
              aria-label="Color de fondo"
            />
            <Input
              type="color"
              className="h-10 w-14 cursor-pointer p-1"
              value={normalizeHex(params.color)}
              onChange={(e) => update('color', e.target.value)}
              aria-label="Color del texto"
            />
            <Input
              className="flex-1 font-mono text-xs"
              value={String(params.background)}
              onChange={(e) => update('background', e.target.value)}
              placeholder="#8ACE00"
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tamaño (px)">
            <Select value={params.size} onChange={(e) => update('size', Number(e.target.value))}>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Formato">
            <Select value={params.format} onChange={(e) => update('format', e.target.value as BratParams['format'])}>
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </Select>
          </Field>
        </div>

        <Field label="Desenfoque" hint={String(params.blur)}>
          <input
            type="range"
            min={0}
            max={100}
            value={params.blur}
            onChange={(e) => update('blur', Number(e.target.value))}
            className="w-full accent-brat"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Mayúsculas">
            <Select value={params.transform} onChange={(e) => update('transform', e.target.value as BratParams['transform'])}>
              <option value="lower">minúsculas</option>
              <option value="upper">MAYÚSCULAS</option>
              <option value="none">tal cual</option>
            </Select>
          </Field>
          <Field label="Alineación">
            <Select value={params.align} onChange={(e) => update('align', e.target.value as BratParams['align'])}>
              <option value="center">centro</option>
              <option value="left">izquierda</option>
              <option value="right">derecha</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" className="accent-brat" checked={!!params.bold} onChange={(e) => update('bold', e.target.checked)} />
            Negrita
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" className="accent-brat" checked={!!params.italic} onChange={(e) => update('italic', e.target.checked)} />
            Cursiva
          </label>
          <Field label="Redondeo">
            <Input
              type="number"
              min={0}
              value={params.radius}
              onChange={(e) => update('radius', Number(e.target.value))}
            />
          </Field>
        </div>

        {showCode ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Petición equivalente</p>
            <code className="block overflow-x-auto rounded-lg border border-line bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
              {curl}
            </code>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function normalizeHex(value: string | undefined): string {
  const raw = (value ?? '#8ACE00').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return '#8ACE00';
}
