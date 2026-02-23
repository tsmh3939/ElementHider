/**
 * ストレージ容量テスト用の大量データを生成するスクリプト。
 *
 * 使い方:
 *   node test-data/generate-large.js [目標サイズMB]
 *
 * 例:
 *   node test-data/generate-large.js 1     → 約 1 MB
 *   node test-data/generate-large.js 5     → 約 5 MB
 *   node test-data/generate-large.js 10    → 約 10 MB (chrome.storage.local 上限)
 *
 * デフォルト: 5 MB
 */

const fs = require("fs");
const path = require("path");

const targetMB = parseFloat(process.argv[2]) || 5;
const targetBytes = targetMB * 1024 * 1024;

const HIDE_MODES = ["hidden", "invisible"];
const TAGS = ["div", "section", "article", "aside", "nav", "span", "p", "ul", "li", "header", "footer"];
const CLASS_PREFIXES = ["ad", "banner", "popup", "overlay", "sidebar", "widget", "promo", "notice", "alert", "modal"];
const CLASS_SUFFIXES = ["container", "wrapper", "block", "inner", "content", "box", "panel", "card", "section", "area"];
const LABELS = [
  "広告バナー", "ポップアップ", "Cookie同意", "ニュースレター登録",
  "チャットウィジェット", "サイドバー広告", "フッターリンク", "通知バー",
  "モーダルオーバーレイ", "おすすめ商品", "SNSシェアボタン", "フローティングメニュー",
  "動画広告", "アンケートバナー", "プロモーションカード", "スポンサーリンク",
];
const TLDS = ["com", "org", "net", "io", "jp", "dev", "app", "co.jp", "me", "info"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHostname(index) {
  const words = ["example", "test", "demo", "sample", "mock", "fake", "staging", "dev", "local", "beta"];
  const sub = ["www", "app", "api", "blog", "news", "shop", "docs", "forum", "mail", "cdn"];
  const word = words[index % words.length];
  const suffix = Math.floor(index / words.length);
  const tld = randomItem(TLDS);
  const base = suffix > 0 ? `${word}${suffix}.${tld}` : `${word}.${tld}`;
  return randomInt(0, 1) ? `${randomItem(sub)}.${base}` : base;
}

function generateSelector(index) {
  const tag = randomItem(TAGS);
  const cls1 = randomItem(CLASS_PREFIXES);
  const cls2 = randomItem(CLASS_SUFFIXES);
  // セレクタのバリエーション
  const patterns = [
    `${tag}.${cls1}-${cls2}`,
    `#${cls1}-${index}`,
    `${tag}.${cls1}-${cls2}-${index}`,
    `${tag}[data-${cls1}="${index}"]`,
    `${tag}.${cls1}.${cls2}`,
  ];
  return patterns[index % patterns.length];
}

function generateElement(index) {
  const now = Date.now();
  return {
    selector: generateSelector(index),
    label: `${randomItem(LABELS)} #${index}`,
    timestamp: now - randomInt(0, 90 * 24 * 60 * 60 * 1000), // 過去90日以内
    isHidden: Math.random() > 0.2, // 80% は非表示
    hideMode: randomItem(HIDE_MODES),
  };
}

// --- メイン ---

const sites = {};
let siteIndex = 0;
let currentSize = 0;

// ヘッダー部分の概算サイズ
const headerSize = JSON.stringify({ version: "1.0.0", exportedAt: new Date().toISOString(), sites: {} }).length;
currentSize = headerSize;

while (currentSize < targetBytes) {
  const hostname = generateHostname(siteIndex);
  const elementCount = randomInt(1, 20);
  const elements = [];

  for (let i = 0; i < elementCount; i++) {
    elements.push(generateElement(siteIndex * 100 + i));
  }

  const siteData = {
    elements,
    lastVisited: Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
  };

  sites[hostname] = siteData;
  currentSize += JSON.stringify({ [hostname]: siteData }, null, 2).length;
  siteIndex++;
}

const exportData = {
  version: "1.0.0",
  exportedAt: new Date().toISOString(),
  sites,
};

const json = JSON.stringify(exportData, null, 2);
const actualMB = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);
const siteCount = Object.keys(sites).length;
const totalElements = Object.values(sites).reduce((sum, s) => sum + s.elements.length, 0);

const outputName = `import-large-${targetMB}mb.json`;
const outputPath = path.join(__dirname, outputName);
fs.writeFileSync(outputPath, json);

console.log(`Generated: ${outputName}`);
console.log(`  Size:     ${actualMB} MB`);
console.log(`  Sites:    ${siteCount}`);
console.log(`  Elements: ${totalElements}`);