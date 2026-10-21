import { useEffect, useRef, useState } from 'react';
import { D20 } from '../ui';
import { buzz } from '../haptics';

const DOUBLE_MS = 280; // a second tap this soon after the first counts as a double tap
const HOLD_MS = 500; // hold this long for the menu

/**
 * The round counter. While the round can change: tap for the next round,
 * double-tap to go back one, hold for the menu. Otherwise a tap calls onTap.
 */
export default function SpinDie({
  value,
  size,
  facing,
  hint,
  onSpin,
  onTap,
  onHold,
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
  onHold: () => void;
  label: string;
  spinnable?: boolean;
}) {
  const [spin, setSpin] = useState(0);
  const press = useRef<{ x: number; y: number; id: number; held: boolean; timer: number } | null>(null);
  const pending = useRef<number | null>(null); // single tap waiting to see if a second one follows

  useEffect(
    () => () => {
      if (pending.current) window.clearTimeout(pending.current);
      if (press.current) window.clearTimeout(press.current.timer);
    },
    [],
  );

  const step = (dir: 1 | -1) => {
    setSpin((x) => x + dir * 144);
    buzz(15);
    onSpin(dir);
  };

  const tap = () => {
    if (!spinnable) return onTap();
    if (pending.current) {
      window.clearTimeout(pending.current);
      pending.current = null;
      return step(-1);
    }
    pending.current = window.setTimeout(() => {
      pending.current = null;
      step(1);
    }, DOUBLE_MS);
  };

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <div
      // only the round button takes touches, not the square box around it
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ rotate: `${facing}deg` }}
    >
      <button
        aria-label={label}
        // a little invisible margin, so a near miss still lands
        className="pointer-events-auto rounded-full"
        style={{ touchAction: 'none', padding: Math.round(size * 0.55) }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          cancel();
          const id = e.pointerId;
          const timer = window.setTimeout(() => {
            if (!press.current || press.current.id !== id) return;
            press.current.held = true;
            if (pending.current) {
              window.clearTimeout(pending.current);
              pending.current = null;
            }
            buzz(30);
            onHold();
          }, HOLD_MS);
          press.current = { x: e.clientX, y: e.clientY, id, held: false, timer };
          e.currentTarget.setPointerCapture(id);
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 14) cancel();
        }}
        onPointerUp={(e) => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          window.clearTimeout(p.timer);
          press.current = null;
          if (!p.held) tap();
        }}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          if (!spinnable) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
          if (e.key === 'm' || e.key === 'Escape') onHold();
        }}
        onClick={(e) => e.detail === 0 && (spinnable ? step(1) : onTap())}
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
