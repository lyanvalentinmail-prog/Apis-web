import { useState } from 'react';
import { cx } from './ui';

export interface Snippet {
  label: string;
  language: string;
  code: string;
}

export function CodeBlock({ snippets, className }: { snippets: Snippet[]; className?: string }) {
  const [active, setActive] = useState(0);
  const snippet = snippets[active] ?? snippets[0];

  return (
    <div className={cx('overflow-hidden rounded-xl border border-line bg-black/50', className)}>
      <div className="flex items-center gap-1 border-b border-line bg-white/[0.03] px-2 py-1.5">
        {snippets.map((item, index) => (
          <button
            key={item.label}
            onClick={() => setActive(index)}
            className={cx(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition',
              index === active ? 'bg-brat/15 text-brat' : 'text-muted hover:text-zinc-200'
            )}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto pr-1">
          <CopyButton value={snippet?.code ?? ''} />
        </span>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed">
        <code className="font-mono text-zinc-200 whitespace-pre">{snippet?.code}</code>
      </pre>
    </div>
  );
}

export function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback para navegadores sin permisos de portapapeles
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
        copied ? 'border-brat/50 bg-brat/15 text-brat' : 'border-line bg-white/5 text-muted hover:text-zinc-100'
      )}
    >
      {copied ? '✓ Copiado' : label}
    </button>
  );
}
