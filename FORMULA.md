# Effective BST — Formula Spec (draft)

Format: VGC doubles, **Pokémon Champions, Regulation M-C** (Sep 9 – Dec 2, 2026).
Pool: 336 entries legal under Showdown's `[Gen 9 Champions] VGC 2026 Reg M-C` (Mythical and Restricted Legendary banned). Megas count as separate entries. Cosmetic duplicates (Squawkabilly colors, Castform weathers, Toxtricity-Low-Key) are removed.

Prototype: [research/ebst.py](research/ebst.py) · data: [research/reg-mc-pokemon.json](research/reg-mc-pokemon.json) (built by [research/extract.py](research/extract.py) from Showdown's `data/pokedex.ts` + `data/mods/champions/formats-data.ts`).

## A | Toggles

- **A1 | Model** — `Effective Sum` (called Simple Sum before 2026-10-26) or `BSR`.
- **A2 | Trick Room mode** — Speed counts against the Pokémon instead of for it.
- **A3 | Offense** — `physical`, `special` or `both`. Default: the higher of Atk/SpA. The picker is offered only for **mixed-eligible** Pokémon: both Atk and SpA ≥ a flat base-stat minimum. The minimum defaults to 80 (124 of 336 entries) and is adjustable in the app.

## B | Effective Sum (EBST)

```
Offense = Atk | SpA | Atk + SpA
EBST    = round(1.4·HP + Def + SpD + Offense + Spe)     (normal)
EBST    = round(1.4·HP + Def + SpD + Offense − Spe)     (Trick Room)
```

HP is weighted 1.4× (see G). Before 2026-10-26 this was the unweighted "Simple Sum".

## C | BSR model

Adapted from Smogon CAP's Base Stat Rating (X-Act, Rising_Dusk; BSR 4.0 counts only the stronger attacking stat).

1. Statistical stats (BSR's 0-EV conversions; proportional to Champions' 0-SP Lv50 stats of base+75 / base+20):
   `sHP = 2·HP + 141`, `sX = 2·X + 36`.
2. Speed factor `SF` = share of the pool this Pokémon outspeeds (ties count ½).
   **Trick Room: `SF → 1 − SF`** (the share of the pool it moves before when slower goes first). This is the BSR version of "subtract Speed", because in BSR Speed isn't added in as its own term.
3. Raw components:
   - `PT = sHP · sDef`, `ST = sHP · sSpD`
   - `PS = sAtk · (sAtk·SF + 415) / (sAtk·(1 − SF) + 415)`, same for `SS` with sSpA
4. Standardize each component to a z-score, always using the **normal-mode** pool mean and SD, so Trick Room scores stay comparable.
5. Combine:
   - single offense: `raw = PT + ST + 2·S` (S = PS or SS)
   - both: `raw = PT + ST + 1.5·(PS + SS)`
6. Rescale so normal-mode BSR has the same mean and SD as normal-mode EBST (both mean 482). This puts both models on one number line.

## F | Focus and Speed views (added 2026-10-26)

Two more toggles: **Focus** (`full` / `bulk` / `offense`) and **Speed** (on / off). Trick Room only applies while Speed is on. Full + Speed on is the original score above.

Effective Sum:
```
bulk    = 1.4·HP + Def + SpD            (+/− Spe if Speed is on)
offense = attacking stat                (+/− Spe if Speed is on)
```

BSR:
- **bulk** = `PT + ST`. With Speed on, it also adds the standardized speed factor `z(SF)` (`1 − SF` in Trick Room, still standardized against normal mode).
- **offense** = `2·S` (or `1.5·(PS + SS)` for both). With Speed off, SF is fixed at 0.5, which makes sweepiness equal the statistical attack.
- Each Focus + Speed combination is rescaled to match the same view in Effective Sum, normal mode (same mean and SD).

Bulk with Speed on is the support view, with offense dropped entirely. Top non-Megas in Effective Sum: Umbreon (438), Garchomp (433) and Snorlax (429) normally; Snorlax (369), Bastiodon (360) and Steelix (340) in Trick Room. Top Trick Room offense: Rampardos, Hatterene, Rhyperior.

These views exist only in [app/ebst.js](app/ebst.js). The Python prototype covers Full + Speed on.

## D | Prototype results (default offense)

| Rank | EBST | EBST (TR) | BSR | BSR (TR) |
|---|---|---|---|---|
| 1 | Tyranitar-Mega 645 | Steelix-Mega 525 | Salamence-Mega 649 | Crabominable-Mega 692 |
| 2 | Baxcalibur-Mega 641 | Golisopod-Mega 510 | Delphox-Mega 642 | Golisopod-Mega 684 |
| 3 | Metagross-Mega 627 | Tyranitar-Mega 503 | Metagross-Mega 641 | Chesnaught-Mega 668 |

(With HP weighted 1.4×, 2026-10-26.)

- Top non-Megas, normal: Baxcalibur 571, Garchomp 563, Tyranitar 545, Snorlax 539.
- Top non-Megas, Trick Room: Snorlax 479, Avalugg 452, Rhyperior 446, Avalugg-Hisui 442.
- Most points in an unused attacking stat: Lucario-Mega and Aegislash-Blade (140 each). Both are mixed-eligible, so nothing is wasted when the offense is set to `both`.
- The two models mostly agree. Rank correlation is 0.95 in normal mode and 0.98 in Trick Room. The biggest gaps: BSR rates fast attackers with average stats higher (Absol-Mega, Gengar, Alakazam) and slow attackers lower (Rampardos, Aggron).

## E | Decisions (settled 2026-10-25)

- **E1 | Trick Room scale (Effective Sum)** — Left unshifted. Subtracting Speed drops the average from 482 to 322, so Trick Room numbers are only compared with other Trick Room numbers.
- **E2 | Mixed threshold** — Started as a ratio: the lower attacking stat had to be ≥ 75% of the higher. On 2026-10-26 it changed to a flat, user-adjustable minimum: both attacking base stats ≥ 80 by default (124 entries).
- **E3 | BSR "both" weight** — Kept at 1.5 per sweepiness term. This mirrors Effective Sum, where "both" adds a sixth stat.
- **E4 | Edge cases** — Deferred: Body Press (uses Def), Foul Play (uses the target's Atk), Huge/Pure Power, and Speed-changing forms (Aegislash, Palafin-Hero).
- **E5 | HP weight** — 1.4× (2026-10-26), renaming Simple Sum to Effective Sum. See G.

## G | Why HP counts 1.4×

Bulk follows the damage formula: hits survived ∝ HP × Def against physical attacks and HP × SpD against special ones. So total bulk is `HP·Def + HP·SpD`, using actual level-50 stats (HP = base + 75, the other stats = base + 20).

- One extra point of HP raises total bulk by `Def + SpD`. One point of Def raises it by `HP`. So an HP point is worth `(Def + SpD) / HP` Def points.
- Across the 336-entry pool, that ratio averages 1.42 (median 1.38; most fall between 1.1 and 1.8).
- Against a single kind of attack, a Def point is worth more than an HP point, because HP's stat starts larger. HP comes out ahead only because it counts on both sides, and by about 1.4×, not 2×.
- Ranking agreement between the Sum's bulk and the true `HP·Def + HP·SpD` (rank correlation): 0.988 unweighted, about 0.997 at 1.4×, 0.980 at 2×.
- A fixed weight can't reward balance (100 HP / 100 Def survives more than 160 HP / 40 Def). The BSR model covers that.

## H | Speed Tiers tab (added 2026-10-28)

A second tab, implemented in [app/speed.js](app/speed.js). It lists actual level-50 Speed instead of base stats, because the question it answers is "what number do I need to hit?"

**Pool (340 entries).** Every form a player can bring, once. It drops cosmetic duplicates (same species, types and stats: Squawkabilly colors, Toxtricity-Low-Key, Meowstic-F-Mega) and the battle-only forms Castform-Sunny/Rainy/Snowy and Aegislash-Blade. Unlike the Effective BST pool, it keeps forms that share stats but not types (Rotom appliances, Paldean Tauros breeds), since each is its own threat.

**Speed.** From Showdown `data/mods/champions/scripts.ts` (all IVs 31, up to 32 Stat Points per stat):
```
stat  = base + 20 + SP                       (0 ≤ SP ≤ 32)
+Spe  = floor(stat · 1.1),  −Spe = floor(stat · 0.9)
```
In-battle changes follow Showdown's `getStat` order. A stat stage applies first (+1: `floor(s · 1.5)`, −1: `floor(s / 1.5)`). Then Choice Scarf (×1.5) and Tailwind (×2), as 4096ths rounded half down: `floor((s · mod + 2047) / 4096)`.

**Columns.** `max+` = 32 SP, +Spe · `max` = 32 SP, neutral · `0 sp` = 0 SP, neutral · `min−` = 0 SP, −Spe · `scarf+` / `scarf` = `max+` / `max` holding Choice Scarf. Every column sorts.

**What speed do I need.** Pick the Pokémon you're training, its nature and SP, and an optional boost on your side. The app lists the chosen spreads of every threat, fastest first, with your own line placed among them.
- Outspeed: you need `their speed + 1`. "How" is the fewest SP that gets there, with +Spe and with a neutral nature.
- Trick Room: you need `their speed − 1` or lower. "How" is the most SP you can keep, with −Spe and with neutral.
- Only spreads within your reachable range (0 SP −Spe up to 32 SP +Spe, after your boost) are listed. Your spread can't change the result against the others, so those collapse into "above your max" and "below your min".

**Meta threats.** A starter set of 33, editable per viewer with ★ (stored in the browser). It has two sources:
- The 30 Pokémon that Showdown bans from `[Gen 9 Champions] 4v4 Doubles UU` for reaching 4.52% usage on the Reg M-B ladder (`config/formats.ts`).
- Reg M-C's high-usage newcomers Rillaboom, Salamence-Mega and Golisopod-Mega (Poketools, Sep 2026 Reg M-C ladder).

Replace the set with Pikalytics' Reg M-C usage once pikalytics.com is reachable from the build environment.

The app ([app/](app/index.html)) implements this spec in [app/ebst.js](app/ebst.js), which matches the Python prototype on all 336 entries.
