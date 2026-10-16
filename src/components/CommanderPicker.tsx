import { useEffect, useRef, useState } from 'react';
import { getCard, searchCommanders } from '../scryfall';
import type { CardRef } from '../types';
import { Pips } from '../ui';

export default function CommanderPicker({
  value,
  onChange,
  placeholder = 'Search commanders',
}: {
  value?: CardRef;
  onChange: (c: CardRef | undefined) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const ctl = new AbortController();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setStatus('loading');
      try {
        const r = await searchCommanders(q, ctl.signal);
        setResults(r);
        setStatus(r.length ? 'idle' : 'empty');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus('error');
      }
    }, 280);
    return () => ctl.abort();
  }, [q]);

  const pick = async (name: string) => {
    setOpen(false);
    setQ('');
    try {
      onChange(await getCard(name));
    } catch {
      onChange({ name, colorIdentity: [] });
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-felt-3 p-2">
        {value.artCrop ? (
          <img src={value.artCrop} alt="" className="h-12 w-16 rounded object-cover" />
        ) : (
          <div className="h-12 w-16 rounded bg-felt-2" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{value.name}</div>
          <Pips colors={value.colorIdentity} size={10} />
        </div>
        <button type="button" onClick={() => onChange(undefined)} className="px-2 text-sm text-dim hover:text-bone">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-felt-3 px-3 py-2.5 placeholder:text-dim/70"
        autoComplete="off"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-felt-2 shadow-xl">
          {status === 'loading' && !results.length && <div className="px-3 py-2 text-sm text-dim">Searching Scryfall</div>}
          {status === 'empty' && <div className="px-3 py-2 text-sm text-dim">No commander matches that name.</div>}
          {status === 'error' && (
            <div className="px-3 py-2 text-sm text-dim">Couldn't reach Scryfall. You can still use the name as typed.</div>
          )}
          {results.map((r) => (
            <button
              key={r}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className="block w-full px-3 py-2 text-left hover:bg-felt-3"
            >
              {r}
            </button>
          ))}
          {(status === 'error' || status === 'empty') && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ name: q.trim(), colorIdentity: [] });
                setQ('');
              }}
              className="block w-full border-t border-line px-3 py-2 text-left text-brass-2 hover:bg-felt-3"
            >
              Use “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
