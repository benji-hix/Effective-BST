// Speed tiers for Pokémon Champions at level 50. See FORMULA.md section H for the spec.
(function (root) {
  var MAX_SP = 32;  // Stat Points per stat (Showdown sim/team-validator.ts)

  // Battle-only forms that keep the Speed of the form the Pokémon is brought as.
  var BATTLE_ONLY = ['Castform-Sunny', 'Castform-Rainy', 'Castform-Snowy', 'Aegislash-Blade'];

  // Every form a player can bring, once. Drops cosmetic duplicates (same species, types and stats:
  // Squawkabilly colors, Toxtricity-Low-Key, Meowstic-F-Mega) and battle-only forms. Unlike ebst.js it
  // keeps forms that share stats but not types (Rotom appliances, Paldean Tauros breeds): each is its own threat.
  function pool(list) {
    var seen = {};
    return list.filter(function (p) {
      if (BATTLE_ONLY.indexOf(p.name) !== -1) return false;
      var key = [p.name.split('-')[0], p.types.join('/'), p.hp, p.atk, p.def, p.spa, p.spd, p.spe].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  // Level-50 Speed: base + 20 + SP (IVs are always 31), then the nature's x1.1 or x0.9, rounded down
  // (Showdown data/mods/champions/scripts.ts). nature: 1 = +Spe, 0 = neutral, -1 = -Spe.
  function stat(base, sp, nature) {
    var s = base + 20 + sp;
    return nature > 0 ? Math.floor(s * 110 / 100) : nature < 0 ? Math.floor(s * 90 / 100) : s;
  }

  // In-battle changes. A stat stage applies first; Choice Scarf (x1.5) and Tailwind (x2) are 4096ths
  // that round half down, as in Showdown's modify().
  var BOOSTS = {
    none: { stage: 0, mod: 4096 },
    scarf: { stage: 0, mod: 6144 },
    tailwind: { stage: 0, mod: 8192 },
    plus1: { stage: 1, mod: 4096 },
    minus1: { stage: -1, mod: 4096 }
  };

  function modify(speed, boost) {
    var b = BOOSTS[boost || 'none'];
    if (b.stage > 0) speed = Math.floor(speed * (2 + b.stage) / 2);
    if (b.stage < 0) speed = Math.floor(speed * 2 / (2 - b.stage));
    return Math.floor((speed * b.mod + 2047) / 4096);
  }

  function speed(base, sp, nature, boost) {
    return modify(stat(base, sp, nature), boost);
  }

  // The spreads people actually run, as Pikalytics and Pokémon Zone list them.
  var BENCHMARKS = [
    { key: 'maxplus', label: 'max+', note: '32 SP, +Spe nature', sp: 32, nature: 1 },
    { key: 'max', label: 'max', note: '32 SP, neutral nature', sp: 32, nature: 0 },
    { key: 'zero', label: '0 sp', note: '0 SP, neutral nature', sp: 0, nature: 0 },
    { key: 'minminus', label: 'min−', note: '0 SP, −Spe nature', sp: 0, nature: -1 },
    { key: 'scarfplus', label: 'scarf+', note: '32 SP, +Spe nature, Choice Scarf', sp: 32, nature: 1, boost: 'scarf' },
    { key: 'scarf', label: 'scarf', note: '32 SP, neutral nature, Choice Scarf', sp: 32, nature: 0, boost: 'scarf' }
  ];
  var BENCH = {};
  BENCHMARKS.forEach(function (b) { BENCH[b.key] = b; });

  function benchmark(p, key) {
    var b = BENCH[key];
    return speed(p.spe, b.sp, b.nature, b.boost);
  }

  // Fewest SP that gets past `target` with this nature and boost; null if 32 SP isn't enough.
  function minSpOver(base, nature, boost, target) {
    for (var sp = 0; sp <= MAX_SP; sp++) if (speed(base, sp, nature, boost) > target) return sp;
    return null;
  }

  // Most SP that stays under `target` (for Trick Room); null if even 0 SP is too fast.
  function maxSpUnder(base, nature, boost, target) {
    for (var sp = MAX_SP; sp >= 0; sp--) if (speed(base, sp, nature, boost) < target) return sp;
    return null;
  }

  // Every chosen spread of every threat, fastest first.
  function benchmarkList(threats, keys) {
    var out = [];
    threats.forEach(function (p) {
      keys.forEach(function (k) { out.push({ p: p, key: k, speed: benchmark(p, k) }); });
    });
    return out.sort(function (a, b) {
      return b.speed - a.speed || (a.p.name < b.p.name ? -1 : a.p.name > b.p.name ? 1 : 0);
    });
  }

  // Starter meta set for the threat list; viewers edit their own with the star toggle.
  // Pokémon Showdown bans these 30 from "[Gen 9 Champions] 4v4 Doubles UU" for reaching 4.52% usage on
  // the Reg M-B ladder (config/formats.ts), plus Reg M-C's high-usage newcomers Rillaboom, Salamence-Mega
  // and Golisopod-Mega (Poketools, Sep 2026 Reg M-C ladder). Swap in Pikalytics usage when it is reachable.
  var STARTER_THREATS = [
    'Aegislash', 'Aerodactyl', 'Archaludon', 'Basculegion', 'Charizard-Mega-Y', 'Delphox-Mega', 'Excadrill',
    'Farigiraf', 'Floette-Mega', 'Froslass-Mega', 'Garchomp', 'Gardevoir-Mega', 'Gengar-Mega', 'Golisopod-Mega',
    'Incineroar', 'Kingambit', 'Kommo-o', 'Maushold', 'Meganium-Mega', 'Milotic', 'Ninetales-Alola', 'Pelipper',
    'Rillaboom', 'Rotom-Wash', 'Salamence-Mega', 'Scizor-Mega', 'Scovillain-Mega', 'Sinistcha', 'Sneasler',
    'Talonflame', 'Tyranitar-Mega', 'Venusaur', 'Whimsicott'
  ];

  // Bump together with the ?v= on the speed.js script tag in index.html whenever this file changes.
  var api = { VERSION: 1, MAX_SP: MAX_SP, BOOSTS: BOOSTS, BENCHMARKS: BENCHMARKS, STARTER_THREATS: STARTER_THREATS,
              pool: pool, stat: stat, modify: modify, speed: speed, benchmark: benchmark,
              minSpOver: minSpOver, maxSpUnder: maxSpUnder, benchmarkList: benchmarkList };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SPEED = api;
})(this);
