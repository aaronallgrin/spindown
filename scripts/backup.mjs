// Nightly backup of the group's games and polls (run by .github/workflows/backup.yml).
// Writes backup/spindown-backup.json in the same shape as History, Export backup, so it
// can go straight back in with History, Import backup, plus a raw copy of every table.
// Reading the tables also counts as activity, which keeps the free Supabase project awake.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/cloud.ts', import.meta.url), 'utf8');
const url = src.match(/url:\s*'([^']+)'/)?.[1];
const key = src.match(/key:\s*'([^']+)'/)?.[1];
if (!url || !key) throw new Error('Could not find the Supabase url and key in src/cloud.ts');

async function all(table, order) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}&limit=1000&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const games = await all('games', 'updated_at.asc,id.asc');
// polls are optional: a project without them still backs up its games
const polls = await all('polls', 'created_at.asc').catch(() => []);
const responses = await all('poll_responses', 'updated_at.asc').catch(() => []);

const live = games.filter((g) => !g.deleted).map((g) => g.data);
mkdirSync('backup', { recursive: true });
writeFileSync(
  'backup/spindown-backup.json',
  JSON.stringify({ app: 'spindown', version: 1, exportedAt: Date.now(), games: live }, null, 2),
);
writeFileSync('backup/tables.json', JSON.stringify({ exportedAt: new Date().toISOString(), games, polls, poll_responses: responses }));
console.log(`Backed up ${live.length} games (${games.length - live.length} deleted), ${polls.length} polls, ${responses.length} poll answers.`);
