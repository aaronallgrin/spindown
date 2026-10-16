import { useRef, useState } from 'react';
import { D20 } from '../ui';

/**
 * The round counter. Spin it clockwise (a swipe going clockwise around its
 * centre) to go to the next round, counterclockwise to go back. Clockwise is
 * the same from every seat, which a left/right swipe would not be.
 * A tap without movement calls onTap.
 */
export default function SpinDie({
  value,
  size,
  facing,
  hint,
  onSpin,
  onTap,
  label,
}: {
  value: string | number;
  size: number;
  /** degrees, so the number reads upright for one seat */
  facing: number;
  hint?: string;
  onSpin: (dir: 1 | -1) => void;
  onTap: () => void;
  label: string;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const [spin, setSpin] = useState(0);

  const end = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId || !ref.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 14) return onTap();
    const r = ref.current.getBoundingClientRect();
    const rx = s.x - (r.left + r.width / 2);
    const ry = s.y - (r.top + r.height / 2);
    // screen y points down, so a positive cross product is clockwise
    let cross = rx * dy - ry * dx;
    if (Math.hypot(rx, ry) < size * 0.12) cross = dx; // started dead centre: rightward counts as clockwise
    const dir = cross >= 0 ? 1 : -1;
    setSpin((x) => x + dir * 144);
    onSpin(dir);
  };

  return (
    <div
      className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ rotate: `${facing}deg` }}
    >
      <button
        ref={ref}
        aria-label={label}
        className="rounded-full p-3"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={end}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onSpin(1);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onSpin(-1);
        }}
        onClick={(e) => e.detail === 0 && onTap()}
      >
        <div className="transition-[rotate] duration-500 ease-out" style={{ rotate: `${spin}deg` }}>
          <D20 value="" size={size} />
        </div>
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center font-cond font-bold text-brass-2"
          style={{ fontSize: size * 0.3, paddingTop: size * 0.04 }}
        >
          {value}
        </span>
      </button>
      {hint && (
        <span className="pointer-events-none absolute top-full -mt-1 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-xs text-bone/80">
          {hint}
        </span>
      )}
    </div>
  );
}
