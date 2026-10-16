"""Turn the Comprehensive Rules (text from `pdftotext cr.pdf cr.txt`) into JSON.

Usage: python3 scripts/parse_rules.py cr.txt public/rules.json
"""
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding='utf-8').read().replace('\f', '\n')
lines = [l.rstrip() for l in text.split('\n')]

effective = next((l for l in lines[:5] if 'effective as of' in l), '')
effective = re.sub(r'.*effective as of\s*', '', effective).rstrip('.')

# body runs from the second "1. Game Concepts" (the first is the contents) to the last "Glossary"
starts = [i for i, l in enumerate(lines) if l == '1. Game Concepts']
body_start = starts[1]
gloss_start = max(i for i, l in enumerate(lines) if l == 'Glossary')
credits = max(i for i, l in enumerate(lines) if l == 'Credits')

CHAPTER = re.compile(r'^(\d)\.\s+(\S.*)$')
SECTION = re.compile(r'^(\d{3})\.\s+(\S.*)$')
RULE = re.compile(r'^(\d{3}\.\d+)\.?\s+(\S.*)$')  # 606.5 is missing its period in the 2026-09-25 text
SUB = re.compile(r'^(\d{3}\.\d+[a-z])\.?\s+(\S.*)$')  # 119.1d has a stray period

def key(num):
    """sortable key for a rule number like 702.19b"""
    m = re.match(r'(\d+)(?:\.(\d+))?([a-z]?)', num)
    return (int(m.group(1)), int(m.group(2) or -1), m.group(3) or '')

rules = []  # {n, t, kind}
cur = None
last_key = (0, -1, '')
chapter = None
for raw in lines[body_start:gloss_start]:
    l = raw.strip()
    if not l:
        continue
    m = None
    for kind, rx in (('rule', RULE), ('sub', SUB), ('section', SECTION), ('chapter', CHAPTER)):
        mm = rx.match(l)
        if mm:
            m = (kind, mm.group(1), mm.group(2))
            break
    if m:
        kind, num, body = m
        if kind == 'chapter':
            chapter = {'n': num, 't': body}
            rules.append({'n': num, 't': body, 'k': 'chapter'})
            cur = None
            continue
        k = key(num)
        # Rule numbers only go up, and a rule belongs to the section we are in.
        # Anything else is a wrapped line that happens to start with a rule number.
        same_section = kind != 'section' and k[0] == last_key[0]
        next_section = kind == 'section' and last_key[0] < k[0] <= last_key[0] + 100
        if k > last_key and (same_section or next_section):
            last_key = k
            cur = {'n': num, 't': body, 'k': kind}
            rules.append(cur)
            continue
    if cur is None:
        continue
    if l.startswith('Example:'):
        cur['t'] += '\n' + l
    else:
        cur['t'] += ' ' + l

# glossary: a term is a short line with no closing period that follows the end of a definition
gloss = []
g = lines[gloss_start + 1:credits]
prev_end = True
for l in (x.strip() for x in g):
    if not l:
        continue
    is_term = (
        prev_end
        and len(l) <= 60
        and not re.search(r'[.:;,]$', l)
        and not re.match(r'^\d+\.\s', l)
        and not l.startswith(('See ', 'Example'))
    )
    if is_term or not gloss:
        gloss.append({'term': l, 'def': ''})
    else:
        sep = '\n' if re.match(r'^\d+\.\s', l) or l.startswith('Example') else (' ' if gloss[-1]['def'] else '')
        gloss[-1]['def'] += sep + l
    prev_end = bool(re.search(r'[.)”"]$', l)) if not is_term else False

for e in gloss:
    e['def'] = e['def'].strip()

json.dump({'effective': effective, 'rules': rules, 'glossary': gloss}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
secs = sum(1 for r in rules if r['k'] == 'section')
print(f"effective {effective}: {len(rules)} rules ({secs} sections), {len(gloss)} glossary terms")
