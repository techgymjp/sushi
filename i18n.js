// 言語設定（ja / en）
window.SushiLang = (() => {
  'use strict';
  const KEY = 'sushi-lang';
  const ok = l => l === 'ja' || l === 'en';
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(l) { try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ } }
  function browser() { return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en'; }

  // ページ固有の言語（<html data-page-lang="en">）があればそれを優先
  const pageLang = document.documentElement.getAttribute('data-page-lang');
  const q = new URLSearchParams(location.search).get('lang');
  let lang;
  if (ok(pageLang)) lang = pageLang;
  else if (ok(q)) lang = q;
  else lang = ok(saved()) ? saved() : browser();
  if (ok(q) || ok(pageLang)) save(lang);
  document.documentElement.lang = lang;

  return { lang, save, saved, browser, isEn: lang === 'en' };
})();
