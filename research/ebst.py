"""Prototype Effective BST calculations (simple sum and BSR-style) for VGC Reg M-C.

Usage: python3 ebst.py pokemon.json
"""
import json, statistics, sys

MIXED_RATIO = 0.75  # lower attacking stat >= 75% of higher -> user may pick physical/special/both
BOTH_WEIGHT = 1.5   # BSR: weight per sweepiness term when counting both (single mode uses 2)


def load(path):
    pool, seen = [], set()
    for p in json.load(open(path)):
        # Drop cosmetic duplicates (Squawkabilly colors, Castform weathers, Toxtricity-Low-Key).
        key = (p['name'].split('-')[0], *(p[s] for s in ('hp', 'atk', 'def', 'spa', 'spd', 'spe')))
        if '-Mega' not in p['name'] and key in seen:
            continue
        seen.add(key)
        pool.append(p)
    return pool


def default_offense(p):
    return 'physical' if p['atk'] >= p['spa'] else 'special'


def is_mixed(p):
    return min(p['atk'], p['spa']) >= MIXED_RATIO * max(p['atk'], p['spa'])


def offense_stat(p, mode):
    return {'physical': p['atk'], 'special': p['spa'], 'both': p['atk'] + p['spa']}[mode]


def ebst(p, mode, trick_room):
    speed = -p['spe'] if trick_room else p['spe']
    return p['hp'] + p['def'] + p['spd'] + offense_stat(p, mode) + speed


# --- BSR-style model (Smogon BSR v3/4.0 structure, X-Act / Rising_Dusk) ---

def speed_factor(p, pool, trick_room):
    """Share of the pool this Pokemon moves before (ties count half)."""
    others = [q['spe'] for q in pool if q is not p]
    slower = sum(s < p['spe'] for s in others) + 0.5 * sum(s == p['spe'] for s in others)
    sf = slower / len(others)
    return 1 - sf if trick_room else sf


def sweepiness(stat, sf):
    s = stat * 2 + 36
    return s * (s * sf + 415) / (s * (1 - sf) + 415)


def bsr_components(pool, trick_room):
    rows = []
    for p in pool:
        shp = p['hp'] * 2 + 141
        sf = speed_factor(p, pool, trick_room)
        rows.append({'pt': shp * (p['def'] * 2 + 36), 'st': shp * (p['spd'] * 2 + 36),
                     'ps': sweepiness(p['atk'], sf), 'ss': sweepiness(p['spa'], sf)})
    return rows


def zscores(rows, ref_rows):
    """Standardize each component against the normal-mode population (so TR stays comparable)."""
    out = [dict() for _ in rows]
    for k in ('pt', 'st', 'ps', 'ss'):
        ref = [r[k] for r in ref_rows]
        mu, sd = statistics.mean(ref), statistics.pstdev(ref)
        for o, r in zip(out, rows):
            o[k] = (r[k] - mu) / sd
    return out


def bsr_raw(z, mode):
    if mode == 'both':
        return z['pt'] + z['st'] + BOTH_WEIGHT * (z['ps'] + z['ss'])
    return z['pt'] + z['st'] + 2 * (z['ps'] if mode == 'physical' else z['ss'])


def compute(pool):
    normal = bsr_components(pool, False)
    z_norm = zscores(normal, normal)
    z_tr = zscores(bsr_components(pool, True), normal)

    # Put BSR on the same scale as normal-mode EBST so the toggle compares like with like.
    base_raw = [bsr_raw(z, default_offense(p)) for z, p in zip(z_norm, pool)]
    base_ebst = [ebst(p, default_offense(p), False) for p in pool]
    mu_r, sd_r = statistics.mean(base_raw), statistics.pstdev(base_raw)
    mu_e, sd_e = statistics.mean(base_ebst), statistics.pstdev(base_ebst)
    scale = lambda raw: mu_e + (raw - mu_r) / sd_r * sd_e

    results = []
    for p, zn, zt in zip(pool, z_norm, z_tr):
        mode = default_offense(p)
        results.append({
            'name': p['name'], 'bst': sum(p[s] for s in ('hp', 'atk', 'def', 'spa', 'spd', 'spe')),
            'mode': mode, 'mixed': is_mixed(p),
            'ebst': ebst(p, mode, False), 'ebst_tr': ebst(p, mode, True),
            'bsr': round(scale(bsr_raw(zn, mode))), 'bsr_tr': round(scale(bsr_raw(zt, mode))),
            'ebst_both': ebst(p, 'both', False), 'bsr_both': round(scale(bsr_raw(zn, 'both'))),
        })
    return results


if __name__ == '__main__':
    pool = load(sys.argv[1])
    json.dump(compute(pool), open(sys.argv[2] if len(sys.argv) > 2 else 'results.json', 'w'), indent=1)
