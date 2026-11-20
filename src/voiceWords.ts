/**
 * Names the group taught voice ("kodi" → "cody"), shared through Supabase so every phone learns.
 * Only fixes a player confirmed get saved. Works offline from this phone's copy.
 */
import type { Guess } from './voice';
import { cloud } from './push';

const KEY = 'spindown.voiceWords';

export function learnedWords(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

const keep = (w: Record<string, string>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* private mode */
  }
};

/** Pull the group's fixes; quietly does nothing offline or before voice_words.sql is run. */
export async function refreshLearned() {
  try {
    const rows: { heard: string; meant: string }[] = await (await cloud('rest/v1/voice_words?select=heard,meant')).json();
    keep({ ...learnedWords(), ...Object.fromEntries(rows.map((r) => [r.heard, r.meant])) });
  } catch {
    /* keep this phone's copy */
  }
}

export function learn(guessed: Guess[]) {
  keep({ ...learnedWords(), ...Object.fromEntries(guessed.map((x) => [x.heard, x.meant])) });
  cloud('rest/v1/voice_words?on_conflict=heard', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: JSON.stringify(guessed.map((x) => ({ heard: x.heard, meant: x.meant, updated_at: new Date().toISOString() }))),
  }).catch(() => {});
}
