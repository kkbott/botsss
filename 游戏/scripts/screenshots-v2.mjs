import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Captures the "after" half of the v2 before/after evidence.
 *
 * The "before" images (before-v2-*.png) were captured from the PR #6 baseline
 * commit 8e3129f in an isolated worktree; this script only captures the current
 * production build. All desktop captures are 1440 × 900; mobile captures use a
 * 390 × 844 CSS viewport at deviceScaleFactor 2.
 */
const root = process.cwd();
const port = 4177;
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

async function open(browser, viewport, { mobile = false } = {}) {
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
  await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => window.__fieldguard && document.getElementById('loading-screen').hidden,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(800);
  return { context, page };
}

async function startVersus(page, mobile = false) {
  const button = page.locator('#btn-versus');
  if (mobile) await button.tap();
  else await button.click();
  await page.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
}

async function autoFinish(page) {
  for (let i = 0; i < 1200; i++) {
    const state = await page.evaluate(() => window.__fieldguard.getState());
    if (state.phase === 'victory' || state.phase === 'defeat') return state;
    if (state.phase === 'blessing') {
      await page.evaluate((id) => window.__fieldguard.chooseBlessing(id), state.blessingOffers[0].id);
      continue;
    }
    if (state.phase === 'shop') {
      const offer = state.shopOffers.find((entry) => !entry.sold && entry.price <= state.gold);
      if (offer) await page.evaluate((id) => window.__fieldguard.buyShopItem(id), offer.id);
      await page.evaluate(() => window.__fieldguard.closeShop());
      continue;
    }
    await page.evaluate(() => window.__fieldguard.simulate(2));
  }
  return page.evaluate(() => window.__fieldguard.getState());
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
    await page.mouse.move(120, 120);
    await page.screenshot({ path: path.join(out, 'after-v2-menu.png') });
    await context.close();
  }

  // 2. Versus gameplay: one blessing taken, wave 2 underway.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await page.evaluate(() => {
      const api = window.__fieldguard;
      api.addGold(900);
      api.addStar(12);
      api.hold();
      for (const i of [18, 19, 20, 21, 13, 14]) {
        api.reclaim(i);
        api.simulate(1.7);
      }
      for (const [i, t] of [[18, 'wheat'], [19, 'wheat'], [20, 'pumpkin'], [21, 'flower'], [13, 'wheat'], [14, 'wheat']]) {
        api.plant(i, t);
      }
      for (const i of [0, 1, 2, 3, 5, 6, 12]) api.build(i, i === 5 ? 'cannon' : 'arrow');
      api.merge(0);
      api.merge(2);
      api.closeInspector();
      api.release();
      api.nextWave();
      api.simulate(95);
    });
    let state = await page.evaluate(() => window.__fieldguard.getState());
    if (state.phase === 'blessing') {
      const pick = state.blessingOffers.find((offer) => offer.id === 'harvest') || state.blessingOffers[0];
      await page.evaluate((id) => window.__fieldguard.chooseBlessing(id), pick.id);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => {
      const api = window.__fieldguard;
      api.nextWave();
      api.simulate(8);
      api.teleport(8.4, 2.9);
      api.setLook(1.12, -0.1);
      api.closeInspector();
      api.hold();
    });
    await page.waitForTimeout(4600);
    await page.mouse.move(120, 120);
    await page.screenshot({ path: path.join(out, 'after-v2-gameplay.png') });
    await context.close();
  }

  // 3. Blessing modal and 4. shop modal from the same run.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await page.evaluate(() => {
      const api = window.__fieldguard;
      api.addGold(1200);
      api.addStar(12);
      api.hold();
      for (const i of [18, 19, 20, 21, 13, 14]) {
        api.reclaim(i);
        api.simulate(1.7);
      }
      for (const [i, t] of [[18, 'wheat'], [19, 'wheat'], [20, 'pumpkin'], [21, 'flower'], [13, 'wheat'], [14, 'wheat']]) {
        api.plant(i, t);
      }
      for (const i of [0, 2, 5, 6, 12, 13]) api.build(i, i === 5 ? 'cannon' : 'arrow');
      api.teleport(8.4, 2.9);
      api.setLook(1.12, -0.1);
      api.release();
      api.nextWave();
      api.simulate(95);
    });
    let state = await page.evaluate(() => window.__fieldguard.getState());
    if (state.phase === 'blessing') {
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, 'after-v2-blessing.png') });
      await page.evaluate((id) => window.__fieldguard.chooseBlessing(id), state.blessingOffers[0].id);
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        window.__fieldguard.nextWave();
        window.__fieldguard.simulate(100);
      });
      for (let i = 0; i < 6; i++) {
        state = await page.evaluate(() => window.__fieldguard.getState());
        if (state.phase === 'blessing') {
          await page.evaluate((id) => window.__fieldguard.chooseBlessing(id), state.blessingOffers[0].id);
          await page.waitForTimeout(200);
          continue;
        }
        if (state.phase === 'shop') break;
        await page.evaluate(() => window.__fieldguard.simulate(40));
      }
      state = await page.evaluate(() => window.__fieldguard.getState());
      if (state.phase === 'shop') {
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(out, 'after-v2-shop.png') });
      }
    }
    await context.close();
  }

  // 5. Merge inspector in overview, with both adjacent towers visible.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await page.evaluate(() => {
      const api = window.__fieldguard;
      api.addGold(400);
      api.hold();
      api.build(18, 'arrow');
      api.build(19, 'arrow');
      api.selectTowerAt(18);
      api.facePlot(18, 8.0);
      api.setLook(-0.35, -0.15);
    });
    await page.waitForTimeout(5200);
    await page.screenshot({ path: path.join(out, 'after-v2-merge.png') });
    await context.close();
  }

  // 6. Mobile HUD and 7. mobile blessing modal.
  {
    const { context, page } = await open(browser, { width: 390, height: 844 }, { mobile: true });
    await startVersus(page, true);
    await page.evaluate(() => {
      const api = window.__fieldguard;
      api.addGold(500);
      api.hold();
      for (const i of [18, 19, 20, 21]) {
        api.reclaim(i);
        api.simulate(1.7);
      }
      for (const [i, t] of [[18, 'wheat'], [19, 'wheat'], [20, 'pumpkin'], [21, 'flower']]) api.plant(i, t);
      api.teleport(7.8, 2.2);
      api.setLook(1.15, -0.05);
      api.release();
      api.nextWave();
      api.simulate(8);
      api.hold();
    });
    await page.waitForTimeout(4600);
    await page.screenshot({ path: path.join(out, 'after-v2-mobile.png') });
    await page.evaluate(() => {
      window.__fieldguard.release();
      window.__fieldguard.simulate(95);
      window.__fieldguard.hold();
    });
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => window.__fieldguard.getState());
    if (state.phase === 'blessing') {
      await page.screenshot({ path: path.join(out, 'after-v2-mobile-blessing.png') });
    }
    await context.close();
  }

  // 8. Victory end screen, with a small real harvest recorded.
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 });
    await startVersus(page);
    await page.evaluate(() => {
      const api = window.__fieldguard;
      api.addGold(6000);
      api.addStar(80);
      for (const i of [20, 21]) {
        api.reclaim(i);
        api.simulate(1.7);
      }
      api.plant(20, 'pumpkin');
      api.plant(21, 'wheat');
      const towers = [0, 1, 18, 19, 2, 3, 12, 13, 5, 11, 6, 22, 4, 17];
      for (const plot of towers) api.build(plot, 'arrow');
      for (const plot of [0, 18, 2, 12, 5, 6, 4]) if (api.canMerge(plot)) api.merge(plot);
      for (const tower of api.getState().towers) {
        if (tower.level < 3) api.upgrade(tower.plot);
        if (tower.level < 3) api.upgrade(tower.plot);
      }
      api.simulate(9);
      api.harvestAll();
      api.plant(20, 'pumpkin');
      api.plant(21, 'wheat');
      api.simulate(9);
      api.harvestAll();
    });
    const final = await autoFinish(page);
    if (final.phase !== 'victory') {
      throw new Error(`victory capture ended in ${final.phase} at wave ${final.wave}`);
    }
    console.log(`victory capture: ${final.phase}, wave ${final.wave}, lives ${final.lives}, rival ${final.rival?.lives}`);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, 'after-v2-victory.png') });
    await context.close();
  }

  if (errors.length > 0) {
    throw new Error(`browser errors: ${errors.join(' | ')}`);
  }
  console.log('v2 screenshots written to docs/screenshots');
  await browser.close();
} finally {
  server?.kill('SIGTERM');
}
