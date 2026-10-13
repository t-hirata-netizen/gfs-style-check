// 旧本番（gfs-style-check）は、新しい本番（gfs-kabu-shindan）へ移るだけのページ。実行: node --test
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const HTML=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const NEW="https://t-hirata-netizen.github.io/gfs-kabu-shindan/";

test("新しい本番へ移る（URL の ?… と #… も引き継ぐ）", ()=>{
  assert.ok(HTML.includes(`location.replace("${NEW}"+location.search+location.hash)`));
  assert.ok(HTML.includes(`<meta http-equiv="refresh" content="0; url=${NEW}">`));
  assert.ok(HTML.includes(`<link rel="canonical" href="${NEW}">`));
});

test("LINE などで古いURLを送っても、新しい本番の画像が出る", ()=>{
  assert.ok(HTML.includes(`<meta property="og:image" content="${NEW}og/default.png">`));
  assert.ok(HTML.includes(`<meta property="og:url" content="${NEW}">`));
});

test("検索結果に出さない・集計には送らない", ()=>{
  assert.ok(HTML.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.doesNotMatch(HTML,/script\.google\.com|score\.js/);
});
