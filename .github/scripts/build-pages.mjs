#!/usr/bin/env node
/**
 * 把「网站/」和「游戏/dist/」组装成可直接发布的 _site/：
 *
 *   _site/index.html       ← 网站/ 的内容（个人站，位于 Pages 根路径）
 *   _site/game/index.html  ← 游戏构建（位于 /game/ 子路径）
 *
 * 用法（先构建游戏）：
 *   cd 游戏 && npm run build && cd ..
 *   node .github/scripts/build-pages.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(process.cwd());
const siteDir = join(root, '网站');
const gameDist = join(root, '游戏', 'dist');
const outDir = join(root, '_site');

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

const problems = [];

const required = [
  [siteDir, '网站/ 不存在'],
  [join(siteDir, 'index.html'), '网站/index.html 不存在'],
  [join(siteDir, 'content.js'), '网站/content.js 不存在'],
  [join(siteDir, 'app.js'), '网站/app.js 不存在'],
  [join(siteDir, 'styles.css'), '网站/styles.css 不存在'],
  [gameDist, '游戏/dist/ 不存在，请先在 游戏/ 里运行 npm run build'],
  [join(gameDist, 'index.html'), '游戏构建缺少 index.html'],
];
for (const [path, message] of required) {
  if (!existsSync(path)) fail(message);
}

// ── 校验并读取网站内容 ────────────────────────────────────
const contentSource = readFileSync(join(siteDir, 'content.js'), 'utf8');

for (const [filename, source] of [
  ['网站/content.js', contentSource],
  ['网站/app.js', readFileSync(join(siteDir, 'app.js'), 'utf8')],
]) {
  try {
    new vm.Script(source, { filename });
  } catch (error) {
    problems.push(`${filename} 有语法错误：${error.message}（常见原因是少了引号或逗号）`);
  }
}

let siteContent = null;
try {
  const sandbox = { window: {} };
  vm.runInNewContext(contentSource, sandbox, { filename: '网站/content.js', timeout: 1000 });
  siteContent = sandbox.window.SITE_CONTENT;
} catch (error) {
  problems.push(`网站/content.js 无法读取：${error.message}`);
}

if (siteContent && typeof siteContent === 'object') {
  if (!String(siteContent.name || '').trim()) problems.push('content.js 缺少 name（名字）');
  if (!Array.isArray(siteContent.works)) problems.push('content.js 的 works 应该是数组');
} else if (!problems.some((problem) => problem.startsWith('网站/content.js'))) {
  problems.push('网站/content.js 没有设置 window.SITE_CONTENT');
}

if (problems.length) fail(`发布前检查失败：\n  - ${problems.join('\n  - ')}`);

// ── 组装 _site/ ───────────────────────────────────────────
// 「网站/」里以下内容只属于仓库，不发布到线上
const siteExclusions = new Set(['README.md', 'docs']);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const entry of readdirSync(siteDir, { withFileTypes: true })) {
  if (siteExclusions.has(entry.name)) continue;
  cpSync(join(siteDir, entry.name), join(outDir, entry.name), { recursive: true });
}

mkdirSync(join(outDir, 'game'), { recursive: true });
cpSync(gameDist, join(outDir, 'game'), { recursive: true });

// ── 把 content.js 里的姓名与简介注入静态 HTML 的 meta ─────
// 这样不执行 JavaScript 的爬虫 / 分享预览也能读到真实文案。
{
  const htmlEscapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const htmlEsc = (value) => String(value).replace(/[&<>"']/g, (character) => htmlEscapes[character]);
  const name = String(siteContent.name || '').trim() || '个人作品集';
  const tagline = String(siteContent.tagline || '').trim() || '个人作品集：游戏、网页与交互作品。';
  const title = `${name} · 个人作品集`;
  const indexPath = join(outDir, 'index.html');
  let html = readFileSync(indexPath, 'utf8');

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlEsc(title)}</title>`);
  for (const [pattern, value] of [
    [/(<meta name="description" content=")[^"]*(")/, htmlEsc(tagline)],
    [/(<meta property="og:title" content=")[^"]*(")/, htmlEsc(title)],
    [/(<meta property="og:description" content=")[^"]*(")/, htmlEsc(tagline)],
    [/(<meta property="og:site_name" content=")[^"]*(")/, htmlEsc(name)],
    [/(<meta name="twitter:title" content=")[^"]*(")/, htmlEsc(title)],
    [/(<meta name="twitter:description" content=")[^"]*(")/, htmlEsc(tagline)],
  ]) {
    html = html.replace(pattern, `$1${value}$2`);
  }
  writeFileSync(indexPath, html, 'utf8');
}

// ── 发布前的静态检查 ──────────────────────────────────────
for (const path of [
  join(outDir, 'index.html'),
  join(outDir, 'game', 'index.html'),
  join(outDir, 'content.js'),
  join(outDir, 'app.js'),
  join(outDir, 'styles.css'),
  join(outDir, 'assets', 'favicon.svg'),
]) {
  if (!existsSync(path)) problems.push(`缺少 ${relative(outDir, path)}`);
}

const siteHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
const localRefs = [...siteHtml.matchAll(/\b(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((href) => href && !/^(?:[a-z]+:|#|\/\/)/i.test(href));

for (const href of localRefs) {
  const clean = href.split(/[?#]/)[0];
  if (!clean || clean.endsWith('/')) continue; // 例如 game/，另外检查
  if (!existsSync(join(outDir, clean))) problems.push(`index.html 引用的 ${href} 不存在`);
}

const assetRefs = [...contentSource.matchAll(/["'](assets\/[^"']+)["']/g)].map((match) => match[1]);
for (const asset of new Set(assetRefs)) {
  if (!existsSync(join(outDir, asset))) problems.push(`content.js 引用的 ${asset} 不存在`);
}

const gameHtml = readFileSync(join(outDir, 'game', 'index.html'), 'utf8');
if (!/<script[^>]+src="\.?\/?assets\//.test(gameHtml)) {
  problems.push('游戏 index.html 没有引用相对路径的构建资源');
}

if (problems.length) fail(`发布前检查失败：\n  - ${problems.join('\n  - ')}`);

// ── 完成 ──────────────────────────────────────────────────
const files = readdirSync(outDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
const bytes = files.reduce((total, entry) => total + statSync(join(entry.parentPath ?? entry.path, entry.name)).size, 0);

console.log(`✓ 页面已组装到 _site/（${files.length} 个文件，${(bytes / 1024 / 1024).toFixed(2)} MB）`);
console.log('  站点：/');
console.log('  游戏：/game/');

const placeholders = [];
if (String(siteContent.name || '').includes('你的名字')) placeholders.push('姓名');
if (String(siteContent.tagline || '').includes('一句话介绍')) placeholders.push('一句话简介');
if (String(siteContent.contact?.email || '').includes('example.com')) placeholders.push('邮箱');
if (placeholders.length) {
  console.log(`  ! 当前仍是占位文案：${placeholders.join('、')}；上线后可在 网站/content.js 中替换。`);
}
