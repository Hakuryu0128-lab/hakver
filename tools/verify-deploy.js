#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   verify-deploy.js — WEEKY v11 デプロイ前チェック

   目的：
   GitHub Pages への手動アップロード運用では、以下の3ファイルに
   バージョン文字列を人力で同じ値に揃える必要がある。
     - app.js            の  const APP_VERSION = '...'
     - index.html         の  styles.css?v=... / app.js?v=...
     - service-worker.js  の  CACHE_NAME = 'weeky-v...' /
                              ASSETS 内の styles.css?v=... / app.js?v=...
   このうちどれか1箇所でもズレると「アップデートが降りてこない」
   「更新したのに反映されない」という事故になる。実際に過去、
   このパターンで複数回ハマった（Notion Mistakes: M-2, M-16, M-21, M-23）。

   このスクリプトはアップロード前に必ず1回実行し、全部の値が
   一致していること・app.jsの構文が壊れていないことを機械的に確認する。

   使い方：
     cd C:\Users\Ryusei\Desktop\WEEKY\v11
     node tools/verify-deploy.js

   終了コード0＝全チェックOK、1＝どれか失敗（アップロードしないこと）。
════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const appJsPath = path.join(ROOT, 'app.js');
const indexHtmlPath = path.join(ROOT, 'index.html');
const swPath = path.join(ROOT, 'service-worker.js');

function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function bad(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }

let hasError = false;
function fail(msg) { bad(msg); hasError = true; }

for (const p of [appJsPath, indexHtmlPath, swPath]) {
  if (!fs.existsSync(p)) {
    console.error(`ファイルが見つかりません: ${p}`);
    process.exit(1);
  }
}

const appJs = fs.readFileSync(appJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

const appVersionMatch = appJs.match(/const APP_VERSION\s*=\s*'([\d.]+)'/);
if (!appVersionMatch) {
  console.error('app.js から APP_VERSION が読み取れませんでした。正規表現を確認してください。');
  process.exit(1);
}
const appVersion = appVersionMatch[1];

console.log(`\napp.js の APP_VERSION: \x1b[1m${appVersion}\x1b[0m\n`);
console.log('バージョン表記の一致チェック:');

const checks = [
  ['index.html の styles.css?v=',        indexHtml.match(/styles\.css\?v=([\d.]+)/)],
  ['index.html の app.js?v=',            indexHtml.match(/app\.js\?v=([\d.]+)/)],
  ['service-worker.js の CACHE_NAME',    sw.match(/CACHE_NAME\s*=\s*'weeky-v([\d.]+)'/)],
  ['service-worker.js の styles.css?v=', sw.match(/styles\.css\?v=([\d.]+)/)],
  ['service-worker.js の app.js?v=',     sw.match(/app\.js\?v=([\d.]+)/)],
];

for (const [label, m] of checks) {
  const v = m?.[1];
  if (v === undefined) {
    fail(`${label} — 見つかりません`);
  } else if (v !== appVersion) {
    fail(`${label} = ${v}  ← APP_VERSION(${appVersion}) と不一致`);
  } else {
    ok(`${label} = ${v}`);
  }
}

console.log('\napp.js 構文チェック (node --check):');
try {
  execSync(`node --check "${appJsPath}"`, { stdio: 'pipe' });
  ok('構文エラーなし');
} catch (e) {
  fail('構文エラーあり:\n' + (e.stderr ? e.stderr.toString() : e.message));
}

console.log('');
if (hasError) {
  console.log('\x1b[31m❌ 不一致・エラーがあります。修正してから再実行し、OKになるまでアップロードしないこと。\x1b[0m\n');
  process.exit(1);
} else {
  console.log(`\x1b[32m✅ 全チェックOK。v${appVersion} としてアップロードして問題ありません。\x1b[0m\n`);
  process.exit(0);
}
