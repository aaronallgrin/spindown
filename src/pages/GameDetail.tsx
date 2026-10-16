import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { BRACKETS } from '../types';
import ConfirmBtn from '../components/ConfirmBtn';
import { Page, Pips, causeLabel, fmtDate } from '../ui';

export default function GameDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const g = useLiveQuery(() => db.games.get(id ?? ''), [id]);

  if (g === undefined) return <Page title="Game" back="/history">{null}</Page>;
  if (!g) return <Page title="Game not found" back="/history"><p className="text-dim">This game was deleted.</p></Page>;

  const players = [...g.players].sort((a, b) => {
    if (a.result === 'win') return -1;
    if (b.result === 'win') return 1;
    return (b.outRound ?? 99) - (a.outRound ?? 99);
  });

  const remove = async () => {
    await db.games.delete(g.id);
    nav('/history');
  };

  return (
    <Page title={g.winnerName ? `${g.winnerName} won` : 'Draw'} back="/history">
      <p className="mb-5 text-dim">
        {fmtDate(g.startedAt)}, {g.rounds} rounds, {g.durationMin} min, starting at {g.startingLife} life
      </p>

      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <div key={p.seat} className={`rounded-xl bg-felt-2 p-4 ${p.result === 'win' ? 'ring-1 ring-brass' : ''}`}>
            <div className="flex items-center gap-2">
              <Pips colors={p.colors} />
              <span className="text-lg font-semibold">{p.name}</span>
              <span className="ml-auto text-sm text-dim">went {ordinal(p.turnOrder)}</span>
            </div>
            <div className="mt-0.5 text-bone/80">
              {p.commander ?? p.deckName ?? 'No deck recorded'}
              {p.partner ? ` + ${p.partner}` : ''}
              {p.theme ? `, ${p.theme}` : ''}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <Stat k="Result" v={p.result === 'win' ? 'Won' : p.result === 'draw' ? 'Draw' : `Out round ${p.outRound ?? '?'}`} />
              <Stat k="How" v={p.result === 'win' ? 'Last standing' : p.outCause ? causeLabel[p.outCause] : 'Game ended'} />
              {p.bracket ? <Stat k="Bracket" v={`${p.bracket} ${BRACKETS[p.bracket - 1].name}`} /> : <Stat k="Seat" v={String(p.seat + 1)} />}
              <Stat k="Final life" v={String(p.finalLife)} />
              <Stat k="Poison" v={String(p.finalPoison)} />
              {g.format === 'commander' && <Stat k="Cmdr damage taken" v={String(p.cmdrDamageTaken)} />}
              {g.config.extraCounter && p.finalExtra != null && <Stat k={g.config.extraCounter} v={String(p.finalExtra)} />}
            </dl>
          </div>
        ))}
      </div>

      <ConfirmBtn variant="quiet" className="mt-8 w-full" onConfirm={remove} confirmLabel="Tap again to delete this game">
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
