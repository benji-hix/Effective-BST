# Effective BST — Formula Spec (draft)

Format: VGC doubles, **Pokémon Champions, Regulation M-C** (Sep 9 – Dec 2, 2026).
Pool: 336 entries legal under Showdown's `[Gen 9 Champions] VGC 2026 Reg M-C` (Mythical and Restricted Legendary banned). Megas count as separate entries. Cosmetic duplicates (Squawkabilly colors, Castform weathers, Toxtricity-Low-Key) are removed.

Prototype: [research/ebst.py](research/ebst.py) · data: [research/reg-mc-pokemon.json](research/reg-mc-pokemon.json) (built by [research/extract.py](research/extract.py) from Showdown's `data/pokedex.ts` + `data/mods/champions/formats-data.ts`).

## A | Toggles

- **A1 | Model** — `Simple Sum` or `BSR`.
- **A2 | Trick Room mode** — Speed counts against the Pokémon instead of for it.
- **A3 | Offense** — `physical`, `special` or `both`. Default: the higher of Atk/SpA. The picker is offered only for **mixed-eligible** Pokémon: lower attacking stat ≥ 75% of the higher (124 of 336 entries).

## B | Simple Sum (EBST)

```
Offense = Atk | SpA | Atk + SpA
EBST    = HP + Def + SpD + Offense + Spe     (normal)
EBST    = HP + Def + SpD + Offense − Spe     (Trick Room)
```

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
6. Rescale so normal-mode BSR has the same mean and SD as normal-mode EBST (both mean 450). This puts both models on one number line.

## F | Focus and Speed views (added 2026-10-26)

Two more toggles: **Focus** (`full` / `bulk` / `offense`) and **Speed** (on / off). Trick Room only applies while Speed is on. Full + Speed on is the original score above.

Simple Sum:
```
bulk    = HP + Def + SpD                (+/− Spe if Speed is on)
offense = attacking stat                (+/− Spe if Speed is on)
```

BSR:
- **bulk** = `PT + ST`. With Speed on, it also adds the standardized speed factor `z(SF)` (`1 − SF` in Trick Room, still standardized against normal mode).
- **offense** = `2·S` (or `1.5·(PS + SS)` for both). With Speed off, SF is fixed at 0.5, which makes sweepiness equal the statistical attack.
- Each Focus + Speed combination is rescaled to match the same view in Simple Sum, normal mode (same mean and SD).

Bulk with Speed on is the support view, with offense dropped entirely. Top non-Megas in Simple Sum: Umbreon and Aegislash (400) normally, and Bastiodon (336) and Steelix (310) in Trick Room. Top Trick Room offense: Rampardos, Hatterene, Rhyperior.

These views exist only in [app/ebst.js](app/ebst.js). The Python prototype covers Full + Speed on.

## D | Prototype results (default offense)

| Rank | EBST | EBST (TR) | BSR | BSR (TR) |
|---|---|---|---|---|
| 1 | Tyranitar-Mega 605 | Steelix-Mega 495 | Salamence-Mega 611 | Crabominable-Mega 653 |
| 2 | Metagross-Mega 595 | Golisopod-Mega 480 | Delphox-Mega 605 | Golisopod-Mega 644 |
| 3 | Baxcalibur-Mega 595 | Aggron-Mega 470 | Metagross-Mega 603 | Chesnaught-Mega 630 |

- Top non-Megas, normal: Baxcalibur 525, Garchomp 520, Tyranitar / Metagross 505.
- Top non-Megas, Trick Room: Snorlax 415, Avalugg 414, Avalugg-Hisui 404, Rhyperior 400.
- Most points wasted (BST − EBST): Lucario-Mega and Aegislash-Blade (140 each). Both are mixed-eligible, so that waste disappears when the offense is set to `both`.
- The two models mostly agree. Rank correlation is 0.95 in normal mode and 0.98 in Trick Room. The biggest gaps involve slow attackers such as Aggron and Rampardos, which BSR rates lower, and fast attackers with average stats such as Absol-Mega and Lycanroc, which BSR rates higher.

## E | Decisions (settled 2026-10-25)

- **E1 | Trick Room scale (Simple Sum)** — Left unshifted. Subtracting Speed drops the average from 450 to 290, so Trick Room numbers are only compared with other Trick Room numbers.
- **E2 | Mixed threshold** — Kept at 75%, which flags 124 entries.
- **E3 | BSR "both" weight** — Kept at 1.5 per sweepiness term. This mirrors Simple Sum, where "both" adds a sixth stat.
- **E4 | Edge cases** — Deferred: Body Press (uses Def), Foul Play (uses the target's Atk), Huge/Pure Power, and Speed-changing forms (Aegislash, Palafin-Hero).

The app ([app/](app/index.html)) implements this spec in [app/ebst.js](app/ebst.js), which matches the Python prototype on all 336 entries.
