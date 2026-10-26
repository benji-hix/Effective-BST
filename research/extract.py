"""Extract VGC Reg M-C legal Pokemon base stats from Showdown data files."""
import json, re, sys

dl = sys.argv[1]

def top_level_entries(text):
    # Entries are "\tid: {" ... "\t}," at one-tab indentation.
    return re.findall(r'^\t(\w+): \{\n(.*?)^\t\},', text, re.M | re.S)

fmt = {k: v for k, v in top_level_entries(open(f'{dl}/champ-formats-data.ts').read())}
legal_ids = [k for k, v in fmt.items() if 'isNonstandard' not in v]

dex = {k: v for k, v in top_level_entries(open(f'{dl}/pokedex.ts').read())}
out, dropped = [], []
for pid in legal_ids:
    body = dex.get(pid)
    if body is None:
        dropped.append((pid, 'no dex entry')); continue
    name = re.search(r'name: "([^"]+)"', body).group(1)
    stats = dict(re.findall(r'(hp|atk|def|spa|spd|spe): (\d+)', re.search(r'baseStats: \{([^}]*)\}', body).group(1)))
    tags = re.search(r'tags: \[([^\]]*)\]', body)
    tags = re.findall(r'"([^"]+)"', tags.group(1)) if tags else []
    if 'Mythical' in tags or 'Restricted Legendary' in tags:
        dropped.append((pid, ','.join(tags))); continue
    battle_only = re.search(r'battleOnly: "([^"]+)"', body)
    out.append({'id': pid, 'name': name, 'tier': (re.search(r'tier: "([^"]+)"', fmt[pid]) or [None, None])[1],
                'battleOnly': battle_only.group(1) if battle_only else None,
                **{k: int(v) for k, v in stats.items()}})

json.dump(out, open(sys.argv[2], 'w'), indent=1)
print(len(out), 'legal;', len(dropped), 'dropped:', dropped)
print('battleOnly forms:', [p['name'] for p in out if p['battleOnly']])
