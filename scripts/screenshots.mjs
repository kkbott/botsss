import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Captures the "after" half of the visual before/after evidence.
 *
 * Both sets are 1440 × 900 captures of the same scenario:
 *   8 planted plots, 3 towers (arrow Lv.2 / cannon / arrow), wave 2 active,
 *   20 lives, and the same fixed camera. The "before" set lives in the
 *   baseline commit docs/screenshots/before-*.png.
 */
const root = process.cwd();
const port = 4174;
const baseUrl = `http://localhost:${port}`;
let server = null;

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

try {
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
    throw new Error('dist/ is missing — run npm run build first');
  }
  server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
  await waitForServer();

  const browser = await chromium.launch({
    headless: true,
    args: process.platform === 'darwin' ? ['--use-angle=metal'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => window.__fieldguard && document.getElementById('loading-screen').hidden,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(800);
  await page.mouse.move(120, 120);
  await page.screenshot({ path: path.join(root, 'docs/screenshots/after-menu.png') });

  await page.evaluate(() => window.__fieldguard.start());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__fieldguard.addGold(300);
    window.__fieldguard.addStar(5);
  });
  for (const [index, type] of [
    [0, 'wheat'],
    [1, 'wheat'],
    [2, 'wheat'],
    [3, 'pumpkin'],
    [4, 'pumpkin'],
    [5, 'flower'],
  ]) {
    await page.evaluate(({ index, type }) => window.__fieldguard.plant(index, type), { index, type });
  }
  for (const index of [6, 7]) {
    const point = await page.evaluate((i) => window.__fieldguard.screenPoint('plot', i), index);
    await page.mouse.click(point.x, point.y);
    await page.evaluate((i) => window.__fieldguard.plant(i, 'wheat'), index);
  }
  for (const [pad, type] of [
    [1, 'arrow'],
    [2, 'cannon'],
    [4, 'arrow'],
  ]) {
    await page.evaluate(({ pad, type }) => window.__fieldguard.build(pad, type), { pad, type });
  }
  await page.evaluate(() => window.__fieldguard.upgrade(1));
  await page.evaluate(() => window.__fieldguard.simulate(10));
  await page.evaluate(() => window.__fieldguard.nextWave());
  for (let i = 0; i < 8; i++) {
    const state = await page.evaluate(() => window.__fieldguard.getState());
    if (state.wavePhase === 'prep' || state.phase !== 'playing') break;
    await page.evaluate(() => window.__fieldguard.simulate(8));
  }
  await page.evaluate(() => window.__fieldguard.nextWave());
  await page.evaluate(() => window.__fieldguard.simulate(6));
  await page.evaluate(() => {
    window.__fieldguard.closeInspector();
    window.__fieldguard.hold();
  });
  await page.mouse.move(120, 120);
  await page.waitForTimeout(5200);
  await page.screenshot({ path: path.join(root, 'docs/screenshots/after-gameplay.png') });
  const finalState = await page.evaluate(() => {
    const state = window.__fieldguard.getState();
    return {
      wave: state.wave,
      wavePhase: state.wavePhase,
      gold: state.gold,
      star: state.star,
      lives: state.lives,
      towers: state.towers,
      stats: state.stats,
    };
  });
  const metrics = await page.evaluate(() => window.__fieldguard.metrics());
  console.log(JSON.stringify({ finalState, metrics, errors }, null, 2));
  await browser.close();
} finally {
  server?.kill('SIGTERM');
}
