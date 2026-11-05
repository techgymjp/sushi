// ランキング（このブラウザに保存）
window.SushiRanking = (() => {
  'use strict';
  const KEY = 'sushi-ranking-v1';
  const NAME_KEY = 'sushi-name';
  const MAX = 10;

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
      name: (rec.name || '').trim().slice(0, 10) || '名無しの板前',
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
    return score >= 15000 ? '伝説の大将' : score >= 10000 ? '大将' : score >= 6000 ? '板前' : score >= 2500 ? '一人前' : '見習い';
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
      p.textContent = 'まだ記録がありません。最初の大将になろう！';
      container.appendChild(p);
      return;
    }
    const table = document.createElement('table');
    table.className = 'ranking' + (full ? ' full' : '');
    const head = full ? ['順位', 'なまえ', '売上', '提供', '最大コンボ', '称号', '日付'] : ['順位', 'なまえ', '売上'];
    const thead = table.createTHead().insertRow();
    head.forEach(h => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
    const tb = table.createTBody();
    list.forEach((r, i) => {
      const tr = tb.insertRow();
      if (r.id === highlight) tr.className = 'me';
      const medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
      const cells = full
        ? [medal, r.name, r.score.toLocaleString() + '点', r.served + '皿', r.combo, title(r.score), fmtDate(r.date)]
        : [medal, r.name, r.score.toLocaleString() + '点'];
      cells.forEach((c, j) => { const td = tr.insertCell(); td.textContent = c; if (j === 0) td.className = 'place'; });
    });
    container.appendChild(table);
  }

  return { load, add, placeOf, lastName, best, clear, title, render, MAX };
})();
