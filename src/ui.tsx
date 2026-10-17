import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRACKETS as BRACKET_LIST, MANA, type Mana } from './types';

export const manaVar: Record<Mana | 'C', string> = {
  W: 'var(--color-mana-w)',
  U: 'var(--color-mana-u)',
  B: 'var(--color-mana-b)',
  R: 'var(--color-mana-r)',
  G: 'var(--color-mana-g)',
  C: 'var(--color-mana-c)',
};

const manaName: Record<Mana, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

export const sortMana = (c: Mana[]) => MANA.filter((m) => c.includes(m));

/** Thin stripe of a deck's colors, used on panel edges and list rows. */
export function ColorStripe({ colors, className = '' }: { colors: Mana[]; className?: string }) {
  const cs = sortMana(colors);
  const list = cs.length ? cs.map((m) => manaVar[m]) : [manaVar.C];
  return (
    <div className={`flex ${className}`} aria-label={cs.map((m) => manaName[m]).join(', ') || 'Colorless'}>
      {list.map((c, i) => (
        <div key={i} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  );
}

export function Pips({ colors, size = 12 }: { colors: Mana[]; size?: number }) {
  const cs = sortMana(colors);
  if (!cs.length)
    return (
      <span
        className="inline-block rounded-full ring-1 ring-black/60"
        style={{ width: size, height: size, background: manaVar.C, boxShadow: 'inset 0 -1px 1px rgb(0 0 0 / .35)' }}
        title="Colorless"
      />
    );
  return (
    <span className="inline-flex gap-[3px] align-middle">
      {cs.map((m) => (
        <span
          key={m}
          title={manaName[m]}
          className="inline-block rounded-full ring-1 ring-black/60"
          style={{ width: size, height: size, background: manaVar[m], boxShadow: 'inset 0 -1px 1px rgb(0 0 0 / .35)' }}
        />
      ))}
    </span>
  );
}

export function ManaPicker({ value, onChange }: { value: Mana[]; onChange: (v: Mana[]) => void }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Colors">
      {MANA.map((m) => {
        const on = value.includes(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            aria-label={manaName[m]}
            onClick={() => onChange(on ? value.filter((x) => x !== m) : sortMana([...value, m]))}
            className={`h-9 w-9 rounded-full font-cond text-base font-bold transition ${
              on ? 'text-felt ring-2 ring-bone/80' : 'opacity-35 text-felt'
            }`}
            style={{ background: manaVar[m] }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

export function D20({ value, size = 84, label }: { value: ReactNode; size?: number; label?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="d20" aria-label={label}>
      <polygon points="50,2 91.6,26 91.6,74 50,98 8.4,74 8.4,26" fill="#1b1b1b" stroke="var(--color-brass)" strokeWidth="3" strokeLinejoin="round" />
      <g stroke="var(--color-brass)" strokeWidth="1.6" opacity="0.75" fill="none">
        <polygon points="50,24 75,67 25,67" />
        <path d="M50,2 L50,24 M50,24 L91.6,26 M50,24 L8.4,26 M75,67 L91.6,26 M75,67 L91.6,74 M75,67 L50,98 M25,67 L8.4,26 M25,67 L8.4,74 M25,67 L50,98" />
      </g>
      <text
        x="50"
        y="55"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--color-brass)"
        style={{ font: '700 26px var(--font-cond)' }}
      >
        {value}
      </text>
    </svg>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' };
export function Btn({ variant = 'quiet', className = '', ...p }: BtnProps) {
  const v =
    variant === 'primary'
      ? 'bg-brass text-felt hover:bg-brass-2 font-semibold'
      : variant === 'danger'
        ? 'bg-blood/90 text-bone hover:bg-blood'
        : 'bg-white/[.06] text-bone hover:bg-white/10';
  return <button {...p} className={`rounded-xl px-4 py-2.5 transition active:scale-[.98] disabled:opacity-40 ${v} ${className}`} />;
}

export function Page({ title, back = '/', children, action }: { title: string; back?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 bg-felt/80 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-md">
        <Link
          to={back}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/[.06] text-bone/80 transition hover:bg-white/10 hover:text-bone"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="flex-1 font-cond text-3xl font-bold tracking-wide">{title}</h1>
        {action}
      </header>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex rounded-full bg-white/[.05] p-1 ring-1 ring-white/[.05]" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-full px-2 py-2 text-sm transition ${
            value === o.v ? 'bg-bone font-semibold text-felt shadow' : 'text-dim hover:text-bone'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const causeLabel: Record<string, string> = {
  life: 'Life',
  commander: 'Commander damage',
  poison: 'Poison',
  concede: 'Conceded',
  lose: 'Lost',
  opponentWon: 'Opponent won',
  other: 'Other',
};

/** "P Precon", "4 Optimized": the bracket the way the picker shows it */
export function BracketTag({ n }: { n: number }) {
  const b = BRACKET_LIST.find((x) => x.n === n);
  if (!b) return <span>{n}</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-cond text-[1.15em] font-bold">{b.label}</span>
      <span className="text-[0.8em] text-dim">{b.name}</span>
    </span>
  );
}
