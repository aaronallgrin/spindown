"""Convert the old MTG_Commander_Tracker.xlsx into a Spindown backup file.

Usage: python3 scripts/import_xlsx.py tracker.xlsx spindown-import.json
Then on the phone: History, Import backup, pick the .json file.

Columns read: match_id, player_name, commander_name, color_identity, bracket,
turn_order, eliminated_turn, win, win_turn, draw, format, set_or_theme.
Unknown values stay empty, so old games don't skew averages.
"""
import json
import re
import sys
from collections import OrderedDict
from datetime import datetime, timezone, timedelta

import os

import openpyxl

src, out = sys.argv[1], sys.argv[2]
# official names and color identities (fixes typos like "High Perfect Mercant")
FIX = json.load(open(os.path.join(os.path.dirname(__file__), 'commander_fixes.json')))
FIX.pop('_note', None)
fixed = []
ws = openpyxl.load_workbook(src, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
head = [str(h).strip() for h in rows[0]]
recs = [dict(zip(head, r)) for r in rows[1:] if any(v is not None for v in r)]

ORDER = 'WUBRG'
LAYOUT = {2: 'p2', 3: 'p3', 4: 'p4-sides', 5: 'p5', 6: 'p6'}
EST = timezone(timedelta(hours=-4))


def clean_name(n):
    n = re.sub(r'\s+', ' ', str(n or '').strip())
    return n[:1].upper() + n[1:].lower() if n.isupper() or n.islower() else n


def colors(s):
    letters = set(re.sub(r'[^WUBRG]', '', str(s or '').upper()))
    return [c for c in ORDER if c in letters]


def num(v):
    if v is None or str(v).strip() == '':
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def bracket(v):
    s = str(v or '').strip().upper()
    if s == 'P':
        return 0
    n = num(s)
    return n if n is not None and 0 <= n <= 5 else None


games = OrderedDict()
for r in recs:
    games.setdefault(str(r['match_id']).strip(), []).append(r)

out_games = []
notes = []
for mid, ps in games.items():
    y, m, d, k = (int(x) for x in mid.split('_'))
    # evening game night, an hour apart per game; exact times weren't recorded
    start = datetime(y, m, d, 19, 0, tzinfo=EST) + timedelta(hours=k - 1)
    start_ms = int(start.timestamp() * 1000)

    has_order = all(num(p.get('turn_order')) for p in ps)
    if has_order:
        ps = sorted(ps, key=lambda p: num(p['turn_order']))
    won = [p for p in ps if num(p.get('win')) == 1]
    drew = [p for p in ps if num(p.get('draw')) == 1]
    win_turn = max([num(p.get('win_turn')) or 0 for p in ps] or [0])
    elim = [num(p.get('eliminated_turn')) for p in ps if num(p.get('eliminated_turn'))]
    rounds = max([win_turn, *elim, 0])

    players, setups, events = [], [], []
    for seat, p in enumerate(ps):
        name = clean_name(p['player_name'])
        cmd = re.sub(r'\s+', ' ', str(p.get('commander_name') or '').strip()) or None
        cols = colors(p.get('color_identity'))
        if cmd in FIX:
            official, ci = FIX[cmd]
            if official != cmd or colors(ci) != cols:
                fixed.append(f'{mid} {clean_name(p["player_name"])}: {cmd} {"".join(cols)} -> {official} {ci}')
            cmd, cols = official, colors(ci)
        br = bracket(p.get('bracket'))
        out_round = num(p.get('eliminated_turn'))
        if num(p.get('win')) == 1:
            result = 'win'
        elif num(p.get('draw')) == 1 or (not won and out_round is None):
            result = 'draw'
        else:
            result = 'loss'
        players.append(
            {
                'seat': seat,
                'turnOrder': num(p.get('turn_order')) or 0,
                'name': name,
                'commander': cmd,
                'colors': cols,
                'bracket': br,
                'theme': (str(p['set_or_theme']).strip() if p.get('set_or_theme') else None),
                'result': result,
                'outRound': out_round,
                'finalLife': 0 if result == 'loss' else 0,
                'finalPoison': 0,
                'cmdrDamageTaken': 0,
                'wasMonarchAtEnd': False,
            }
        )
        setups.append(
            {
                'name': name,
                'hasPartner': False,
                'colors': cols,
                'bracket': br,
                'commander': {'name': cmd, 'colorIdentity': cols} if cmd else None,
            }
        )
    # knockouts in the order they happened, so finishing places work
    for p in sorted([x for x in players if x['outRound']], key=lambda x: x['outRound']):
        events.append({'at': start_ms + p['outRound'], 'round': p['outRound'], 'turn': p['outRound'], 'seat': p['seat'], 'kind': 'out'})

    if not won:
        notes.append(f"{mid}: no winner recorded ({'draw between ' + ', '.join(clean_name(p['player_name']) for p in drew) if drew else 'nobody marked as winner'})")

    out_games.append(
        {
            'id': f'xlsx-{mid}',
            'format': 'commander',
            'startingLife': 40,
            'playerCount': len(players),
            'startedAt': start_ms,
            'endedAt': start_ms,
            'durationMin': 0,
            'rounds': rounds,
            'winnerName': players[[p['result'] for p in players].index('win')]['name'] if won else None,
            'players': players,
            'events': events,
            'imported': True,
            'synced': 0,
            'config': {
                'format': 'commander',
                'startingLife': 40,
                'orientation': 'portrait',
                'layoutId': LAYOUT.get(len(players), 'p4-sides'),
                'players': setups,
                'cmdrDamageLosesLife': True,
                'extraCounter': '*',
            },
        }
    )

json.dump({'app': 'spindown', 'version': 1, 'source': 'MTG_Commander_Tracker.xlsx', 'games': out_games}, open(out, 'w'), ensure_ascii=False)
print(f'{len(out_games)} games, {sum(len(g["players"]) for g in out_games)} player rows')
for n in notes:
    print(' note:', n)
for f in fixed:
    print(' fixed:', f)
