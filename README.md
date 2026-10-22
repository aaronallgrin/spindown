# Spindown

A Magic: The Gathering life counter for one shared phone, built for 4-player Commander and fine for 2–6 players and other formats. Every finished game is saved with who went first, turn of each elimination and how it happened, commanders, color identity and bracket, so the group can look at stats later.

## What it tracks
- Life, poison, commander damage per opposing commander (partners counted separately), monarch
- Counters screen also sets a life total or gains/loses an amount; tap anywhere else to back out
- Center d20: shows the round; tap to pass the turn clockwise, hold for the menu (undo, end game, leave, discard)
- First player: once everyone's seated, tap a seat, tap again to confirm (tapping the die rolls a plain d20 if no one has dice)
- Eliminations prompt automatically at 0 life, 10 poison or 21 commander damage, and record the round
- Commander games: commander and partner via Scryfall, color identity, bracket 1–5
- Other formats: deck name, theme, colors

## Develop
```
npm install
npm run dev
npm test
npm run build
```
Pushes to main run lint and tests before deploying.

Data lives on the device (IndexedDB). Use History, then Export backup to save a JSON copy.

Cloud sync: run `supabase/games.sql`, then `supabase/games_updated_at.sql`, once in the Supabase SQL Editor. The first creates the games table (or tightens an existing one so the public key can't hard-delete games); the second makes game times come from the server clock, not each phone's.

Backup: `.github/workflows/backup.yml` runs every night, saves every game and poll as a downloadable artifact (kept 90 days), and keeps the free Supabase project from pausing. To restore, download `spindown-backup.json` from a run and use History, then Import backup. Run it by hand from the Actions tab any time.

## Find a game
Availability polls for the group, kept in the same Supabase project as cloud sync.
Run `supabase/polls.sql` once in the Supabase SQL Editor to add the `polls` and `poll_responses` tables.

- Home, Find a game, Start a poll: format (brackets for Commander), up to 7 days, hours, game length, players needed.
- Share sends a link that carries the group's connection, so friends open it and answer with just their name. No accounts and no cloud sync setup.
- Everyone paints their free hours. The poll ranks the best windows that fit the whole game and shows who can make each.
- The host locks in a time. Everyone can then add it to Apple Calendar (an .ics file) or Google Calendar.

Anyone with a poll link can read and change polls and their answers, the same trust model as the sync invite. Only share it with your group.

## Rules data
`public/rules.json` is generated from the official Comprehensive Rules PDF:
```
pdftotext MagicCompRules.pdf cr.txt
python3 scripts/parse_rules.py cr.txt public/rules.json
```
Run this again whenever Wizards publishes a new version.

## Old spreadsheet games
`scripts/import_xlsx.py` turns the old MTG_Commander_Tracker.xlsx into a backup file
(History, then Import backup). Commander names are corrected using `scripts/commander_fixes.json`.
