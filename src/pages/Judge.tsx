import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Link, useNavigate } from '../nav';
import { loadRules, parentOf, processTerm, type Hit, type RulesDb } from '../rules';
import { autocompleteCards, getRulings, type CardRulings } from '../scryfall';
import { Page, Segmented } from '../ui';

const TOPICS = [
  'commander damage',
  'state-based actions',
  'the stack',
  'priority',
  'combat damage',
  'trample',
  'monarch',
  'partner',
  'mulligan',
  'concede',
  'replacement effects',
  'layers',
];

function useRules() {
  const [db, setDb] = useState<RulesDb | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    loadRules()
      .then(setDb)
      .catch(() => setErr('The rules could not be loaded. Open the app once with a connection so they are saved for offline use.'));
  }, []);
  return { db, err };
}

/** Rule text with rule numbers turned into links and matched words highlighted. */
function RuleText({ text, db, terms = [] }: { text: string; db: RulesDb; terms?: string[] }) {
  const want = new Set(terms);
  const parts: ReactNode[] = [];
  const re = /(\d{3}(?:\.\d+[a-z]?)?)|([\p{L}’']+)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [tok, num, word] = m;
    if (num && db.byNumber.has(num.replace(/\.$/, ''))) {
      parts.push(
        <Link key={i++} to={`/judge/rule/${num}`} className="text-brass underline decoration-brass/40 underline-offset-2">
          {num}
        </Link>,
      );
    } else if (word && want.size && want.has(processTerm(word) ?? '')) {
      parts.push(
        <mark key={i++} className="rounded-sm bg-brass/25 px-0.5 text-bone">
          {word}
        </mark>,
      );
    } else parts.push(tok);
    last = m.index + tok.length;
  }
  parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, j) =>
        typeof p === 'string'
          ? p.split('\n').map((line, k, arr) => (
              <span key={`${j}-${k}`}>
                {line}
                {k < arr.length - 1 && <br />}
              </span>
            ))
          : p,
      )}
    </>
  );
}

export default function Judge() {
  const [tab, setTab] = useState<'rules' | 'cards'>('rules');
  const { db, err } = useRules();
  return (
    <Page title="Ask a Judge">
      <div className="mb-4">
        <Segmented
          label="Look up"
          value={tab}
          onChange={setTab}
          options={[
            { v: 'rules', label: 'Rules' },
            { v: 'cards', label: 'Card rulings' },
          ]}
        />
      </div>
      {tab === 'rules' ? (
        err ? <p className="rounded-xl bg-felt-2 p-4 text-dim">{err}</p> : db ? <RuleSearch db={db} /> : <p className="text-dim">Loading the rules</p>
      ) : (
        <CardSearch />
      )}
      {db && (
        <p className="mt-10 text-center text-xs text-dim">
          Magic: The Gathering Comprehensive Rules, effective {db.effective}.
        </p>
      )}
    </Page>
  );
}

function RuleSearch({ db }: { db: RulesDb }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const nav = useNavigate();

  useEffect(() => setText(q), [q]);

  const ruleNo = text.trim().replace(/^rule\s+/i, '').replace(/\.$/, '');
  const exact = /^\d{1,3}(\.\d+[a-z]?)?$/.test(ruleNo) && db.byNumber.has(ruleNo) ? ruleNo : null;
  const hits = useMemo(() => (q.trim().length > 1 ? db.search(q) : []), [db, q]);
  const gloss = hits.filter((h) => h.kind === 'glossary').slice(0, 3);
  const rules = hits.filter((h) => h.kind === 'rule').slice(0, 25);

  const submit = (v: string) => {
    const n = v.trim().replace(/^rule\s+/i, '').replace(/\.$/, '');
    if (/^\d{1,3}(\.\d+[a-z]?)?$/.test(n) && db.byNumber.has(n)) return nav(`/judge/rule/${n}`);
    setParams(v.trim() ? { q: v.trim() } : {}, { replace: true });
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="mb-4 flex gap-2"
      >
        <input
          id="judge-q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question or type a rule number"
          className="min-w-0 flex-1 rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
          enterKeyHint="search"
          autoComplete="off"
        />
        <button type="submit" className="rounded-lg bg-brass px-4 font-semibold text-felt">
          Search
        </button>
      </form>

      {exact && (
        <Link to={`/judge/rule/${exact}`} className="mb-3 block rounded-xl border border-brass/60 bg-felt-2 p-4">
          <span className="font-cond text-lg font-bold text-brass">Go to rule {exact}</span>
          <span className="block truncate text-sm text-dim">{db.byNumber.get(exact)!.t}</span>
        </Link>
      )}

      {!q && (
        <div>
          <div className="mb-2 text-sm text-dim">Common questions</div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => submit(t)}
                className="rounded-full bg-felt-2 px-3 py-1.5 text-sm hover:bg-felt-3"
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-dim">
            Search the official Comprehensive Rules and glossary in your own words, like “can I respond to a cascade trigger”, or
            jump to a rule by number, like 903.10a. Works without internet once the app has loaded once.
          </p>
        </div>
      )}

      {q && hits.length === 0 && (
        <p className="rounded-xl bg-felt-2 p-4 text-dim">Nothing in the rules matches that. Try fewer words, or the name of a keyword.</p>
      )}

      <div className="flex flex-col gap-2">
        {gloss.map((h) => {
          const g = db.glossary.find((x) => x.term === h.id)!;
          return (
            <div key={h.id} className="rounded-xl bg-felt-2 p-4">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-cond text-xl font-bold">{g.term}</span>
                <span className="text-xs text-dim">Glossary</span>
              </div>
              <div className="text-[15px] leading-relaxed text-bone/90">
                <RuleText text={g.def} db={db} terms={h.terms} />
              </div>
            </div>
          );
        })}
        {rules.map((h) => (
          <RuleHit key={h.id} hit={h} db={db} />
        ))}
      </div>
    </div>
  );
}

function RuleHit({ hit, db }: { hit: Hit; db: RulesDb }) {
  const r = db.byNumber.get(hit.id)!;
  return (
    <Link to={`/judge/rule/${r.n}`} className="block rounded-xl bg-felt-2 p-4 hover:bg-felt-3">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-cond text-lg font-bold text-brass">{r.n}</span>
        <span className="truncate text-xs text-dim">{db.sectionTitle(r.n)}</span>
      </div>
      <div className="line-clamp-4 text-[15px] leading-relaxed text-bone/90">
        <RuleText text={r.t} db={db} terms={hit.terms} />
      </div>
    </Link>
  );
}

export function RuleView() {
  const { n = '' } = useParams();
  const { db, err } = useRules();
  const target = useRef<HTMLDivElement>(null);
  const [whole, setWhole] = useState(false);

  useEffect(() => {
    setWhole(false);
  }, [n]);
  useEffect(() => {
    target.current?.scrollIntoView({ block: 'center' });
  }, [db, n, whole]);

  if (err) return <Page title="Rule" back="/judge"><p className="text-dim">{err}</p></Page>;
  if (!db) return <Page title="Rule" back="/judge">{null}</Page>;
  const rule = db.byNumber.get(n);
  if (!rule) return <Page title="Rule not found" back="/judge"><p className="text-dim">There is no rule {n}.</p></Page>;

  const section = n.slice(0, 3);
  const isSection = rule.k === 'section' || rule.k === 'chapter';
  // show the numbered rule with all its subrules, or the whole section
  const anchor = isSection ? n : rule.k === 'sub' ? parentOf(n) : n;
  const shown = db.rules.filter((r) => {
    if (r.k === 'chapter') return rule.k === 'chapter' && r.n === n;
    if (rule.k === 'chapter') return r.k === 'section' && r.n.startsWith(n);
    if (whole || isSection) return r.n === section || r.n.startsWith(section + '.');
    return r.n === anchor || (r.k === 'sub' && parentOf(r.n) === anchor);
  });
  const idx = db.rules.findIndex((r) => r.n === anchor);
  const prev = db.rules.slice(0, idx).reverse().find((r) => r.k === (isSection ? 'section' : 'rule'));
  const next = db.rules.slice(idx + 1).find((r) => r.k === (isSection ? 'section' : 'rule'));

  return (
    <Page title={`Rule ${n}`} back="/judge">
      <div className="mb-4 text-sm text-dim">
        <Link to={`/judge/rule/${n[0]}`} className="hover:text-bone">
          {n[0]}. {db.chapterTitle(n)}
        </Link>
        {rule.k !== 'chapter' && (
          <>
            {' › '}
            <Link to={`/judge/rule/${section}`} className="hover:text-bone">
              {section}. {db.sectionTitle(n)}
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {shown.map((r) => (
          <div
            key={r.n}
            ref={r.n === n ? target : undefined}
            className={`rounded-lg px-3 py-2.5 ${r.n === n ? 'bg-brass/15 ring-1 ring-brass/60' : ''} ${
              r.k === 'sub' ? 'ml-4' : ''
            }`}
          >
            {r.k === 'section' || r.k === 'chapter' ? (
              <Link to={`/judge/rule/${r.n}`} className="font-cond text-xl font-bold">
                {r.n}. {r.t}
              </Link>
            ) : (
              <p className="text-[15px] leading-relaxed">
                <Link to={`/judge/rule/${r.n}`} className="mr-1.5 font-cond font-bold text-brass">
                  {r.n}
                </Link>
                <RuleText text={r.t} db={db} />
              </p>
            )}
          </div>
        ))}
      </div>

      {!isSection && (
        <div className="mt-5 flex flex-wrap gap-2">
          {!whole && (
            <button onClick={() => setWhole(true)} className="rounded-lg bg-felt-2 px-3 py-2 text-sm hover:bg-felt-3">
              Show all of section {section}
            </button>
          )}
          {prev && (
            <Link to={`/judge/rule/${prev.n}`} className="rounded-lg bg-felt-2 px-3 py-2 text-sm hover:bg-felt-3">
              ‹ {prev.n}
            </Link>
          )}
          {next && (
            <Link to={`/judge/rule/${next.n}`} className="rounded-lg bg-felt-2 px-3 py-2 text-sm hover:bg-felt-3">
              {next.n} ›
            </Link>
          )}
        </div>
      )}
    </Page>
  );
}

function CardSearch() {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<string[]>([]);
  const [card, setCard] = useState<CardRulings | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) return setOpts([]);
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      autocompleteCards(q, ctl.signal)
        .then((r) => setOpts(r.slice(0, 8)))
        .catch(() => {});
    }, 250);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  const open = async (name: string) => {
    setOpts([]);
    setQ(name);
    setStatus('loading');
    try {
      setCard(await getRulings(name));
      setStatus('idle');
    } catch (e) {
      setMsg(navigator.onLine ? (e as Error).message : 'Card rulings need an internet connection.');
      setStatus('error');
    }
  };

  return (
    <div>
      <form
        className="relative mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) open(q.trim());
        }}
      >
        <input
          id="card-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Card name"
          className="w-full rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
          autoComplete="off"
          enterKeyHint="search"
        />
        {opts.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-felt-2 shadow-xl">
            {opts.map((o) => (
              <button key={o} type="button" onClick={() => open(o)} className="block w-full px-3 py-2 text-left hover:bg-felt-3">
                {o}
              </button>
            ))}
          </div>
        )}
      </form>

      {status === 'loading' && <p className="text-dim">Looking up rulings</p>}
      {status === 'error' && <p className="rounded-xl bg-felt-2 p-4 text-dim">{msg}</p>}
      {!card && status === 'idle' && (
        <p className="text-sm leading-relaxed text-dim">
          Official rulings for any card, from Scryfall. These are the clarifications Wizards publishes for specific cards.
        </p>
      )}

      {card && status === 'idle' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 rounded-xl bg-felt-2 p-4">
            {card.image && <img src={card.image} alt="" className="w-28 shrink-0 self-start rounded-lg" />}
            <div className="min-w-0">
              <div className="font-cond text-2xl font-bold leading-tight">{card.name}</div>
              <div className="text-sm text-dim">
                {card.manaCost} {card.typeLine}
              </div>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{card.oracle}</p>
            </div>
          </div>
          {card.rulings.length === 0 && <p className="text-dim">This card has no official rulings.</p>}
          {card.rulings.map((r, i) => (
            <div key={i} className="rounded-xl bg-felt-2 p-4">
              <div className="mb-1 text-xs text-dim">{r.date}</div>
              <p className="text-[15px] leading-relaxed">{r.text}</p>
            </div>
          ))}
          {card.scryfallUri && (
            <a href={card.scryfallUri} target="_blank" rel="noreferrer" className="text-sm text-brass">
              Open on Scryfall
            </a>
          )}
        </div>
      )}
    </div>
  );
}
