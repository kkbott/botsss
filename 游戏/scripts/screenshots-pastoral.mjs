import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Captures the v3 Chinese-pastoral / recruit evidence.
 *
 * The "before" images are captured separately from the pre-change commit
 * 8d6bd76 (main after PR #8); this script only captures the current build.
 * Run `npm run build` first, then `npm run screenshots:pastoral`.
 */
const root = process.cwd();
const port = Number(process.env.SHOT_PORT || 4178);
const baseUrl = `http://localhost:${port}`;
const out = path.join(root, 'docs/screenshots');
const errors = [];
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

async function open(browser, viewport, url = `${baseUrl}/?debug=1`, mobile = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => (window.__fieldguard && document.getElementById('loading-screen').hidden) || window.__whiteboxGallery?.ready,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(700);
  return { context, page };
}

async function startVersus(page) {
  await page.locator('#btn-versus').click();
  await page.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
}

async function setupFarm(page) {
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
    api.addGuardianCard('fieldhand');
    api.addGuardianCard('mason');
    api.addGuardianCard('bowman');
    const cards = api.getState().recruits.bench;
    const ids = cards.map((card) => card.id);
    const byId = (id) => cards.find((card) => card.id === id)?.uid;
    if (byId('fieldhand')) api.placeGuardian(13, byId('fieldhand'));
    if (byId('mason')) api.placeGuardian(7, byId('mason'));
    if (byId('bowman')) api.placeGuardian(17, byId('bowman'));
    // Leave a full random-looking bench visible for the recruitment bar.
    api.addGuardianCard('herbalist');
    api.addGuardianCard('ricespirit');
    api.addGuardianCard('bowman');
    api.teleport(8.4, 2.9);
    api.setLook(1.12, -0.1);
    void ids;
  });
  await page.waitForTimeout(5200);
}

try {
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
    throw new Error('dist/ is missing — run npm run build first');
  }
  fs.mkdirSync(out, { recursive: true });
  server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
  await waitForServer();

  const browser = await chromium.launch({
    headless: true,
    args: process.platform === 'darwin' ? ['--use-angle=metal'] : [],
  });

  // 1. Menu.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await page.screenshot({ path: path.join(out, 'after-pastoral-menu.png') });
    await context.close();
  }

  // 2. Pastoral gameplay with guardians, recruit bar, house, fields.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await setupFarm(page);
    await page.screenshot({ path: path.join(out, 'after-pastoral-gameplay.png') });
    await context.close();
  }

  // 3. Recruit draw: three random cards and the next cost.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await page.evaluate(() => {
      window.__fieldguard.hold();
      window.__fieldguard.addGold(900);
    });
    await page.locator('#btn-recruit').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, 'after-pastoral-recruit.png') });
    await context.close();
  }

  // 4. Guardian inspector and merge action.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await setupFarm(page);
    await page.evaluate(() => {
      window.__fieldguard.facePlot(13, 2.6);
      window.__fieldguard.setLook(-0.32, -0.08);
      window.__fieldguard.selectGuardianAt(13);
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, 'after-pastoral-guardian.png') });
    await context.close();
  }

  // 5. Terraced rice paddies.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await page.evaluate(() => {
      window.__fieldguard.hold();
      window.__fieldguard.setCamera([12, 11, 18], [16.5, 1.3, 1.6]);
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, 'after-pastoral-terrace.png') });
    await context.close();
  }

  // 6. Mobile recruit bar and HUD.
  {
    const { context, page } = await open(browser, { width: 390, height: 844 }, `${baseUrl}/?debug=1`, true);
    await page.locator('#btn-start').tap();
    await page.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
    await page.evaluate(() => {
      window.__fieldguard.hold();
      window.__fieldguard.addGold(500);
      window.__fieldguard.teleport(8.4, 2.9);
      window.__fieldguard.setLook(1.12, -0.1);
    });
    await page.waitForTimeout(500);
    await page.locator('#btn-recruit').tap();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(out, 'after-pastoral-mobile.png') });
    await context.close();
  }

  // 7. White-box contact sheets.
  const sheets = [
    ['whitebox-overview', '?gallery=1', { width: 1600, height: 1200 }],
    ['whitebox-environment', '?gallery=1&category=environment', { width: 1600, height: 1100 }],
    ['whitebox-tower', '?gallery=1&category=tower', { width: 1600, height: 1000 }],
    ['whitebox-guardian', '?gallery=1&category=guardian', { width: 1600, height: 1000 }],
    ['whitebox-crop', '?gallery=1&category=crop', { width: 1600, height: 1000 }],
    ['whitebox-enemy', '?gallery=1&category=enemy', { width: 1600, height: 1000 }],
    ['whitebox-player', '?gallery=1&category=player', { width: 1600, height: 1000 }],
  ];
  for (const [name, query, viewport] of sheets) {
    const { context, page } = await open(browser, viewport, `${baseUrl}/${query}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    await context.close();
  }

  if (errors.length > 0) {
    console.warn(`[screenshots] ${errors.length} console error(s)`, [...new Set(errors)].slice(0, 8));
  }
  console.log(`Wrote ${sheets.length + 6} screenshots to docs/screenshots/`);
  await browser.close();
} finally {
  if (server) server.kill('SIGTERM');
}
