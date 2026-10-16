import { useEffect, useMemo, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SCHEMA, buildDb } from '../sql';
import { SUGGESTIONS, findQuestions, type Question } from '../questions';
import AnswerChart from '../components/AnswerChart';
import { Btn, Page } from '../ui';

type Result = { columns: string[]; values: unknown[][] };

export default function Query() {
  const games = useLiveQuery(() => db.games.toArray(), []);
  const sqlDb = useRef<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [answer, setAnswer] = useState<{ res: Result[]; err: string } | null>(null);
  const [own, setOwn] = useState(false);
  const [sql, setSql] = useState('SELECT name, COUNT(*) AS games FROM players GROUP BY name;');
  const [ownAnswer, setOwnAnswer] = useState<{ res: Result[]; err: string } | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  useEffect(() => {
    if (!games) return;
    let alive = true;
    setReady(false);
    buildDb(games)
      .then((d) => {
        if (!alive) return d.close();
        sqlDb.current?.close();
        sqlDb.current = d;
        setReady(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [games]);

  const exec = (text: string): { res: Result[]; err: string } => {
    if (!sqlDb.current) return { res: [], err: 'Still loading your games.' };
    try {
      return { res: sqlDb.current.exec(text), err: '' };
    } catch (e) {
      return { res: [], err: (e as Error).message };
    }
  };

  const questions = useMemo(() => findQuestions(search, games ?? []), [search, games]);

  const ask = (qn: Question) => {
    if (open === qn.id) return setOpen(null);
    setOpen(qn.id);
    setView(qn.chart.kind === 'table' ? 'table' : 'chart');
    setAnswer(exec(qn.sql));
  };

  return (
    <Page title="Query">
      <div className="relative mb-3">
        <svg viewBox="0 0 24 24" width="18" height="18" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="query-search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(null);
          }}
          placeholder="Search: a player, a commander, or a topic"
          className="w-full rounded-full bg-white/[.06] py-3 pl-10 pr-4 ring-1 ring-white/[.06] placeholder:text-dim"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {!search && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setSearch(s)} className="rounded-full bg-white/[.05] px-3 py-1 text-sm text-dim hover:text-bone">
              {s}
            </button>
          ))}
        </div>
      )}

      {search && questions.length === 0 && (
        <p className="rounded-2xl bg-felt-2 p-4 text-dim">No questions match that. Try a player's name, a commander, or a word like “colors”.</p>
      )}

      <div className="flex flex-col gap-2">
        {questions.map((qn) => {
          const isOpen = open === qn.id;
          return (
            <div key={qn.id} className={`rounded-2xl bg-felt-2 ring-1 transition ${isOpen ? 'p-4 ring-brass/50' : 'ring-white/[.04]'}`}>
              <button
                disabled={!ready}
                onClick={() => ask(qn)}
                className={`flex w-full items-center gap-3 text-left font-semibold ${isOpen ? 'text-brass' : 'px-4 py-3.5 hover:text-brass'}`}
              >
                <span className="flex-1">{qn.title}</span>
                {qn.chart.kind !== 'table' && !isOpen && <ChartGlyph kind={qn.chart.kind} />}
              </button>
              {isOpen && answer && (
                <div className="mt-3">
                  {answer.err ? (
                    <p className="rounded-lg bg-blood/15 p-3 text-sm">{answer.err}</p>
                  ) : !answer.res.length || !answer.res[0].values.length ? (
                    <p className="text-sm text-dim">No games answer that yet.</p>
                  ) : (
                    <>
                      {qn.chart.kind !== 'table' && (
                        <div className="mb-3 flex justify-end">
                          <div className="flex rounded-full bg-white/[.05] p-0.5 text-xs">
                            {(['chart', 'table'] as const).map((v) => (
                              <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`rounded-full px-3 py-1 ${view === v ? 'bg-bone font-semibold text-felt' : 'text-dim'}`}
                              >
                                {v === 'chart' ? 'Graph' : 'Table'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {view === 'chart' && qn.chart.kind !== 'table' ? (
                        <AnswerChart result={answer.res[0]} spec={qn.chart} />
                      ) : (
                        <ResultTable result={answer.res[0]} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        {!own ? (
          <button onClick={() => setOwn(true)} className="text-sm text-dim hover:text-bone">
            Write your own question (advanced)
          </button>
        ) : (
          <div>
            <textarea
              id="sql"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={6}
              className="w-full rounded-xl bg-felt-2 p-3 font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-2 flex gap-2">
              <Btn variant="primary" onClick={() => setOwnAnswer(exec(sql))} disabled={!ready} className="flex-1">
                Run
              </Btn>
              <Btn onClick={() => setShowSchema((x) => !x)}>{showSchema ? 'Hide tables' : 'Tables'}</Btn>
              <Btn onClick={() => setOwn(false)}>Close</Btn>
            </div>
            {showSchema && <pre className="mt-3 overflow-x-auto rounded-xl bg-felt-2 p-3 text-xs leading-relaxed text-dim">{SCHEMA}</pre>}
            {ownAnswer?.err && <p className="mt-3 rounded-lg bg-blood/15 p-3 text-sm">{ownAnswer.err}</p>}
            {ownAnswer?.res[0] && (
              <div className="mt-3">
                <ResultTable result={ownAnswer.res[0]} />
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function ResultTable({ result }: { result: Result }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl bg-felt">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="sticky top-0 bg-felt-3">
          <tr>
            {result.columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                {pretty(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.values.map((row, j) => (
            <tr key={j} className="border-t border-line/60">
              {row.map((v, k) => (
                <td key={k} className={`whitespace-nowrap px-3 py-2 ${typeof v === 'number' ? 'text-right' : ''}`}>
                  {v == null ? <span className="text-dim">–</span> : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartGlyph({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {kind === 'line' ? <path d="M3 17l5-5 4 3 8-8" /> : kind === 'vbar' ? <path d="M6 20V11M12 20V5M18 20v-7" /> : <path d="M4 6h11M4 12h16M4 18h7" />}
    </svg>
  );
}

/** win_pct -> Win %, commander_damage -> Commander damage */
function pretty(c: string) {
  const m: Record<string, string> = {
    win_pct: 'Win %',
    per_game: 'Per game',
    avg_minutes: 'Avg min',
    longest_minutes: 'Longest min',
    avg_place: 'Avg place',
    games_together: 'Games together',
    turn_order: 'Turn order',
  };
  if (m[c]) return m[c];
  const t = c.replace(/_/g, ' ');
  return t[0].toUpperCase() + t.slice(1);
}
