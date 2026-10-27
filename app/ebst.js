// Effective BST calculations: a port of research/ebst.py. See FORMULA.md for the spec.
(function (root) {
  var MIXED_MIN = 80;     // default: lower attacking base stat >= 80 -> physical/special/both is selectable
  // Effective Sum counts HP 1.4x: one HP point adds about 1.4x the bulk (HP*Def + HP*SpD) of a
  // Def or SpD point (pool mean of (Def+SpD+40)/(HP+75) at level 50). See FORMULA.md section G.
  var HP_WEIGHT = 1.4;
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

  function isMixed(p, min) {
    return Math.min(p.atk, p.spa) >= (min === undefined ? MIXED_MIN : min);
  }

  function offenseStat(p, mode) {
    return { physical: p.atk, special: p.spa, both: p.atk + p.spa }[mode];
  }

  // focus: 'full' | 'bulk' (HP + Def + SpD) | 'offense' (attacking stat); speed: whether Spe counts.
  function ebst(p, mode, trickRoom, focus, speed) {
    var spe = speed === false ? 0 : trickRoom ? -p.spe : p.spe;
    var bulk = HP_WEIGHT * p.hp + p.def + p.spd, offense = offenseStat(p, mode);
    if (focus === 'bulk') return Math.round(bulk + spe);
    if (focus === 'offense') return offense + spe;
    return Math.round(bulk + offense + spe);
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

  // speed === false uses a neutral SF of 0.5, which makes sweepiness equal the statistical attack.
  function bsrComponents(pool, trickRoom, speed) {
    return pool.map(function (p) {
      var shp = p.hp * 2 + 141;
      var sf = speed === false ? 0.5 : speedFactor(p, pool, trickRoom);
      return { pt: shp * (p.def * 2 + 36), st: shp * (p.spd * 2 + 36),
               ps: sweepiness(p.atk, sf), ss: sweepiness(p.spa, sf), sf: sf };
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
    ['pt', 'st', 'ps', 'ss', 'sf'].forEach(function (k) {
      var ref = refRows.map(function (r) { return r[k]; });
      var mu = mean(ref), sd = pstdev(ref);
      rows.forEach(function (r, i) { out[i][k] = (r[k] - mu) / sd; });
    });
    return out;
  }

  function bsrOffense(z, mode) {
    if (mode === 'both') return BOTH_WEIGHT * (z.ps + z.ss);
    return 2 * (mode === 'physical' ? z.ps : z.ss);
  }

  // Bulk has no Speed inside it, so when Speed counts it adds the standardized speed factor.
  function bsrRaw(z, mode, focus, speed) {
    var bulk = z.pt + z.st;
    if (focus === 'bulk') return bulk + (speed === false ? 0 : z.sf);
    if (focus === 'offense') return bsrOffense(z, mode);
    return bulk + bsrOffense(z, mode);
  }

  // Precomputes everything that depends on the whole pool; returns a scorer.
  function buildModel(list) {
    var pool = dedupe(list);
    var normal = bsrComponents(pool, false);
    var flat = bsrComponents(pool, false, false);
    var zNorm = zscores(normal, normal);
    var zTr = zscores(bsrComponents(pool, true), normal);
    var zFlat = zscores(flat, flat);
    zFlat.forEach(function (z) { z.sf = 0; });

    // Put BSR on the same scale as normal-mode EBST with the same focus and Speed setting,
    // so the model toggle compares like with like.
    var scales = {};
    function scaleFor(focus, speed) {
      var key = focus + '|' + speed;
      if (!scales[key]) {
        var z = speed ? zNorm : zFlat;
        var raw = pool.map(function (p, i) { return bsrRaw(z[i], defaultOffense(p), focus, speed); });
        var sum = pool.map(function (p) { return ebst(p, defaultOffense(p), false, focus, speed); });
        scales[key] = { muR: mean(raw), sdR: pstdev(raw), muE: mean(sum), sdE: pstdev(sum) };
      }
      return scales[key];
    }

    var index = new Map(pool.map(function (p, i) { return [p, i]; }));

    // opts: { model: 'sum'|'bsr', mode, trickRoom, focus: 'full'|'bulk'|'offense', speed: bool }
    function score(p, opts) {
      var focus = opts.focus || 'full', speed = opts.speed !== false;
      if (opts.model === 'sum') return ebst(p, opts.mode, opts.trickRoom, focus, speed);
      var z = (!speed ? zFlat : opts.trickRoom ? zTr : zNorm)[index.get(p)];
      var s = scaleFor(focus, speed);
      return Math.round(s.muE + (bsrRaw(z, opts.mode, focus, speed) - s.muR) / s.sdR * s.sdE);
    }

    return { pool: pool, score: score };
  }

  // Bump together with the ?v= on the script tags in index.html whenever this file changes.
  var api = { VERSION: 6, MIXED_MIN: MIXED_MIN, HP_WEIGHT: HP_WEIGHT, STATS: STATS, bst: bst, defaultOffense: defaultOffense,
              isMixed: isMixed, offenseStat: offenseStat, buildModel: buildModel };
  if (typeof module !== 'undefined') module.exports = api;
  else root.EBST = api;
})(this);
