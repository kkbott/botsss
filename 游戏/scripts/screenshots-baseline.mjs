import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Captures the "before" half of the v3 before/after pair from the pre-change
 * commit 8d6bd76 (main after PR #8). Run it from a worktree at that commit:
 *
 *   git worktree add --detach /tmp/botsss-baseline 8d6bd76
 *   ln -s /path/to/游戏/node_modules /tmp/botsss-baseline/游戏/node_modules
 *   cd /tmp/botsss-baseline/游戏 && npm run build
 *   OUT_DIR=/path/to/游戏/docs/screenshots node scripts/screenshots-baseline.mjs
 *
 * The script intentionally uses only the pre-v3 debug API, so it runs on the
 * baseline build.
 */
const root = process.cwd();
const port = Number(process.env.SHOT_PORT || 4180);
const baseUrl = `http://localhost:${port}`;
const out = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(root, 'docs/screenshots');

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('preview server did not start');
}

let server = null;
try {
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('build the baseline first');
  fs.mkdirSync(out, { recursive: true });
  server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
  await waitForServer();
  const browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => window.__fieldguard && document.getElementById('loading-screen').hidden,
    null,
    { timeout: 90000 },
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'before-pastoral-menu.png') });
  await page.locator('#btn-versus').click();
  await page.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
  await page.evaluate(() => {
    const api = window.__fieldguard;
    api.hold();
    api.addGold(1600);
    api.addStar(12);
    for (const index of [18, 19, 20, 21, 13, 14, 22, 23]) {
      api.reclaim(index);
      api.simulate(1.7);
    }
    for (const [index, type] of [
      [18, 'wheat'],
      [19, 'wheat'],
      [20, 'pumpkin'],
      [21, 'flower'],
      [22, 'wheat'],
      [23, 'wheat'],
    ]) api.plant(index, type);
    for (const [index, type] of [
      [0, 'arrow'],
      [1, 'arrow'],
      [5, 'cannon'],
      [6, 'arrow'],
      [12, 'arrow'],
    ]) api.build(index, type);
    api.teleport(8.4, 2.9);
    api.setLook(1.12, -0.1);
  });
  await page.waitForTimeout(5200);
  await page.screenshot({ path: path.join(out, 'before-pastoral-gameplay.png') });
  if (errors.length > 0) console.warn(`[baseline] ${errors.length} console error(s)`, errors.slice(0, 5));
  await browser.close();
  console.log('Wrote before-pastoral-menu.png and before-pastoral-gameplay.png');
} finally {
  if (server) server.kill('SIGTERM');
}
