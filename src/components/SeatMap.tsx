import type { Layout } from '../layouts';

/**
 * The phone lying on the table with numbered players sitting around it,
 * so people can see where they'll sit at a glance.
 */
export default function SeatMap({
  layout,
  selected,
  onClick,
}: {
  layout: Layout;
  selected: boolean;
  onClick: () => void;
}) {
  const rows = layout.areas.map((r) => r.split(' '));
  const R = rows.length;
  const C = rows[0].length;
  // phone on a 100 x 100 table
  const px = 36, py = 18, pw = 28, ph = 64;
  const seats = layout.rot.map((rot, i) => {
    const letter = String.fromCharCode(97 + i);
    const rs: number[] = [];
    const cs: number[] = [];
    rows.forEach((r, ri) => r.forEach((c, ci) => c === letter && (rs.push(ri), cs.push(ci))));
    const cy = (Math.min(...rs) + Math.max(...rs) + 1) / 2 / R;
    const cx = (Math.min(...cs) + Math.max(...cs) + 1) / 2 / C;
    const gap = 11;
    if (rot === 90) return { x: px - gap, y: py + cy * ph };
    if (rot === 270) return { x: px + pw + gap, y: py + cy * ph };
    if (rot === 180) return { x: px + cx * pw, y: py - gap };
    return { x: px + cx * pw, y: py + ph + gap };
  });
  // the panel split lines drawn on the phone
  const lines: string[] = [];
  for (let r = 1; r < R; r++) lines.push(`M${px + 2} ${py + (ph * r) / R} H${px + pw - 2}`);
  for (let c = 1; c < C; c++) {
    // only draw a vertical split where the row is actually split
    for (let r = 0; r < R; r++)
      if (rows[r][c] !== rows[r][c - 1]) lines.push(`M${px + (pw * c) / C} ${py + (ph * r) / R + 2} V${py + (ph * (r + 1)) / R - 2}`);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={layout.label}
      className={`group flex flex-col items-center gap-1 rounded-2xl px-2 pb-2 pt-1 transition ${
        selected ? 'bg-brass/12 ring-1 ring-brass/70' : 'hover:bg-white/5'
      }`}
    >
      <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden>
        <rect
          x={px}
          y={py}
          width={pw}
          height={ph}
          rx="6"
          fill="#121212"
          stroke={selected ? 'var(--color-brass)' : '#555'}
          strokeWidth="1.6"
        />
        <path d={lines.join(' ')} stroke="#3a3a3a" strokeWidth="1.2" strokeLinecap="round" />
        {seats.map((s, i) => (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r="6.5" fill={selected ? 'var(--color-brass)' : '#3a3a3a'} />
            <text
              x={s.x}
              y={s.y + 0.4}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7.5"
              fontWeight="700"
              fill={selected ? '#1b1b1b' : '#cfcfcf'}
              style={{ fontFamily: 'var(--font-cond)' }}
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <span className={`text-xs ${selected ? 'text-bone' : 'text-dim'}`}>{layout.label}</span>
    </button>
  );
}
