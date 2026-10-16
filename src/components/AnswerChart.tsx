import type { ChartSpec } from '../questions';

type Result = { columns: string[]; values: unknown[][] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtLabel = (s: string, f: ChartSpec['labelFormat']) => {
  if (f === 'ordinal') {
    const n = Number(s);
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10]}`;
  }
  if (f === 'month' && /^\d{4}-\d{2}$/.test(s)) return `${MONTHS[Number(s.slice(5)) - 1]} ’${s.slice(2, 4)}`;
  return s;
};

const fmt = (v: number, f: ChartSpec['format']) =>
  f === 'pct' ? `${Math.round(v)}%` : f === 'min' ? `${v}m` : Number.isInteger(v) ? String(v) : v.toFixed(1);

/** Draws a query's answer: ranked bars, columns, or a line over time. One series, in the accent color. */
export default function AnswerChart({ result, spec }: { result: Result; spec: ChartSpec }) {
  const li = result.columns.indexOf(spec.label);
  const vi = result.columns.indexOf(spec.value);
  const ni = spec.note ? result.columns.indexOf(spec.note) : -1;
  if (li < 0 || vi < 0) return null;
  const rows = result.values
    .map((r) => ({ label: fmtLabel(String(r[li] ?? '–'), spec.labelFormat), value: Number(r[vi] ?? 0), note: ni >= 0 ? r[ni] : null }))
    .filter((r) => Number.isFinite(r.value));
  if (!rows.length) return <p className="py-3 text-sm text-dim">Nothing to draw yet.</p>;
  const max = Math.max(...rows.map((r) => r.value), spec.format === 'pct' ? 1 : 0) || 1;

  if (spec.kind === 'hbar') {
    return (
      <div className="flex flex-col gap-2.5 py-1">
        {rows.slice(0, 20).map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3" title={`${r.label}: ${fmt(r.value, spec.format)}`}>
            <span className="truncate text-sm">{r.label}</span>
            <span className="text-right tabular-nums">
              <span className="font-cond text-lg font-bold">{fmt(r.value, spec.format)}</span>
              {r.note != null && <span className="ml-1.5 text-xs text-dim">{String(r.note)}</span>}
            </span>
            <div className="col-span-2 mt-1 h-1.5 rounded-full bg-white/[.06]" aria-hidden>
              <div className="h-full rounded-full bg-brass" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (spec.kind === 'vbar') {
    return (
      <div className="flex h-52 gap-2 pt-7">
        {rows.slice(0, 16).map((r, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center" title={`${r.label}: ${fmt(r.value, spec.format)}`}>
            {/* bars share one plot area, so heights are to scale */}
            <div className="relative w-full flex-1 border-b border-white/10">
              <div
                className="absolute bottom-0 left-1/2 w-full max-w-10 -translate-x-1/2 rounded-t-md bg-brass"
                style={{ height: `${Math.max(1.5, (r.value / max) * 100)}%` }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-cond text-sm font-bold tabular-nums text-bone">
                  {fmt(r.value, spec.format)}
                </span>
              </div>
            </div>
            <span className="mt-1.5 w-full truncate text-center text-xs text-dim">{r.label}</span>
            {r.note != null && <span className="w-full truncate text-center text-[10px] text-dim">{String(r.note)}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (spec.kind === 'line') {
    const W = 320;
    const H = 150;
    const pad = { l: 8, r: 8, t: 22, b: 26 };
    const n = rows.length;
    const x = (i: number) => (n === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
    const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');
    const area = `${path} L${x(n - 1).toFixed(1)} ${H - pad.b} L${x(0).toFixed(1)} ${H - pad.b} Z`;
    const best = rows.reduce((a, r, i) => (r.value > rows[a].value ? i : a), 0);
    const show = new Set([0, n - 1, best]);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="currentColor" strokeOpacity=".15" />
        <path d={area} fill="var(--color-brass)" fillOpacity=".12" />
        <path d={path} fill="none" stroke="var(--color-brass)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {rows.map((r, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(r.value)} r={show.has(i) ? 3.5 : 2.5} fill="var(--color-brass)" stroke="var(--color-felt-2)" strokeWidth="1.5">
              <title>{`${r.label}: ${fmt(r.value, spec.format)}`}</title>
            </circle>
            {show.has(i) && (
              <text x={x(i)} y={y(r.value) - 8} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} fontSize="11" fontWeight="700" fill="currentColor">
                {fmt(r.value, spec.format)}
              </text>
            )}
          </g>
        ))}
        {rows.map((r, i) =>
          n <= 8 || show.has(i) ? (
            <text
              key={`l${i}`}
              x={x(i)}
              y={H - 8}
              fontSize="9.5"
              textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
              fill="currentColor"
              fillOpacity=".55"
            >
              {r.label}
            </text>
          ) : null,
        )}
      </svg>
    );
  }
  return null;
}
