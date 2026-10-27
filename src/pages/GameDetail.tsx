import { useParams } from 'react-router-dom';
import { useNavigate } from '../nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { queueDelete, syncNow } from '../sync';
import ConfirmBtn from '../components/ConfirmBtn';
import TrophyList from '../components/Trophies';
import { eggsFound, fmtSecs, roundSeconds, trophies } from '../eggs';
import { BracketTag, Btn, Page, Pips, causeLabel, fmtDate, gameVT } from '../ui';
import { Crown } from '../components/icons';
import CardName from '../components/CardName';
import { useStore } from '../store';

export default function GameDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const g = useLiveQuery(() => db.games.get(id ?? ''), [id]);
  const { game: live, start } = useStore();

  if (g === undefined) return <Page title="Game" back="/history">{null}</Page>;
  if (!g) return <Page title="Game not found" back="/history"><p className="text-dim">This game was deleted.</p></Page>;

  const players = [...g.players].sort((a, b) => {
    if (a.result === 'win') return -1;
    if (b.result === 'win') return 1;
    return (b.outRound ?? 99) - (a.outRound ?? 99);
  });

  const remove = async () => {
    await db.games.delete(g.id);
    queueDelete(g.id);
    syncNow();
    nav('/history');
  };

  return (
    <Page title={g.winnerName ? `${g.winnerName} won` : 'Draw'} back="/history" titleVT={gameVT(g.id)}>
      <p className="mb-5 text-dim">
        {fmtDate(g.startedAt)}, {g.rounds ? `${g.rounds} ${g.rounds === 1 ? 'round' : 'rounds'}, ` : ''}
        {g.imported ? 'imported from the old spreadsheet' : `${g.durationMin} min`}
      </p>

      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <div key={p.seat} className={`rounded-xl bg-felt-2 p-4 ${p.result === 'win' ? 'ring-1 ring-brass' : ''}`}>
            <div className="flex items-center gap-2">
              <Pips colors={p.colors} />
              <span className="text-lg font-semibold">{p.name}</span>
              {p.wasMonarchAtEnd && (
                <span className="text-brass" title="Monarch at the end" aria-label="Monarch at the end">
                  <Crown size={16} />
                </span>
              )}
              {p.turnOrder > 0 && <span className="ml-auto text-sm text-dim">went {ordinal(p.turnOrder)}</span>}
            </div>
            <div className="mt-0.5 text-bone/80">
              {p.commander ? <CardName name={p.commander} /> : (p.deckName ?? 'No deck recorded')}
              {p.partner && (
                <>
                  {' + '}
                  <CardName name={p.partner} />
                </>
              )}
              {p.theme ? `, ${p.theme}` : ''}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <Stat k="Result" v={p.result === 'win' ? 'Won' : p.result === 'draw' ? 'Draw' : `Out round ${p.outRound ?? '?'}`} />
              <Stat k="How" v={p.result === 'win' ? 'Last standing' : p.outCause ? causeLabel[p.outCause] : 'Game ended'} />
              {p.bracket != null ? (
                <div>
                  <dt className="text-xs text-dim">Bracket</dt>
                  <dd className="font-semibold">
                    <BracketTag n={p.bracket} />
                  </dd>
                </div>
              ) : (
                <Stat k="Seat" v={String(p.seat + 1)} />
              )}
            </dl>
            {/* the end-of-game numbers sit in one row of small tiles */}
            {(() => {
              const nums: [string, number][] = [];
              if (!g.imported) {
                nums.push(['Life', p.finalLife], ['Poison', p.finalPoison]);
                if (g.format === 'commander') nums.push(['Cmdr dmg', p.cmdrDamageTaken]);
              }
              const extra = g.config.extraCounter;
              if (extra && p.finalExtra != null) nums.push([extra === '*' ? '* Misplays' : extra, p.finalExtra]);
              if (!nums.length) return null;
              return (
                <dl className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nums.length}, minmax(0, 1fr))` }}>
                  {nums.map(([k, v]) => (
                    <div key={k} className="flex flex-col-reverse rounded-lg bg-white/[.04] px-2 py-1.5 text-center">
                      <dt className="truncate text-[11px] text-dim">{k}</dt>
                      <dd className="font-cond text-xl font-bold leading-tight tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}
          </div>
        ))}
      </div>

      {(() => {
        const secs = roundSeconds(g);
        const t = trophies(g);
        const eggs = eggsFound(g);
        return (
          <>
            {secs.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 font-cond text-2xl font-bold">Round times</h2>
                <div className="flex flex-wrap gap-1.5">
                  {secs.map((s, i) => (
                    <span key={i} className="rounded-md bg-felt-2 px-2 py-1 text-sm tabular-nums">
                      <span className="text-dim">R{i + 1}</span> {fmtSecs(s)}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {t.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 font-cond text-2xl font-bold">Trophies</h2>
                <TrophyList items={t} />
              </section>
            )}
            {eggs.length > 0 && (
              <p className="mt-6 text-sm text-dim">
                Secrets found: {eggs.map((e) => `${e.name} (${e.id})`).join(', ')}
              </p>
            )}
          </>
        );
      })()}

      {!g.imported && !live && (
        <Btn
          variant="primary"
          className="mt-8 w-full"
          onClick={() => {
            start(g.config);
            nav('/play');
          }}
        >
          Rematch, same players and decks
        </Btn>
      )}

      <ConfirmBtn variant="quiet" className="mt-3 w-full" onConfirm={remove} confirmLabel="Tap again to delete this game">
        Delete game
      </ConfirmBtn>
    </Page>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-dim">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]}`;
