/*
 * 会山行ロックマラソン 得点計算ロジック (docs/rule.md 準拠)
 * ブラウザでは window.Scoring、Node では module.exports として使える。
 */
(function (root) {
  'use strict';

  // ---- グレード ----------------------------------------------------------
  const GRADES = ['5.5', '5.6', '5.7', '5.8', '5.9'];
  for (let n = 10; n <= 15; n++) for (const l of 'abcd') GRADES.push(`5.${n}${l}`);

  // 絶対グレード点 (rule 4-②)。5.13b 以上は 20 点刻みで延長。
  const ABS_TABLE = {
    '5.5': 40, '5.6': 50, '5.7': 60, '5.8': 70, '5.9': 80,
    '5.10a': 90, '5.10b': 100, '5.10c': 110, '5.10d': 120,
    '5.11a': 135, '5.11b': 150, '5.11c': 165, '5.11d': 180,
    '5.12a': 200, '5.12b': 220, '5.12c': 240, '5.12d': 260, '5.13a': 280,
  };
  const OS_FLOOR = '5.8';

  function gradeIndex(g) {
    const i = GRADES.indexOf(g);
    if (i < 0) throw new Error(`不明なグレード: ${g}`);
    return i;
  }

  function absolutePoints(g) {
    if (g in ABS_TABLE) return ABS_TABLE[g];
    return ABS_TABLE['5.13a'] + 20 * (gradeIndex(g) - gradeIndex('5.13a'));
  }

  /** 最高RPから4段階下。5.8未満、またはRPなし(未経験)なら5.8。 */
  function expectedOS(rp) {
    if (!rp) return OS_FLOOR;
    const i = Math.max(gradeIndex(rp) - 4, gradeIndex(OS_FLOOR));
    return GRADES[i];
  }

  const TYPE_BONUS = { sport: 0, mix: 10, trad: 20 };
  const TYPE_LABEL = { sport: 'スポート', mix: 'ミックス', trad: 'トラッド' };

  // ミックスはリムーバブルプロテクションを使うため、トラッドの想定OS/RPで評価する。
  const usesTradGrade = (type) => type === 'trad' || type === 'mix';

  function memberOS(member, type) {
    return expectedOS(usesTradGrade(type) ? member.tradRP : member.sportRP);
  }

  /** TR完登の判定に使う事前申告RP (トラッド未経験なら空) */
  function memberRP(member, type) {
    return (usesTradGrade(type) ? member.tradRP : member.sportRP) || '';
  }

  /** トラッド/ミックスのルートで、トラッド未経験の参加者か */
  function tradNovice(member, type) {
    return usesTradGrade(type) && !member.tradRP;
  }

  /** ルート得点の内訳 (TRは0点) */
  function routeScore(member, ascent) {
    const os = memberOS(member, ascent.type);
    const delta = gradeIndex(ascent.grade) - gradeIndex(os);
    const relative = Math.max(0, 120 + 20 * delta);
    const absolute = absolutePoints(ascent.grade);
    const height = Math.max(0, Number(ascent.height) || 0);
    const bonus = TYPE_BONUS[ascent.type] || 0;
    const total = relative * 0.75 + absolute * 0.25 + height + bonus;
    return { os, delta, relative, absolute, height, bonus, total: ascent.tr ? 0 : total };
  }

  /** TR完登が完登数に数えられるか (事前申告RP以上。トラッド未経験者のトラッド/ミックスはグレード不問) */
  function trCounts(member, ascent) {
    if (tradNovice(member, ascent.type)) return true;
    const rp = memberRP(member, ascent.type);
    return !!rp && gradeIndex(ascent.grade) >= gradeIndex(rp);
  }

  // ---- マルチピッチ / ペナルティ ------------------------------------------
  function multipitchBonus(pitches) {
    const p = Number(pitches) || 0;
    if (p >= 7) return 300;
    if (p >= 5) return 200;
    if (p === 4) return 150;
    if (p === 3) return 100;
    if (p === 2) return 50;
    return 0;
  }

  const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  /** 終了時刻を1分でも過ぎたら-300、以降5分ごとに-300。 */
  function latePenalty(arrival, endTime) {
    const a = toMinutes(arrival), e = toMinutes(endTime);
    if (a == null || e == null) return { lateMinutes: 0, penalty: 0 };
    const late = a - e;
    if (late <= 0) return { lateMinutes: 0, penalty: 0 };
    return { lateMinutes: late, penalty: -300 * (Math.floor(late / 5) + 1) };
  }

  const normalize = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

  // ---- チーム集計 ----------------------------------------------------------
  function scoreTeam(team, ascents, areas, endTime) {
    const areaPoints = new Map(areas.map((a) => [normalize(a.name), a]));
    const own = ascents.filter((a) => a.teamId === team.id);

    const members = team.members.map((m) => {
      const seen = new Set();
      const rows = own
        .filter((a) => a.memberId === m.id)
        .sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0))
        .map((a) => {
          const key = normalize(a.route) + '|' + normalize(a.area);
          const duplicate = seen.has(key);
          seen.add(key);
          const s = routeScore(m, a);
          const counted = !duplicate && (!a.tr || trCounts(m, a));
          return { ascent: a, ...s, duplicate, counted, rate: 0, points: 0 };
        });
      return { member: m, rows, count: rows.filter((r) => r.counted).length };
    });

    const minCount = members.length ? Math.min(...members.map((m) => m.count)) : 0;

    for (const m of members) {
      const counted = m.rows.filter((r) => r.counted).sort((a, b) => b.total - a.total);
      counted.forEach((r, i) => {
        r.rate = i < minCount ? 1 : 0.25;
        r.points = r.total * r.rate;
      });
      m.full = counted.slice(0, minCount).reduce((s, r) => s + r.points, 0);
      m.reduced = counted.slice(minCount).reduce((s, r) => s + r.points, 0);
      m.points = m.full + m.reduced;
    }

    // エリアポイント: TR以外の対象ルートを1本以上完登したエリア
    const visited = new Map();
    for (const m of members) {
      for (const r of m.rows) {
        if (r.duplicate || r.ascent.tr) continue;
        const k = normalize(r.ascent.area);
        if (!k || visited.has(k)) continue;
        const def = areaPoints.get(k);
        visited.set(k, { name: def ? def.name : r.ascent.area, points: def ? Number(def.points) || 0 : 0, known: !!def });
      }
    }
    const areaList = [...visited.values()];
    const areaTotal = areaList.reduce((s, a) => s + a.points, 0);

    // マルチピッチ完登ボーナス: チームにつき1回 (最大のもの)
    const mps = (team.multipitch || []).map((x) => ({ ...x, bonus: multipitchBonus(x.pitches) }));
    const best = mps.reduce((b, x) => (!b || x.bonus > b.bonus ? x : b), null);
    const mpBonus = best ? best.bonus : 0;

    const late = latePenalty(team.arrival, endTime);
    const routeTotal = members.reduce((s, m) => s + m.points, 0);
    // 人数補正 (rule 4): 最終得点 = (チーム得点 / チーム人数) × 3
    // 遅刻ペナルティ (rule 8) は人数によらない固定値なので補正後に加算する。
    const teamSize = members.length;
    const rawTotal = routeTotal + areaTotal + mpBonus;
    const adjusted = teamSize ? (rawTotal * 3) / teamSize : 0;
    const total = adjusted + late.penalty;

    return { team, members, minCount, routeTotal, areaList, areaTotal, multipitch: mps, mpBest: best, mpBonus, ...late, teamSize, rawTotal, adjusted, total };
  }

  function scoreAll(state) {
    const results = state.teams.map((t) => scoreTeam(t, state.ascents, state.areas, state.endTime));
    const ranked = [...results].sort((a, b) => b.total - a.total);
    ranked.forEach((r, i) => { r.rank = i > 0 && r.total === ranked[i - 1].total ? ranked[i - 1].rank : i + 1; });
    return results;
  }

  const api = {
    GRADES, TYPE_LABEL, gradeIndex, absolutePoints, expectedOS, memberOS, memberRP,
    routeScore, trCounts, tradNovice, multipitchBonus, latePenalty, scoreTeam, scoreAll,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scoring = api;
})(typeof window !== 'undefined' ? window : globalThis);
