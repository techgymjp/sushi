// Android アプリに同梱する Web ファイルを www/ にコピーする
// アプリではゲーム画面（game.html）をそのまま index.html として使う
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['style.css', 'game.js', 'ranking.js', 'i18n.js', 'ads.js']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
// Web 版だけの部分（Google Play へのリンクなど）は、<!-- web-only --> … <!-- /web-only --> で囲んである。
// アプリには入れない（審査で「隠した機能」と見なされないよう、表示しないだけでなく中身ごと取り除く）
const html = fs.readFileSync(path.join(root, 'game.html'), 'utf8')
  .replace(/[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->\n?/g, '');
fs.writeFileSync(path.join(out, 'index.html'), html);
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
// 他社ストアへのリンクが残っていたらビルドを止める
for (const f of fs.readdirSync(out)) {
  const text = fs.readFileSync(path.join(out, f), 'utf8');
  if (/play\.google\.com|apps\.apple\.com/.test(text)) throw new Error(`store link left in www/${f}`);
}
console.log(`built web assets into www/ (ads: ${mode}, version: ${version})`);
