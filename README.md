# Spindown

A Magic: The Gathering life counter for one shared phone, built for 4-player Commander and fine for 2–6 players and other formats. Every finished game is saved with who went first, turn of each elimination and how it happened, commanders, color identity and bracket, so the group can look at stats later.

## What it tracks
- Life, poison, commander damage per opposing commander (partners counted separately), monarch
- Center d20: shows the round; tap to pass the turn clockwise, hold for the menu (undo, end game, leave, discard)
- First player: tap a seat, tap again to confirm (or tap the die for a random pick)
- Eliminations prompt automatically at 0 life, 10 poison or 21 commander damage, and record the round
- Commander games: commander and partner via Scryfall, color identity, bracket 1–5
- Other formats: deck name, theme, colors

## Develop
```
npm install
npm run dev
npm run build
```

Data lives on the device (IndexedDB). Use History, then Export backup to save a JSON copy.
