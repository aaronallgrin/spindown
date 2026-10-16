import MiniSearch from 'minisearch';

export interface Rule {
  n: string;
  t: string;
  k: 'chapter' | 'section' | 'rule' | 'sub';
}
export interface GlossaryEntry {
  term: string;
  def: string;
}
export interface RulesData {
  effective: string;
  rules: Rule[];
  glossary: GlossaryEntry[];
}

export interface Hit {
  kind: 'rule' | 'glossary';
  id: string;
  score: number;
  terms: string[];
}

export interface RulesDb extends RulesData {
  byNumber: Map<string, Rule>;
  sectionTitle: (n: string) => string;
  chapterTitle: (n: string) => string;
  search: (q: string) => Hit[];
}

const STOP = new Set(
  `a an and are as at be been but by can could do does did for from had has have how i if in into is it its
  me my of on or so that the their them then there these they this to was what when where which while who
  why will with would you your yours any time same i'm im it's dont don't doesn't happens happen get gets`.split(/\s+/),
);

/** crude English stemmer so "blocks", "blocked", "blocking" meet "block" */
function stem(w: string) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ied')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es') && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export const processTerm = (t: string) => {
  const w = t.toLowerCase().replace(/[’']/g, '');
  if (!w || STOP.has(w)) return null;
  return stem(w);
};

/** everyday table talk mapped to the words the rules use */
const SYNONYMS: Record<string, string[]> = {
  kill: ['lose', 'destroy'],
  kills: ['loses', 'destroy'],
  die: ['dies', 'destroyed', 'graveyard'],
  dead: ['loses', 'dies'],
  respond: ['priority', 'stack'],
  counterspell: ['counter'],
  board: ['battlefield'],
  wipe: ['destroy', 'all'],
  tapped: ['tap'],
  hand: ['hand'],
  attack: ['attacking', 'combat'],
  block: ['blocking', 'combat'],
  first: ['starting'],
  goes: ['starting'],
  mull: ['mulligan'],
  ramp: ['mana'],
};

let loading: Promise<RulesDb> | null = null;

export function loadRules(): Promise<RulesDb> {
  loading ??= fetch(`${import.meta.env.BASE_URL}rules.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`rules.json ${r.status}`);
      return r.json() as Promise<RulesData>;
    })
    .then(build);
  loading.catch(() => (loading = null));
  return loading;
}

function build(data: RulesData): RulesDb {
  const byNumber = new Map(data.rules.map((r) => [r.n, r]));
  const sectionTitle = (n: string) => byNumber.get(n.slice(0, 3))?.t ?? '';
  const chapterTitle = (n: string) => byNumber.get(n.slice(0, 1))?.t ?? '';

  const docs = [
    ...data.rules
      .filter((r) => r.k === 'rule' || r.k === 'sub')
      .map((r) => ({ id: `r:${r.n}`, n: r.n, text: r.t, title: sectionTitle(r.n), term: '' })),
    ...data.glossary.map((g) => ({ id: `g:${g.term}`, n: '', text: g.def, title: '', term: g.term })),
  ];
  const ms = new MiniSearch({
    fields: ['term', 'title', 'text'],
    storeFields: [],
    processTerm,
    tokenize: (s) => s.split(/[^\p{L}\p{N}’']+/u),
  });
  ms.addAll(docs);

  const search = (q: string): Hit[] => {
    const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const extra = words.flatMap((w) => SYNONYMS[w] ?? []);
    const res = ms.search([q, ...extra].join(' '), {
      boost: { term: 4, title: 2, text: 1 },
      fuzzy: (term) => (term.length > 5 ? 0.2 : false),
      prefix: (term) => term.length > 3,
      combineWith: 'OR',
    });
    // rules that match more of the question's own words come first
    const asked = new Set(words.map(processTerm).filter(Boolean) as string[]);
    const covered = (r: (typeof res)[number]) => r.queryTerms.filter((t) => asked.has(t)).length;
    let glossary = 0;
    return res
      // a glossary entry shows only when the question names the term itself, at most two
      .filter((r) => {
        if (!String(r.id).startsWith('g:')) return true;
        const named = Object.entries(r.match).some(([t, f]) => f.includes('term') && asked.has(t));
        if (!named || glossary >= 2) return false;
        glossary++;
        return true;
      })
      .sort((x, y) => covered(y) - covered(x) || y.score - x.score)
      .slice(0, 40)
      .map((r) => {
        const id = String(r.id);
        return { kind: id.startsWith('g:') ? 'glossary' : 'rule', id: id.slice(2), score: r.score, terms: r.terms };
      });
  };

  return { ...data, byNumber, sectionTitle, chapterTitle, search };
}

/** "702.19b" -> "702.19", "702.19" -> "702" */
export const parentOf = (n: string) => (/[a-z]$/.test(n) ? n.slice(0, -1) : n.includes('.') ? n.split('.')[0] : n);

export const RULE_REF = /\b(\d{3}(?:\.\d+[a-z]?)?)\b/g;
