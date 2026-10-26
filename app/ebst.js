// Effective BST calculations: a port of research/ebst.py. See FORMULA.md for the spec.
(function (root) {
  var MIXED_RATIO = 0.75; // lower attacking stat >= 75% of higher -> physical/special/both is selectable
  var BOTH_WEIGHT = 1.5;  // BSR: weight per sweepiness term when counting both (single mode uses 2)
  var STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

  // Drop cosmetic duplicates (Squawkabilly colors, Castform weathers, Toxtricity-Low-Key).
  function dedupe(list) {
    var seen = {};
    return list.filter(function (p) {
      var key = [p.name.split('-')[0]].concat(STATS.map(function (s) { return p[s]; })).join('|');
      if (p.name.indexOf('-Mega') === -1 && seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function bst(p) {
    return STATS.reduce(function (sum, s) { return sum + p[s]; }, 0);
  }

  function defaultOffense(p) {
    return p.atk >= p.spa ? 'physical' : 'special';
  }

  function isMixed(p) {
    return Math.min(p.atk, p.spa) >= MIXED_RATIO * Math.max(p.atk, p.spa);
  }

  function offenseStat(p, mode) {
    return { physical: p.atk, special: p.spa, both: p.atk + p.spa }[mode];
  }

  function ebst(p, mode, trickRoom) {
    return p.hp + p.def + p.spd + offenseStat(p, mode) + (trickRoom ? -p.spe : p.spe);
  }

  // --- BSR-style model (Smogon BSR v3/4.0 structure, X-Act / Rising_Dusk) ---

  // Share of the pool this Pokemon moves before (ties count half).
  function speedFactor(p, pool, trickRoom) {
    var slower = 0, others = pool.length - 1;
    pool.forEach(function (q) {
      if (q === p) return;
      if (q.spe < p.spe) slower += 1;
      else if (q.spe === p.spe) slower += 0.5;
    });
    var sf = slower / others;
    return trickRoom ? 1 - sf : sf;
  }

  function sweepiness(stat, sf) {
    var s = stat * 2 + 36;
    return s * (s * sf + 415) / (s * (1 - sf) + 415);
  }

  function bsrComponents(pool, trickRoom) {
    return pool.map(function (p) {
      var shp = p.hp * 2 + 141;
      var sf = speedFactor(p, pool, trickRoom);
      return { pt: shp * (p.def * 2 + 36), st: shp * (p.spd * 2 + 36),
               ps: sweepiness(p.atk, sf), ss: sweepiness(p.spa, sf) };
    });
  }

  function mean(xs) {
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  function pstdev(xs) {
    var mu = mean(xs);
    return Math.sqrt(mean(xs.map(function (x) { return (x - mu) * (x - mu); })));
  }

  // Standardize each component against the normal-mode population (so TR stays comparable).
  function zscores(rows, refRows) {
    var out = rows.map(function () { return {}; });
    ['pt', 'st', 'ps', 'ss'].forEach(function (k) {
      var ref = refRows.map(function (r) { return r[k]; });
      var mu = mean(ref), sd = pstdev(ref);
      rows.forEach(function (r, i) { out[i][k] = (r[k] - mu) / sd; });
    });
    return out;
  }

  function bsrRaw(z, mode) {
    if (mode === 'both') return z.pt + z.st + BOTH_WEIGHT * (z.ps + z.ss);
    return z.pt + z.st + 2 * (mode === 'physical' ? z.ps : z.ss);
  }

  // Precomputes everything that depends on the whole pool; returns a scorer.
  function buildModel(list) {
    var pool = dedupe(list);
    var normal = bsrComponents(pool, false);
    var zNorm = zscores(normal, normal);
    var zTr = zscores(bsrComponents(pool, true), normal);

    // Put BSR on the same scale as normal-mode EBST so the toggle compares like with like.
    var baseRaw = pool.map(function (p, i) { return bsrRaw(zNorm[i], defaultOffense(p)); });
    var baseEbst = pool.map(function (p) { return ebst(p, defaultOffense(p), false); });
    var muR = mean(baseRaw), sdR = pstdev(baseRaw), muE = mean(baseEbst), sdE = pstdev(baseEbst);

    var index = new Map(pool.map(function (p, i) { return [p, i]; }));

    function score(p, model, mode, trickRoom) {
      if (model === 'sum') return ebst(p, mode, trickRoom);
      var z = (trickRoom ? zTr : zNorm)[index.get(p)];
      return Math.round(muE + (bsrRaw(z, mode) - muR) / sdR * sdE);
    }

    return { pool: pool, score: score };
  }

  var api = { MIXED_RATIO: MIXED_RATIO, STATS: STATS, bst: bst, defaultOffense: defaultOffense,
              isMixed: isMixed, offenseStat: offenseStat, buildModel: buildModel };
  if (typeof module !== 'undefined') module.exports = api;
  else root.EBST = api;
})(this);
