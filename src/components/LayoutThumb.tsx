import type { Layout } from '../layouts';



export default function LayoutThumb({ layout, selected, onClick }: { layout: Layout; selected: boolean; onClick: () => void }) {
  const portrait = layout.orientation === 'portrait';
  const arrow: Record<number, string> = { 0: '↓', 90: '←', 180: '↑', 270: '→' };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition ${selected ? 'bg-felt-3 ring-2 ring-brass' : 'bg-felt-2 hover:bg-felt-3'}`}
    >
      <div
        className="grid gap-[3px] rounded-md bg-black/40 p-[3px]"
        style={{
          width: portrait ? 56 : 92,
          height: portrait ? 92 : 56,
          gridTemplateAreas: layout.areas.map((r) => `"${r}"`).join(' '),
        }}
      >
        {layout.rot.map((r, i) => (
          <div
            key={i}
            className="grid place-items-center rounded-[3px] bg-felt-3 font-cond text-xs font-bold leading-none"
            style={{ gridArea: String.fromCharCode(97 + i) }}
          >
            <span>
              {i + 1}
              <span className="ml-px text-[9px] text-dim">{arrow[r]}</span>
            </span>
          </div>
        ))}
      </div>
      <span className="text-[11px] text-dim">{layout.label}</span>
    </button>
  );
}
