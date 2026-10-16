import { BRACKET_LABEL, dayShort, hourShort, type Poll } from '../polls';

export const FORMATS = ['Commander', 'Standard', 'Modern', 'Pioneer', 'Draft', 'Cube', 'Other'];

/** Format line shared by the list and the poll page. */
export function formatLine(p: Pick<Poll, 'format' | 'brackets'>) {
  return p.format === 'Commander' && p.brackets.length ? `Commander · bracket ${p.brackets.map(BRACKET_LABEL).join(', ')}` : p.format;
}

export function StatusChip({ p }: { p: Poll }) {
  return p.scheduled ? (
    <span className="shrink-0 rounded-full bg-mana-g/15 px-2.5 py-0.5 text-xs font-semibold text-mana-g">
      {dayShort(p.scheduled.date)} {hourShort(p.scheduled.hour)}
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-brass/15 px-2.5 py-0.5 text-xs font-semibold text-brass">Open</span>
  );
}
