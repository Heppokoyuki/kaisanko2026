// node --test site/scoring.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./scoring.js');

test('想定OS: rule.md のチーム表と一致する', () => {
  const cases = [
    ['5.13b', '5.12b'], ['5.12b', '5.11b'], ['5.11c', '5.10c'], ['5.11b', '5.10b'],
    ['5.11a', '5.10a'], ['5.10d', '5.9'], ['5.10c', '5.8'], ['5.10a', '5.8'],
    ['5.9', '5.8'], ['5.8', '5.8'], ['5.7', '5.8'], ['', '5.8'],
  ];
  for (const [rp, os] of cases) assert.equal(S.expectedOS(rp), os, rp);
});

test('絶対グレード点: 5.13b以上は20点刻み', () => {
  assert.equal(S.absolutePoints('5.10b'), 100);
  assert.equal(S.absolutePoints('5.13a'), 280);
  assert.equal(S.absolutePoints('5.13b'), 300);
  assert.equal(S.absolutePoints('5.14a'), 360);
});

test('計算例: RP5.11a が 5.10b・20m トラッド → 170点', () => {
  const m = { sportRP: '5.11a', tradRP: '5.11a' };
  const s = S.routeScore(m, { grade: '5.10b', height: 20, type: 'trad' });
  assert.equal(s.relative, 140);
  assert.equal(s.total, 170);
});

test('相対グレード点は0点未満にならない', () => {
  const m = { sportRP: '5.13b', tradRP: '' };
  assert.equal(S.routeScore(m, { grade: '5.5', height: 0, type: 'sport' }).relative, 0);
});

test('TRは0点、事前申告RP以上なら完登数に算入', () => {
  const m = { sportRP: '5.10a', tradRP: '' };
  assert.equal(S.routeScore(m, { grade: '5.11a', height: 20, type: 'sport', tr: true }).total, 0);
  assert.equal(S.trCounts(m, { grade: '5.10a', type: 'sport' }), true);
  assert.equal(S.trCounts(m, { grade: '5.9', type: 'sport' }), false);
  // トラッド未経験者のトラッド/ミックスTRはグレード不問で算入
  assert.equal(S.trCounts(m, { grade: '5.5', type: 'trad' }), true);
  assert.equal(S.trCounts(m, { grade: '5.6', type: 'mix' }), true);
  // トラッド経験者はトラッドRPで判定
  const t = { sportRP: '5.11a', tradRP: '5.9' };
  assert.equal(S.trCounts(t, { grade: '5.9', type: 'trad' }), true);
  assert.equal(S.trCounts(t, { grade: '5.8', type: 'trad' }), false);
});

test('マルチピッチボーナス', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 10].map(S.multipitchBonus), [0, 50, 100, 150, 200, 200, 300, 300]);
});

test('遅刻ペナルティ', () => {
  assert.equal(S.latePenalty('16:00', '16:00').penalty, 0);
  assert.equal(S.latePenalty('16:01', '16:00').penalty, -300);
  assert.equal(S.latePenalty('16:04', '16:00').penalty, -300);
  assert.equal(S.latePenalty('16:05', '16:00').penalty, -600);
  assert.equal(S.latePenalty('', '16:00').penalty, 0);
});

test('チーム集計: 最少完登数超過分は25%、エリア・MPボーナス', () => {
  const mk = (id, rp) => ({ id, name: id, sportRP: rp, tradRP: '' });
  const team = { id: 'T', members: [mk('a', '5.11a'), mk('b', '5.9'), mk('c', '5.9')], multipitch: [{ pitches: 3 }, { pitches: 2 }], arrival: '16:06' };
  let t = 0;
  const asc = (memberId, route, grade, extra = {}) => ({ teamId: 'T', memberId, route, area: '屋根岩', grade, height: 10, type: 'sport', createdAt: t++, ...extra });
  const ascents = [
    asc('a', 'r1', '5.8'), asc('a', 'r2', '5.11a'), asc('a', 'r3', '5.10a'),
    asc('a', 'r2', '5.11a'), // 重複 → 無効
    asc('b', 'r1', '5.8'), asc('b', 'r4', '5.8', { area: '妹岩' }),
    asc('c', 'r1', '5.8'), asc('c', 'x', '5.9', { tr: true }), // RP以上のTR → 完登数のみ
  ];
  const areas = [{ name: '屋根岩', points: 50 }, { name: '妹岩', points: 30 }];
  const r = S.scoreTeam(team, ascents, areas, '16:00');
  assert.equal(r.minCount, 2);
  const a = r.members[0];
  assert.equal(a.count, 3);
  // a の想定OS 5.10a: r2(5.11a)=200*.75+135*.25+10, r3(5.10a)=120*.75+90*.25+10, r1(5.8)=80*.75+70*.25+10
  const r2 = 150 + 33.75 + 10, r3 = 90 + 22.5 + 10, r1 = 60 + 17.5 + 10;
  assert.equal(a.points, r2 + r3 + r1 * 0.25);
  assert.equal(r.members[2].count, 2);
  assert.equal(r.areaTotal, 80);
  assert.equal(r.mpBonus, 100);
  assert.equal(r.penalty, -600);
  // 3人チームは人数補正で変わらない
  assert.equal(r.teamSize, 3);
  assert.ok(Math.abs(r.adjusted - r.rawTotal) < 1e-9);
  assert.ok(Math.abs(r.total - (r.rawTotal - 600)) < 1e-9);
});

test('人数補正: 最終得点 = (チーム得点 / 人数) × 3、遅刻は補正後に加算', () => {
  const mk = (id) => ({ id, name: id, sportRP: '5.10a', tradRP: '' });
  const asc = (memberId) => ({ teamId: 'T', memberId, route: 'r', area: '屋根岩', grade: '5.8', height: 10, type: 'sport', createdAt: 0 });
  // 5.8 (想定OS 5.8) 10m スポート = 120*.75 + 70*.25 + 10 = 117.5
  const areas = [{ name: '屋根岩', points: 50 }];
  const two = S.scoreTeam({ id: 'T', members: [mk('a'), mk('b')], multipitch: [{ pitches: 2 }], arrival: '16:01' },
    [asc('a'), asc('b')], areas, '16:00');
  assert.equal(two.rawTotal, 117.5 * 2 + 50 + 50);
  assert.equal(two.adjusted, (117.5 * 2 + 100) / 2 * 3);
  assert.equal(two.total, two.adjusted - 300);

  const four = S.scoreTeam({ id: 'T', members: ['a', 'b', 'c', 'd'].map(mk), multipitch: [] },
    ['a', 'b', 'c', 'd'].map(asc), areas, '16:00');
  assert.equal(four.total, (117.5 * 4 + 50) / 4 * 3);

  assert.equal(S.scoreTeam({ id: 'T', members: [], multipitch: [] }, [], [], '16:00').total, 0);
});

test('チーム集計: 3人以外のチームでも最少完登数で補正する', () => {
  const mk = (id) => ({ id, name: id, sportRP: '5.10a', tradRP: '' });
  const run = (ids, counts) => {
    let t = 0;
    const ascents = ids.flatMap((id, i) => Array.from({ length: counts[i] }, (_, k) =>
      ({ teamId: 'T', memberId: id, route: `r${k}`, area: 'x', grade: '5.9', height: 0, type: 'sport', createdAt: t++ })));
    return S.scoreTeam({ id: 'T', members: ids.map(mk), multipitch: [] }, ascents, [], '16:00');
  };
  // 2人: 4本・2本 → 最少2本
  const two = run(['a', 'b'], [4, 2]);
  assert.equal(two.minCount, 2);
  assert.equal(two.members[0].rows.filter((r) => r.rate === 0.25).length, 2);
  // 4人: 5・3・3・1本 → 最少1本
  const four = run(['a', 'b', 'c', 'd'], [5, 3, 3, 1]);
  assert.equal(four.minCount, 1);
  assert.equal(four.members[1].rows.filter((r) => r.rate === 1).length, 1);
  // 1人・0人でも落ちない
  assert.equal(run(['a'], [3]).minCount, 3);
  assert.equal(run([], []).minCount, 0);
});
