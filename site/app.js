(function () {
  'use strict';
  const S = window.Scoring;
  const STORAGE_KEY = 'kaisanko2026-rock-marathon-v1';
  const UI_KEY = 'kaisanko2026-rock-marathon-ui';

  // ---- エリアポイント (map.pdf エリアポイントマップ) ---------------------------
  const AREA_GROUPS = [
    ['屋根岩', [['屋根岩本峰', 40], ['屋根岩五峰', 30], ['屋根岩四峰', 30], ['屋根岩三峰', 30], ['屋根岩二峰', 20], ['屋根岩一峰', 20],
      ['ガメラ岩', 40], ['おむすび山スラブ', 30], ['純情岩', 20], ['ソラマメスラブ', 20], ['兜岩', 20], ['水晶スラブ', 10]]],
    ['西側・カモシカ登山道', [['砦岩', 40], ['東門', 30], ['前衛壁', 40], ['藐姑射岩', 40], ['カモシカサイドロック', 30], ['唐沢の滝', 50],
      ['ラスト・ワン', 10], ['ローリングストーン', 20]]],
    ['廻り目平周辺', [['仏岩', 30], ['大クラックの岩', 40], ['最高ルーフ', 20], ['雷岩', 30], ['アミダ岩', 30], ['眠り姫/シーサー岩', 30],
      ['お殿様岩', 20], ['お姫様岩', 20], ['タヌキ岩', 30], ['キツネ岩', 30], ['親指岩', 10], ['モドキ岩', 20]]],
    ['八幡沢', [['無名峰岩峰', 40], ['八幡沢大滝', 40], ['リングサイド', 10], ['左岸スラブ', 10], ['蚕岩', 10],
      ['ガマスラブ', 10], ['マガスラブ', 20]]],
    ['金峰山川左岸', [['ストリームサイド', 20], ['リバーバンク', 10], ['セイルロック', 10], ['兄岩', 10], ['サイコロ岩', 10], ['おばさん岩', 10],
      ['父岩', 20], ['弟岩', 10], ['母岩', 20], ['ラピュタ塔', 30], ['リバーサイド', 20], ['妹岩', 20], ['たまご岩/隠し子岩', 20],
      ['姉岩', 40], ['マラ岩', 20]]],
    ['烏帽子岩', [['烏帽子岩左岩壁', 60], ['烏帽子岩本峰西面', 50], ['裏烏帽子', 40]]],
    ['涸沢・川端下', [['モアイ岩', 80], ['涸沢岩峰群一峰', 50], ['涸沢岩峰群二峰', 50], ['時計台の岩稜', 40],
      ['サイコスラブ', 50], ['花豆スラブ', 30], ['ひよこ豆スラブ', 20], ['フェニックスの大岩', 20]]],
    ['ペルセウス座流星群', [['くまの洞窟', 40], ['隕石', 60], ['彗星岩', 50], ['火星人', 60], ['金星人', 50], ['ゴジラ岩', 60]]],
  ];
  const DEFAULT_AREAS = AREA_GROUPS.flatMap(([group, list]) => list.map(([name, points]) => [name, points, group]));
  const DEFAULT_GROUP = new Map(DEFAULT_AREAS.map(([name, , group]) => [name, group]));
  const ADDED_GROUP = '追加したエリア';
  const OTHER_AREA = 'その他（ポイントなし）';
  const groupOf = (a) => a.group || DEFAULT_GROUP.get(a.name) || ADDED_GROUP;

  // ---- 初期データ (docs/rule.md 2. チーム編成) -------------------------------
  const member = (id, name, sportRP, tradRP) => ({ id, name, sportRP, tradRP });
  const DEFAULT_STATE = () => ({
    version: 1,
    endTime: '16:00',
    teams: [
      { id: 'A', name: 'A', arrival: '', multipitch: [], members: [
        member('A1', '伊佐見', '5.13b', '5.12b'), member('A2', '竹内', '5.8', '5.7'), member('A3', '奥村', '5.7', '')] },
      { id: 'B', name: 'B', arrival: '', multipitch: [], members: [
        member('B1', '東', '5.11c', '5.8'), member('B2', '山本', '5.10c', '5.9')] },
      { id: 'C', name: 'C', arrival: '', multipitch: [], members: [
        member('C1', 'ナベ', '5.11b', '5.10d'), member('C2', '高橋', '5.10a', '5.9'), member('C3', '木下', '5.9', '5.8')] },
      { id: 'D', name: 'D', arrival: '', multipitch: [], members: [
        member('D1', '長田', '5.11a', '5.10a'), member('D2', '村松', '5.10c', '5.10a'), member('D3', '近堂', '5.8', '5.8')] },
    ],
    areas: DEFAULT_AREAS.map(([name, points, group]) => ({ name, points, group })),
    ascents: [],
  });

  // ---- 保存 ----------------------------------------------------------------
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('保存できませんでした（ブラウザの設定を確認してください）');
    }
  }
  let state = load(STORAGE_KEY, null) || DEFAULT_STATE();
  // 旧版の仮エリア（全て0pt）のままなら、マップのエリアポイントに差し替える
  if (state.areas.every((a) => !Number(a.points))) state.areas = DEFAULT_STATE().areas;
  const ui = Object.assign({ tab: 'log', team: 'A' }, load(UI_KEY, {}));
  const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* noop */ } };

  // ---- ユーティリティ ------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const team = () => state.teams.find((t) => t.id === ui.team) || state.teams[0];
  const gradeOptions = (selected, allowEmpty) =>
    (allowEmpty ? `<option value="" ${!selected ? 'selected' : ''}>未経験</option>` : '') +
    S.GRADES.map((g) => `<option ${g === selected ? 'selected' : ''}>${g}</option>`).join('');

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function commit() {
    save();
    render();
  }

  // ---- タブ ----------------------------------------------------------------
  document.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tab; saveUI(); renderTabs(); render(); }));
  function renderTabs() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
    document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${ui.tab}`; });
  }

  // ---- 記録タブ ------------------------------------------------------------
  const form = $('#ascent-form');
  $('#grade-select').innerHTML = S.GRADES.map((g) => `<option ${g === '5.9' ? 'selected' : ''}>${g}</option>`).join('');

  function selectedMembers() {
    const ids = [...form.querySelectorAll('input[name="member"]:checked')].map((i) => i.value);
    return team().members.filter((m) => ids.includes(m.id));
  }
  function formAscent() {
    const fd = new FormData(form);
    return {
      route: String(fd.get('route') || '').trim(),
      area: String(fd.get('area') || '').trim(),
      grade: fd.get('grade'),
      height: Number(fd.get('height')) || 0,
      type: fd.get('type'),
      tr: fd.get('tr') === 'on',
    };
  }

  function renderPreview() {
    const a = formAscent();
    const ms = selectedMembers();
    if (!ms.length) { $('#preview').innerHTML = '<span class="muted">登った人を選んでください</span>'; return; }
    $('#preview').innerHTML = ms.map((m) => {
      if (a.tr) {
        const ok = S.trCounts(m, a);
        return `<div><b>${esc(m.name)}</b> TR：0点・完登数に${ok ? '<span class="ok">算入する</span>' : '<span class="ng">算入しない</span>'}（${S.tradNovice(m, a.type) ? 'トラッド未経験：グレード不問' : `RP ${esc(S.memberRP(m, a.type) || 'なし')}`}）</div>`;
      }
      const s = S.routeScore(m, a);
      const d = s.delta > 0 ? `+${s.delta}` : s.delta;
      return `<div><b>${esc(m.name)}</b> <span class="pts">${fmt(s.total)}点</span>
        <span class="muted">= 相対${s.relative}(OS ${s.os}, ${d})×0.75 + 絶対${s.absolute}×0.25 + 高さ${s.height} + ${s.bonus}</span></div>`;
    }).join('') + areaNote(a.area);
  }
  function areaNote(name) {
    if (!name || name === OTHER_AREA) return '';
    const area = state.areas.find((x) => x.name === name);
    if (!area) return '';
    const visited = state.ascents.some((x) => x.teamId === team().id && !x.tr && x.area === name);
    return `<div class="muted">エリア ${esc(area.name)}：${area.points}pt${visited ? '（獲得済み）' : '（このチームは未獲得・TR以外で完登すると加算）'}</div>`;
  }

  // エリア選択: 地図の区域ごとにまとめ、チームが獲得済みのエリアには ✓ を付ける
  function renderAreaSelect(result) {
    const sel = $('#area-select');
    const current = sel.value;
    const got = new Set(result.areaList.map((a) => a.name));
    const groups = new Map();
    for (const a of state.areas) {
      const g = groupOf(a);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(a);
    }
    const opt = (a) => `<option value="${esc(a.name)}">${got.has(a.name) ? '✓ ' : ''}${esc(a.name)}（${Number(a.points) || 0}pt）</option>`;
    sel.innerHTML = '<option value="" disabled>エリアを選択</option>' +
      [...groups].map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(opt).join('')}</optgroup>`).join('') +
      `<optgroup label="その他"><option value="${esc(OTHER_AREA)}">${esc(OTHER_AREA)}</option></optgroup>`;
    sel.value = [...sel.options].some((o) => o.value === current && current) ? current : '';
  }
  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ms = selectedMembers();
    if (!ms.length) { toast('登った人を選んでください'); return; }
    const a = formAscent();
    const now = Date.now();
    ms.forEach((m, i) => state.ascents.push({ id: uid(), teamId: team().id, memberId: m.id, ...a, createdAt: now + i }));
    form.route.value = '';
    form.tr.checked = false;
    commit();
    toast(`${a.route} を ${ms.length}人分 記録しました`);
  });

  $('#mp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    team().multipitch.push({ id: uid(), route: f.route.value.trim(), pitches: Number(f.pitches.value), createdAt: Date.now() });
    f.reset();
    commit();
  });

  $('#arrival').addEventListener('change', (e) => { team().arrival = e.target.value; commit(); });

  document.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const [kind, id, sub] = del.dataset.del.split(':');
    if (kind === 'member') {
      const t = state.teams.find((x) => x.id === id);
      const m = t && t.members.find((x) => x.id === sub);
      if (!m) return;
      const n = state.ascents.filter((a) => a.teamId === t.id && a.memberId === m.id).length;
      if (!confirm(`チーム${t.name}から「${m.name || '（名前なし）'}」を外しますか？${n ? `\nこの人の完登記録 ${n} 件も削除されます。` : ''}`)) return;
      t.members = t.members.filter((x) => x.id !== m.id);
      state.ascents = state.ascents.filter((a) => !(a.teamId === t.id && a.memberId === m.id));
      commit();
      return;
    }
    if (!confirm('この記録を削除しますか？')) return;
    if (kind === 'ascent') state.ascents = state.ascents.filter((a) => a.id !== id);
    if (kind === 'mp') state.teams.forEach((t) => { t.multipitch = t.multipitch.filter((x) => x.id !== id); });
    if (kind === 'area') state.areas.splice(Number(id), 1);
    commit();
  });

  function renderLog(results) {
    const t = team();
    const r = results.find((x) => x.team.id === t.id);

    $('#team-picker').innerHTML = state.teams.map((x) =>
      `<button type="button" data-team="${esc(x.id)}" aria-pressed="${x.id === t.id}">チーム${esc(x.name)}</button>`).join('');

    const checked = new Set([...form.querySelectorAll('input[name="member"]:checked')].map((i) => i.value));
    const keep = form.dataset.team === t.id;
    $('#member-checks').innerHTML = t.members.map((m) =>
      `<label><input type="checkbox" name="member" value="${esc(m.id)}" ${!keep || checked.has(m.id) ? 'checked' : ''}><span>${esc(m.name)}</span></label>`).join('');
    form.dataset.team = t.id;

    renderAreaSelect(r);
    $('#end-time-label').textContent = state.endTime;
    $('#arrival').value = t.arrival || '';
    $('#arrival-penalty').textContent = r.penalty ? `${r.lateMinutes}分遅れ：${r.penalty}点` : '';

    $('#mp-list').innerHTML = r.multipitch.length ? r.multipitch.map((x) =>
      `<li><span>${esc(x.route)}（${x.pitches}P）<b class="pts">+${x.bonus}</b>${r.mpBest && r.mpBest.id === x.id ? ' <em class="tag ok">採用</em>' : ''}</span>
       <button class="icon" data-del="mp:${esc(x.id)}" aria-label="削除">×</button></li>`).join('')
      : '<li class="muted">まだありません</li>';

    const rows = r.members.flatMap((m) => m.rows.map((row) => ({ ...row, name: m.member.name })))
      .sort((a, b) => (b.ascent.createdAt || 0) - (a.ascent.createdAt || 0));
    $('#log-count').textContent = `${rows.length}件`;
    $('#ascent-list').innerHTML = rows.length ? `<ul class="plain log">${rows.map((row) => {
      const a = row.ascent;
      const tags = [
        a.tr ? `<em class="tag">TR${row.counted ? '・完登数算入' : ''}</em>` : '',
        row.duplicate ? '<em class="tag ng">重複・無効</em>' : '',
        row.counted && !a.tr && row.rate < 1 ? '<em class="tag warn">25%</em>' : '',
      ].join('');
      const time = new Date(a.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      return `<li>
        <div><b>${esc(row.name)}</b> ${esc(a.route)} <span class="muted">${esc(a.grade)} / ${a.height}m / ${S.TYPE_LABEL[a.type]} / ${esc(a.area)} / ${time}</span> ${tags}</div>
        <div class="right"><span class="pts">${fmt(row.points)}</span><button class="icon" data-del="ascent:${esc(a.id)}" aria-label="削除">×</button></div>
      </li>`;
    }).join('')}</ul>` : '<p class="muted">まだ記録がありません</p>';

    renderPreview();
  }
  $('#team-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-team]');
    if (!b) return;
    ui.team = b.dataset.team;
    saveUI();
    render();
  });

  // ---- 集計タブ ------------------------------------------------------------
  function renderScore(results) {
    const ranked = [...results].sort((a, b) => a.rank - b.rank);
    $('#ranking').innerHTML = `<caption class="muted">最終得点 = (チーム得点 ÷ チーム人数) × 3 + 遅刻ペナルティ</caption>
      <thead><tr><th>順位</th><th>チーム</th><th>ルート</th><th>エリア</th><th>MP</th><th>チーム得点</th><th>人数</th><th>÷人数×3</th><th>遅刻</th><th>最終得点</th></tr></thead>
      <tbody>${ranked.map((r) => `<tr>
        <td>${r.rank}</td><td>${esc(r.team.name)}</td><td>${fmt(r.routeTotal)}</td><td>${fmt(r.areaTotal)}</td>
        <td>${fmt(r.mpBonus)}</td><td>${fmt(r.rawTotal)}</td><td>${r.teamSize}</td><td>${fmt(r.adjusted)}</td>
        <td>${r.penalty ? fmt(r.penalty) : '0'}</td><td class="total">${fmt(r.total)}</td></tr>`).join('')}</tbody>`;

    $('#team-details').innerHTML = ranked.map((r) => {
      const areaList = r.areaList.filter((a) => a.name !== OTHER_AREA);
      const unknown = areaList.filter((a) => !a.known);
      return `<div class="card">
        <h2>${r.rank}位 チーム${esc(r.team.name)} <span class="pts">${fmt(r.total)}点</span></h2>
        <p class="muted">最少完登数 <b>${r.minCount}</b> 本まで100%、超過分は25%</p>
        <div class="scroll"><table>
          <thead><tr><th>メンバー</th><th>OS (S/T)</th><th>完登数</th><th>100%分</th><th>25%分</th><th>計</th></tr></thead>
          <tbody>${r.members.map((m) => `<tr>
            <td>${esc(m.member.name)}</td>
            <td class="muted">${S.memberOS(m.member, 'sport')} / ${S.memberOS(m.member, 'trad')}</td>
            <td>${m.count}</td><td>${fmt(m.full)}</td><td>${fmt(m.reduced)}</td><td class="total">${fmt(m.points)}</td></tr>`).join('')}</tbody>
        </table></div>
        <dl class="breakdown">
          <dt>エリア</dt><dd>${areaList.length ? areaList.map((a) => `${esc(a.name)} ${a.points}`).join('、') : 'なし'}（${fmt(r.areaTotal)}）</dd>
          <dt>マルチピッチ</dt><dd>${r.mpBest ? `${esc(r.mpBest.route)} ${r.mpBest.pitches}P（+${r.mpBonus}）` : 'なし'}</dd>
          <dt>人数補正</dt><dd>${fmt(r.rawTotal)} ÷ ${r.teamSize}人 × 3 = ${fmt(r.adjusted)}</dd>
          <dt>到着</dt><dd>${r.team.arrival ? `${esc(r.team.arrival)}${r.penalty ? `（${r.lateMinutes}分遅れ ${r.penalty}）` : '（時間内）'}` : '未入力'}</dd>
        </dl>
        ${unknown.length ? `<p class="ng">設定にないエリア名があります（0点扱い）：${unknown.map((a) => esc(a.name)).join('、')}</p>` : ''}
      </div>`;
    }).join('');
  }

  // ---- 設定タブ ------------------------------------------------------------
  function renderSettings() {
    $('#end-time').value = state.endTime;
    $('#member-settings').innerHTML = state.teams.map((t) => `
      <h3>チーム${esc(t.name)} <small class="muted">${t.members.length}人</small></h3>
      <div class="scroll"><table class="form-table">
        <thead><tr><th>名前</th><th>スポートRP</th><th>トラッドRP</th><th>想定OS</th><th></th></tr></thead>
        <tbody>${t.members.map((m) => `<tr data-member="${esc(t.id)}:${esc(m.id)}">
          <td><input data-field="name" value="${esc(m.name)}"></td>
          <td><select data-field="sportRP">${gradeOptions(m.sportRP, false)}</select></td>
          <td><select data-field="tradRP">${gradeOptions(m.tradRP, true)}</select></td>
          <td class="muted">${S.memberOS(m, 'sport')} / ${S.memberOS(m, 'trad')}</td>
          <td><button type="button" class="icon" data-del="member:${esc(t.id)}:${esc(m.id)}" aria-label="メンバーを外す">×</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <button type="button" data-add-member="${esc(t.id)}">＋ チーム${esc(t.name)}にメンバーを追加</button>`).join('');

    $('#area-settings').innerHTML = state.areas.length ? `<ul class="plain">${state.areas.map((a, i) => `
      <li data-area="${i}"><input data-field="name" value="${esc(a.name)}"><input data-field="points" type="number" inputmode="numeric" value="${esc(a.points)}" class="num">
      <button class="icon" data-del="area:${i}" aria-label="削除">×</button></li>`).join('')}</ul>` : '<p class="muted">エリアが未設定です</p>';
  }

  $('#end-time').addEventListener('change', (e) => { state.endTime = e.target.value || '16:00'; commit(); });

  $('#member-settings').addEventListener('change', (e) => {
    const row = e.target.closest('[data-member]');
    if (!row) return;
    const [tid, mid] = row.dataset.member.split(':');
    const m = state.teams.find((t) => t.id === tid).members.find((x) => x.id === mid);
    m[e.target.dataset.field] = e.target.value.trim();
    commit();
  });

  $('#member-settings').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add-member]');
    if (!b) return;
    const t = state.teams.find((x) => x.id === b.dataset.addMember);
    t.members.push(member(uid(), '', '5.8', ''));
    commit();
    const inputs = $('#member-settings').querySelectorAll(`[data-member^="${CSS.escape(t.id)}:"] input[data-field="name"]`);
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $('#area-settings').addEventListener('change', (e) => {
    const row = e.target.closest('[data-area]');
    if (!row) return;
    const a = state.areas[Number(row.dataset.area)];
    a[e.target.dataset.field] = e.target.dataset.field === 'points' ? Number(e.target.value) || 0 : e.target.value.trim();
    commit();
  });

  $('#area-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.areas.push({ name: e.target.elements.namedItem('name').value.trim(), points: Number(e.target.points.value) || 0 });
    e.target.reset();
    commit();
  });

  // ---- データ入出力 --------------------------------------------------------
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

  $('#export-json').addEventListener('click', () =>
    download(`rock-marathon-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json'));

  $('#export-csv').addEventListener('click', () => {
    const results = S.scoreAll(state);
    const head = ['チーム', 'メンバー', 'ルート', 'エリア', 'グレード', '高さ', 'タイプ', 'TR', '相対', '絶対', 'ルート得点', '計上率', '計上点', '重複', '記録時刻'];
    const lines = results.flatMap((r) => r.members.flatMap((m) => m.rows.map((row) => {
      const a = row.ascent;
      return [r.team.name, m.member.name, a.route, a.area, a.grade, a.height, S.TYPE_LABEL[a.type], a.tr ? 'TR' : '',
        row.relative, row.absolute, row.total, row.counted ? row.rate : 0, row.points, row.duplicate ? '重複' : '',
        new Date(a.createdAt).toLocaleString('ja-JP')];
    })));
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(`rock-marathon-${stamp()}.csv`, '﻿' + csv, 'text/csv');
  });

  // 読み込み: 記録は id で統合、設定（メンバー・エリア・終了時刻）は読み込んだ内容で上書き
  $('#import-json').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.teams) || !Array.isArray(data.ascents)) throw new Error('形式が違います');
      const ids = new Set(state.ascents.map((a) => a.id));
      const added = data.ascents.filter((a) => !ids.has(a.id));
      const teams = data.teams.map((t) => {
        const local = state.teams.find((x) => x.id === t.id);
        const mpIds = new Set((t.multipitch || []).map((x) => x.id));
        return {
          ...t,
          arrival: t.arrival || (local && local.arrival) || '',
          multipitch: [...(t.multipitch || []), ...((local && local.multipitch) || []).filter((x) => !mpIds.has(x.id))],
        };
      });
      state = { ...state, endTime: data.endTime || state.endTime, teams, areas: data.areas || state.areas, ascents: [...state.ascents, ...added] };
      commit();
      toast(`読み込みました（記録 ${added.length} 件追加）`);
    } catch (err) {
      toast(`読み込めませんでした：${err.message}`);
    }
  });

  $('#reset').addEventListener('click', () => {
    if (!confirm('すべての記録と設定を初期状態に戻します。よろしいですか？\n（必要なら先にJSONを書き出してください）')) return;
    state = DEFAULT_STATE();
    commit();
    toast('初期化しました');
  });

  // ---- 描画 ----------------------------------------------------------------
  function render() {
    const results = S.scoreAll(state);
    if (ui.tab === 'log') renderLog(results);
    if (ui.tab === 'score') renderScore(results);
    if (ui.tab === 'settings') renderSettings();
  }

  renderTabs();
  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
