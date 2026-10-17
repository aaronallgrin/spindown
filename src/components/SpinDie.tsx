import { useRef, useState } from 'react';
import { D20 } from '../ui';

/**
 * The round counter. Spin it clockwise (a swipe going clockwise around its
 * centre) to go to the next round, counterclockwise to go back. Clockwise is
 * the same from every seat, which a left/right swipe would not be.
 * A tap without movement calls onTap.
 *
 * While the round can be spun, the swipe zone is twice the area it used to be.
 * That outer ring sits over the seats' own buttons, so a plain tap out there is
 * handed to whatever is underneath; only the inner zone opens the menu.
 */
export default function SpinDie({
  value,
  size,
  facing,
  hint,
  onSpin,
  onTap,
  label,
  spinnable = true,
}: {
  value: string | number;
  size: number;
  /** degrees, so the number reads upright for one seat */
  facing: number;
  hint?: string;
  onSpin: (dir: 1 | -1) => void;
  onTap: () => void;
  label: string;
  spinnable?: boolean;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const [spin, setSpin] = useState(0);
  // the old zone (about 2.1x the die across) still opens the menu on a tap
  const innerR = size * 1.05;
  // twice that area while spinning: √2 times as wide
  const pad = Math.round(spinnable ? size * (1.05 * Math.SQRT2 - 0.5) : size * 0.55);

  const end = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId || !ref.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const r = ref.current.getBoundingClientRect();
    const rx = s.x - (r.left + r.width / 2);
    const ry = s.y - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 14 || !spinnable) {
      if (Math.hypot(rx, ry) > innerR) return passThrough(ref.current, e.clientX, e.clientY);
      return onTap();
    }
    // screen y points down, so a positive cross product is clockwise
    let cross = rx * dy - ry * dx;
    if (Math.hypot(rx, ry) < size * 0.12) cross = dx; // started dead centre: rightward counts as clockwise
    const dir = cross >= 0 ? 1 : -1;
    setSpin((x) => x + dir * 144);
    onSpin(dir);
  };

  return (
    <div
      // only the round button takes touches, not the square box around it
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ rotate: `${facing}deg` }}
    >
      <button
        ref={ref}
        aria-label={label}
        // invisible touch zone around the die, so a sloppy swipe still lands
        className="pointer-events-auto rounded-full"
        style={{ touchAction: 'none', padding: pad }}
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
          className="pointer-events-none absolute inset-0 grid place-items-center font-cond font-bold text-brass"
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

/** Hand a tap that landed on the outer swipe ring to whatever is under it. */
function passThrough(zone: HTMLElement, x: number, y: number) {
  const prev = zone.style.pointerEvents;
  zone.style.pointerEvents = 'none';
  const under = document.elementFromPoint(x, y);
  zone.style.pointerEvents = prev;
  if (!under) return;
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true };
  under.dispatchEvent(new PointerEvent('pointerdown', init));
  under.dispatchEvent(new PointerEvent('pointerup', init));
  under.dispatchEvent(new MouseEvent('click', init));
}
