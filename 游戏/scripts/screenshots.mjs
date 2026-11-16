import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Captures the "after" half of the visual before/after evidence.
 *
 * All captures are 1440 × 900 (the mobile captures are 390 × 844) of the
 * production build. The baseline screenshots, before-main-menu.png and
 * before-main-gameplay.png, come from `origin/main` at commit 8bc88c2, which
 * still had the orbit camera, 12 fixed plots and 7 fixed tower pads.
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
    window.__fieldguard.addGold(700);
    window.__fieldguard.addStar(8);
  });
  // Clear the south row plus the two inner rows behind it so the field reads as
  // a working farm while the far corners stay as tower bases.
  for (const index of [18, 19, 20, 21, 22, 23, 13, 14, 15, 16]) {
    await page.evaluate((plot) => window.__fieldguard.reclaim(plot), index);
    await page.evaluate(() => window.__fieldguard.simulate(1.7));
  }
  for (const [index, type] of [
    [18, 'wheat'],
    [19, 'wheat'],
    [20, 'pumpkin'],
    [21, 'flower'],
    [22, 'wheat'],
    [23, 'wheat'],
    [13, 'wheat'],
    [14, 'wheat'],
    [15, 'pumpkin'],
    [16, 'flower'],
  ]) {
    await page.evaluate(({ index, type }) => window.__fieldguard.plant(index, type), { index, type });
  }
  await page.evaluate(() => {
    window.__fieldguard.build(0, 'arrow');
    window.__fieldguard.build(6, 'cannon');
    window.__fieldguard.upgrade(0);
  });
  await page.evaluate(() => window.__fieldguard.simulate(9));
  await page.evaluate(() => window.__fieldguard.nextWave());
  await page.evaluate(() => window.__fieldguard.simulate(8));
  await page.evaluate(() => {
    window.__fieldguard.teleport(8.4, 2.9);
    window.__fieldguard.setLook(1.12, -0.1);
    window.__fieldguard.closeInspector();
    window.__fieldguard.hold();
  });
  await page.waitForTimeout(3800);
  await page.mouse.move(120, 120);
  await page.screenshot({ path: path.join(root, 'docs/screenshots/after-gameplay.png') });

  // The same run from the switchable overview camera.
  await page.evaluate(() => {
    window.__fieldguard.setCamera([13.5, 13.5, 19.5], [-1.5, 0.3, 0.6]);
    window.__fieldguard.hold();
  });
  await page.waitForTimeout(700);
  await page.mouse.move(140, 140);
  await page.screenshot({ path: path.join(root, 'docs/screenshots/after-overview.png') });

  // Reclamation in progress: this is the visible process animation. Restart a
  // clean run and start clearing the plot beside the farmer.
  await page.evaluate(() => {
    window.__fieldguard.release();
    window.__fieldguard.start();
    window.__fieldguard.facePlot(23);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__fieldguard.interact());
  await page.evaluate(() => window.__fieldguard.simulate(0.8));
  await page.evaluate(() => window.__fieldguard.hold());
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(root, 'docs/screenshots/after-reclaim.png') });
  await page.waitForTimeout(500);
  await page.mouse.move(200, 200);
  await page.screenshot({ path: path.join(root, 'docs/screenshots/after-reclaim.png') });

  const finalState = await page.evaluate(() => {
    const state = window.__fieldguard.getState();
    return {
      mode: state.mode,
      wave: state.wave,
      wavePhase: state.wavePhase,
      gold: Math.round(state.gold),
      star: state.star,
      lives: state.lives,
      plots: state.plots.map((plot) => ({ index: plot.index, state: plot.state, crop: plot.crop?.type ?? null })),
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
