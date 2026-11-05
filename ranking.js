// ランキング（このブラウザに保存）
window.SushiRanking = (() => {
  'use strict';
  const KEY = 'sushi-ranking-v1';
  const NAME_KEY = 'sushi-name';
  const MAX = 10;
  const EN = !!(window.SushiLang && window.SushiLang.isEn);
  const yen = n => EN ? '¥' + n.toLocaleString() : n.toLocaleString() + '円';

  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter(r => r && typeof r.score === 'number') : [];
    } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  const sort = list => list.sort((a, b) => b.score - a.score || a.date - b.date);

  // 何位に入るか（ランク外なら 0）
  function placeOf(score) {
    if (score <= 0) return 0;
    const list = load();
    const place = list.filter(r => r.score >= score).length + 1;
    return place <= MAX ? place : 0;
  }

  function add(rec) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: (rec.name || '').trim().slice(0, 10) || (EN ? 'Anonymous Chef' : '名無しの板前'),
      score: rec.score, served: rec.served || 0, combo: rec.combo || 0, date: Date.now(),
    };
    const list = sort([...load(), entry]).slice(0, MAX);
    save(list);
    try { localStorage.setItem(NAME_KEY, entry.name); } catch (e) { /* ignore */ }
    return entry;
  }

  function lastName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function best() { const l = load(); return l.length ? l[0].score : 0; }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function title(score) {
    const t = EN
      ? ['Legendary Master', 'Master Chef', 'Sushi Chef', 'Skilled Cook', 'Apprentice']
      : ['伝説の大将', '大将', '板前', '一人前', '見習い'];
    return score >= 15000 ? t[0] : score >= 10000 ? t[1] : score >= 6000 ? t[2] : score >= 2500 ? t[3] : t[4];
  }

  function fmtDate(t) {
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  // テーブルを描画（full=true で詳細列も表示）
  function render(container, { highlight = null, full = false } = {}) {
    const list = load();
    container.textContent = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'rank-empty';
      p.textContent = EN ? 'No records yet. Be the first master chef!' : 'まだ記録がありません。最初の大将になろう！';
      container.appendChild(p);
      return;
    }
    const table = document.createElement('table');
    table.className = 'ranking' + (full ? ' full' : '');
    const head = EN
      ? (full ? ['Rank', 'Name', 'Sales', 'Served', 'Max combo', 'Title', 'Date'] : ['Rank', 'Name', 'Sales'])
      : (full ? ['順位', 'なまえ', '売上', '提供', '最大コンボ', '称号', '日付'] : ['順位', 'なまえ', '売上']);
    const thead = table.createTHead().insertRow();
    head.forEach(h => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
    const tb = table.createTBody();
    list.forEach((r, i) => {
      const tr = tb.insertRow();
      if (r.id === highlight) tr.className = 'me';
      const medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
      const cells = full
        ? [medal, r.name, yen(r.score), EN ? r.served : r.served + '皿', r.combo, title(r.score), fmtDate(r.date)]
        : [medal, r.name, yen(r.score)];
      cells.forEach((c, j) => { const td = tr.insertCell(); td.textContent = c; if (j === 0) td.className = 'place'; });
    });
    container.appendChild(table);
  }

  return { load, add, placeOf, lastName, best, clear, title, render, MAX };
})();
