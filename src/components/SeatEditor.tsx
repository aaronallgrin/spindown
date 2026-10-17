import { useEffect, useState } from 'react';
import CommanderPicker from './CommanderPicker';
import { getCard } from '../scryfall';
import { deckKey, usePlayerMemory } from './usePlayerMemory';
import { BRACKETS, deckFields, sharedDeck, type Format, type Mana, type PlayerSetup } from '../types';
import { Btn, ManaPicker, Pips, Segmented, sortMana } from '../ui';

/**
 * Full-screen form a player fills in after tapping their spot at the table.
 * It opens turned the same way as that player's panel, so nobody has to pick
 * the phone up and turn it. The phone's own keyboard still comes up along the
 * bottom of the screen; a web app can't turn that.
 */
export default function SeatEditor({
  seat,
  rot = 0,
  format,
  subFormat,
  initial,
  takenNames,
  onSave,
  onClose,
}: {
  seat: number;
  /** degrees to turn the form so it faces the player, 0 = upright */
  rot?: number;
  format: Format;
  subFormat?: string;
  initial: PlayerSetup;
  /** names already used at other seats this game */
  takenNames: string[];
  onSave: (p: PlayerSetup) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState<PlayerSetup>(initial);
  const memory = usePlayerMemory();
  const isCmdr = format === 'commander';
  const shared = sharedDeck(format, subFormat);
  const fields = deckFields(format, subFormat);
  const pastDeckNames = (subFormat && memory.deckNames.get(subFormat)) || [];
  const set = (patch: Partial<PlayerSetup>) => setP((x) => ({ ...x, ...patch }));

  const past = shared ? [] : [...(memory.decks.get(p.name.trim().toLowerCase())?.values() ?? [])]
    .filter((d) => (isCmdr ? d.format === 'commander' : d.format !== 'commander'))
    .slice(0, 8);
  const typed = p.name.trim();
  // same name, different capitals: quietly use the saved spelling so stats stay together
  const known = memory.names.find((n) => n.toLowerCase() === typed.toLowerCase());
  const name = known ?? typed;
  const dupe = name && takenNames.some((t) => t.toLowerCase() === name.toLowerCase());
  // a close but different name: ask before starting a new player in the stats
  const [newPlayer, setNewPlayer] = useState('');
  const lookalikes =
    !typed || known || newPlayer.toLowerCase() === typed.toLowerCase()
      ? []
      : similarNames(typed, memory.names.filter((n) => !takenNames.some((t) => t.toLowerCase() === n.toLowerCase())));
  const asking = lookalikes.length > 0;

  const save = () => {
    if (!name || dupe || asking) return;
    if (shared) return onSave({ ...p, name, deckName: shared.deckName, theme: undefined, colors: shared.colors, hasPartner: false });
    onSave({
      ...p,
      name,
      deckName: fields.deck ? p.deckName : undefined,
      theme: fields.theme ? p.theme : undefined,
      partner: p.hasPartner ? p.partner : undefined,
      colors: isCmdr ? union(p.commander?.colorIdentity, p.hasPartner ? p.partner?.colorIdentity : undefined) : p.colors,
    });
  };

  // size once per orientation; ignore the resize the keyboard causes so the form doesn't jump
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => window.setTimeout(() => setVp({ w: window.innerWidth, h: window.innerHeight }), 250);
    window.addEventListener('orientationchange', on);
    return () => window.removeEventListener('orientationchange', on);
  }, []);
  const sideways = rot === 90 || rot === 270;
  const turnedStyle = rot
    ? {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        width: sideways ? vp.h : vp.w,
        height: sideways ? vp.w : vp.h,
        translate: '-50% -50%',
        rotate: `${rot}deg`,
        // every edge could be the notch or home bar once turned
        padding:
          'max(env(safe-area-inset-top), env(safe-area-inset-bottom), env(safe-area-inset-left), env(safe-area-inset-right))',
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-felt">
      <div
        className={rot ? 'overflow-y-auto' : 'absolute inset-0 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'}
        style={{ ...turnedStyle, touchAction: rot ? 'manipulation' : 'pan-y' }}
      >
      <form
        className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pb-6 pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass font-cond text-xl font-bold text-felt">
            {seat + 1}
          </span>
          <h2 className="flex-1 font-cond text-3xl font-bold">Your seat</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-dim hover:text-bone">
            Cancel
          </button>
        </div>

        <datalist id="past-names">
          {memory.names
            .filter((n) => !takenNames.some((t) => t.toLowerCase() === n.toLowerCase()))
            .map((n) => (
              <option key={n} value={n} />
            ))}
        </datalist>
        <div>
          <input
            id="seat-name"
            list="past-names"
            value={p.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Your name"
            autoComplete="off"
            className="w-full rounded-lg bg-felt-2 px-3 py-3 text-xl font-semibold placeholder:font-normal placeholder:text-dim"
          />
          {dupe && <p className="mt-1 text-sm text-blood">Someone at the table already has that name.</p>}
          {asking && !dupe && (
            <div className="mt-2 rounded-lg border border-brass/40 bg-brass/10 p-3">
              <div className="mb-2 text-sm">
                {lookalikes.length === 1 ? 'Is this you?' : 'Is one of these you?'}{' '}
                <span className="text-dim">Picking keeps your games together in stats.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lookalikes.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ name: n })}
                    className="rounded-full bg-brass px-3 py-1.5 text-sm font-semibold text-felt"
                  >
                    Yes, I'm {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewPlayer(typed)}
                  className="rounded-full bg-white/[.08] px-3 py-1.5 text-sm"
                >
                  No, I'm new
                </button>
              </div>
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <div className="mb-2 text-sm text-dim">Your recent decks</div>
            <div className="flex flex-wrap gap-2">
              {past.map(({ setup }) => (
                <button
                  key={deckKey(setup)}
                  type="button"
                  onClick={async () => {
                    setP({ ...setup, name: p.name });
                    // older or imported games may not have card art saved
                    const fill = async (c?: PlayerSetup['commander']) =>
                      c && !c.artCrop ? await getCard(c.name).catch(() => c) : c;
                    const [commander, partner] = await Promise.all([fill(setup.commander), fill(setup.partner)]);
                    setP((x) => ({ ...x, commander, partner }));
                  }}
                  className="flex items-center gap-2 rounded-full bg-felt-2 px-3 py-1.5 text-sm hover:bg-felt-3"
                >
                  <Pips colors={setup.colors} size={9} />
                  {setup.commander?.name ?? setup.deckName ?? setup.theme}
                  {setup.hasPartner && setup.partner ? ` + ${setup.partner.name}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {isCmdr ? (
          <>
            <CommanderPicker value={p.commander} onChange={(c) => set({ commander: c })} />
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={p.hasPartner}
                onChange={(e) => set({ hasPartner: e.target.checked })}
                className="h-5 w-5 accent-[var(--color-brass)]"
              />
              Partner or second commander
            </label>
            {p.hasPartner && (
              <CommanderPicker
                value={p.partner}
                placeholder="Search partner or background"
                onChange={(c) => set({ partner: c })}
              />
            )}
            <div>
              <div className="mb-1.5 text-sm text-dim">Bracket</div>
              <Segmented
                label="Bracket"
                value={p.bracket ?? -1}
                onChange={(b) => set({ bracket: b as PlayerSetup['bracket'] })}
                options={BRACKETS.map((b) => ({
                  v: b.n as number,
                  label: (
                    <span className="flex flex-col leading-tight">
                      <span className="font-cond text-lg font-bold">{b.label}</span>
                      <span className="text-[10px]">{b.name}</span>
                    </span>
                  ),
                }))}
              />
            </div>
          </>
        ) : shared ? (
          <div className="flex items-center gap-3 rounded-lg bg-felt-2 px-3 py-3">
            <Pips colors={shared.colors} />
            <span>
              {subFormat}: everyone plays from one shared deck, 20 life each.
            </span>
          </div>
        ) : (
          <>
            <datalist id="past-themes">
              {memory.themes.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <datalist id="past-decknames">
              {pastDeckNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {fields.deck && (
              <input
                list="past-decknames"
                value={p.deckName ?? ''}
                onChange={(e) => set({ deckName: e.target.value })}
                placeholder={fields.deck}
                className="w-full rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
              />
            )}
            {fields.theme && (
              <input
                list="past-themes"
                value={p.theme ?? ''}
                onChange={(e) => set({ theme: e.target.value })}
                placeholder={fields.theme}
                className="w-full rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
              />
            )}
            <ManaPicker value={p.colors} onChange={(colors) => set({ colors })} />
          </>
        )}

        <div className="mt-auto pt-4">
          <Btn type="submit" variant="primary" disabled={!name || !!dupe || asking} className="w-full py-4 font-cond text-2xl">
            {asking ? 'Answer the name question first' : 'Take this seat'}
          </Btn>
        </div>
      </form>
      </div>
    </div>
  );
}

function union(a?: Mana[], b?: Mana[]): Mana[] {
  return sortMana([...new Set([...(a ?? []), ...(b ?? [])])]);
}

/**
 * Past names that look like a typo, nickname or longer form of what was typed:
 * Cody/Coady, Colin/Collin, Kris/Chris, Dyl/Dylan, DSW or Spencer/David Spencer W.
 * Andrew/Andy is too different to catch.
 * Closest first, at most three.
 */
function similarNames(typed: string, names: string[]) {
  const a = soundKey(typed);
  if (a.length < 2) return [];
  const aWords = words(typed);
  return names
    .map((n) => {
      const b = soundKey(n);
      if (!b) return null;
      if (a === b) return { n, d: 0 }; // only punctuation or spacing differs
      const bWords = words(n);
      // initials: DSW for David Spencer W…, either way round
      if ((a.length >= 2 && a === initials(bWords)) || (b.length >= 2 && b === initials(aWords))) return { n, d: 1 };
      // one word of a full name: Spencer for David Spencer W…, Dyl for Dylan Smith
      if (oneWordOf(aWords, bWords) || oneWordOf(bWords, aWords)) return { n, d: 1 };
      const short = Math.min(a.length, b.length);
      if (short >= 3 && (a.startsWith(b) || b.startsWith(a))) return { n, d: 1 };
      const d = editDistance(a, b);
      const allowed = short <= 4 ? 1 : short <= 7 ? 2 : 3;
      return d <= allowed ? { n, d } : null;
    })
    .filter((x): x is { n: string; d: number } => !!x)
    .sort((x, y) => x.d - y.d)
    .slice(0, 3)
    .map((x) => x.n);
}

const words = (s: string) => s.split(/[\s._-]+/).map(soundKey).filter(Boolean);
const initials = (w: string[]) => (w.length >= 2 ? w.map((x) => x[0]).join('') : '');
/** a single typed word that is, or starts, one word of a longer name */
const oneWordOf = (one: string[], full: string[]) =>
  one.length === 1 && full.length >= 2 && one[0].length >= 3 && full.some((w) => w === one[0] || w.startsWith(one[0]));

/** Spelling that sounds the same reads the same: Kris/Chris, Collin/Colin, Cody/Codie. */
function soundKey(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ch|ck|k|q/g, 'c')
    .replace(/ie$|ey$|y/g, 'i')
    .replace(/(.)\1+/g, '$1');
}

/** Letters to add, drop, swap or change to get from a to b (neighbouring swaps count once). */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}
