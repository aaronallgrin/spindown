import type { Trophy } from '../eggs';

/** A little 90s plastic trophy. */
export function TrophyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="var(--color-brass)" />
      <path d="M7 4H4a3 3 0 0 0 3 4M17 4h3a3 3 0 0 1-3 4" fill="none" stroke="var(--color-brass)" strokeWidth="1.6" />
      <rect x="11" y="11.5" width="2" height="5" fill="var(--color-brass-2)" />
      <rect x="7.5" y="16.5" width="9" height="2.5" rx="0.6" fill="#7a5bd6" />
      <rect x="6" y="19" width="12" height="2.5" rx="0.6" fill="#3fa7a0" />
      <path d="M9.5 4.5l1 2" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function TrophyList({ items, compact = false }: { items: Trophy[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {items.map((t, i) => (
        <li key={`${t.id}-${t.seat}-${i}`} className="flex items-start gap-2">
          <TrophyIcon size={compact ? 16 : 20} />
          <div className="min-w-0">
            <span className={`font-semibold ${compact ? 'text-sm' : ''}`}>
              {t.title}
              {t.name ? <span className="font-normal text-dim">, {t.name}</span> : null}
            </span>
            <p className={`text-dim ${compact ? 'text-xs' : 'text-sm'}`}>{t.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
