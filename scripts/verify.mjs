import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const previewPort = Number(process.env.VERIFY_PORT || 4173);
const baseUrl = `http://localhost:${previewPort}`;
const results = {
  startedAt: new Date().toISOString(),
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    viewport: { width: 1440, height: 900 },
    mobileViewport: { width: 390, height: 844 },
  },
  build: null,
  assets: null,
  browser: null,
  checks: [],
  consoleErrors: [],
  fps: null,
  playthrough: null,
  screenshots: [],
};
const checks = [];
const consoleErrors = [];

function check(name, ok, details = '') {
  checks.push({ name, ok: !!ok, details: details ? String(details) : '' });
  results.checks = checks;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${details ? ` — ${details}` : ''}`);
  return !!ok;
}

function recordScreenshot(file) {
  results.screenshots.push(file);
}

function wirePage(page) {
  page.on('pageerror', (error) => {
    const text = `pageerror: ${error.message}`;
    consoleErrors.push(text);
    console.error(text);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = `console: ${message.text()}`;
    consoleErrors.push(text);
    console.error(text);
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.ok) return;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function waitForGame(page) {
  await page.waitForFunction(
    () => window.__fieldguard && document.getElementById('loading-screen').hidden === true,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(250);
}

async function openPage(browser, viewport, url = `${baseUrl}/?debug=1`) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  wirePage(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await waitForGame(page);
  return { context, page };
}

async function getState(page) {
  return page.evaluate(() => window.__fieldguard.getState());
}

async function screenPoint(page, kind, index) {
  return page.evaluate(({ kind, index }) => window.__fieldguard.screenPoint(kind, index), { kind, index });
}

async function startGame(page) {
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
}

let preview = null;
let browser = null;

try {
  /* ── 1. Build ─────────────────────────────────────────────────────── */
  const buildStart = Date.now();
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  const buildOutput = `${build.stdout ?? ''}\n${build.stderr ?? ''}`;
  results.build = {
    ok: build.status === 0,
    exitCode: build.status,
    durationMs: Date.now() - buildStart,
    outputTail: buildOutput.trim().split('\n').slice(-12).join('\n'),
  };
  if (!check('npm run build (type-check + static build)', build.status === 0, `exit ${build.status}`)) {
    throw new Error('Build failed; aborting acceptance run.');
  }

  /* ── 2. Preview server ────────────────────────────────────────────── */
  preview = spawn('npx', ['vite', 'preview', '--port', String(previewPort), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  let previewLog = '';
  preview.stdout?.on('data', (chunk) => {
    previewLog += chunk.toString();
  });
  preview.stderr?.on('data', (chunk) => {
    previewLog += chunk.toString();
  });
  await waitForServer(baseUrl);
  check('static preview serves the production build', true, baseUrl);

  /* ── 3. Browser ───────────────────────────────────────────────────── */
  const launchArgs = process.platform === 'darwin' ? ['--use-angle=metal'] : [];
  browser = await chromium.launch({ headless: true, args: launchArgs });
  results.browser = `${browser.browserType().name()} ${browser.version()} (headless, metal=${process.platform === 'darwin'})`;
  check('Chromium/WebGL context launches', true, results.browser);

  /* ── 4. Assets + basic UI / economy loop ──────────────────────────── */
  const desktop = await openPage(browser, { width: 1440, height: 900 });
  const page = desktop.page;
  const assetReport = await page.evaluate(() => window.__harvestAssets ?? null);
  results.assets = assetReport;
  check(
    'all external models load from static assets',
    !!assetReport && assetReport.loaded === assetReport.total && assetReport.errors.length === 0,
    assetReport ? `${assetReport.loaded}/${assetReport.total} loaded, ${assetReport.errors.length} errors` : 'no asset report',
  );
  check('start screen and live 3D scene render', await page.locator('#menu-screen').isVisible(), 'menu visible');
  check('HUD is hidden until the run starts', await page.locator('#hud').isHidden(), 'HUD hidden on menu');
  const startButtonStyle = await page.locator('#btn-start').evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, color: style.color, appearance: style.appearance };
  });
  check(
    'start button keeps a visible gold background',
    startButtonStyle.backgroundColor === 'rgb(243, 196, 85)' && startButtonStyle.backgroundImage.includes('linear-gradient'),
    JSON.stringify(startButtonStyle),
  );

  await startGame(page);
  let state = await getState(page);
  check('starting economy is correct', state.gold === 90 && state.lives === 20 && state.wave === 0, JSON.stringify({ gold: state.gold, lives: state.lives, wave: state.wave }));

  // Plant through the actual crop card and canvas click.
  await page.locator('[data-crop="wheat"]').click();
  let point = await screenPoint(page, 'plot', 0);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
  state = await getState(page);
  check('click-to-plant works', state.plots[0].crop?.type === 'wheat', `plot 0 = ${state.plots[0].crop?.type}`);

  // Grow with deterministic simulation, then click the mature crop.
  await page.evaluate(() => window.__fieldguard.simulate(10));
  point = await screenPoint(page, 'plot', 0);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
  state = await getState(page);
  check('click-to-harvest feeds the economy', !state.plots[0].crop && state.gold === 100, `gold ${state.gold}, plot ${state.plots[0].crop}`);

  // Drag across two plots with the crop tool to prove paint planting.
  point = await screenPoint(page, 'plot', 1);
  const point2 = await screenPoint(page, 'plot', 2);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point2.x, point2.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  state = await getState(page);
  check(
    'drag planting works on the farm grid',
    !!state.plots[1].crop && !!state.plots[2].crop,
    `plots 1/2: ${state.plots[1].crop?.type}/${state.plots[2].crop?.type}`,
  );

  // Unlock a plot through the canvas.
  point = await screenPoint(page, 'plot', 6);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
  state = await getState(page);
  check('locked farmland can be cleared with coins', state.plots[6].unlocked, `gold ${state.gold}`);

  // Build a star tower, upgrade it and sell it through the inspector.
  await page.evaluate(() => {
    window.__fieldguard.addGold(500);
    window.__fieldguard.addStar(8);
  });
  await page.locator('[data-tower="star"]').click();
  point = await screenPoint(page, 'pad', 0);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  state = await getState(page);
  check('star tower builds from the action bar', state.towers.some((tower) => tower.id === 'star'), `towers ${state.towers.length}`);
  const beforeUpgrade = (await getState(page)).gold;
  await page.locator('#btn-upgrade').click();
  await page.waitForTimeout(200);
  state = await getState(page);
  check(
    'tower upgrades consume gold and starlight',
    state.towers[0]?.level === 2 && state.gold === beforeUpgrade - 110,
    `level ${state.towers[0]?.level}, gold ${state.gold}`,
  );
  await page.locator('#btn-sell').click();
  await page.waitForTimeout(200);
  state = await getState(page);
  check('tower sells and frees its pad', state.towers.length === 0, `towers ${state.towers.length}`);

  // Camera orbit + zoom.
  const cameraBefore = (await page.evaluate(() => window.__fieldguard.metrics())).camera;
  await page.mouse.move(1120, 150);
  await page.mouse.down();
  await page.mouse.move(880, 190, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const cameraAfter = (await page.evaluate(() => window.__fieldguard.metrics())).camera;
  check(
    'camera rotates with pointer drag',
    JSON.stringify(cameraBefore.position) !== JSON.stringify(cameraAfter.position),
    `distance ${cameraAfter.distance.toFixed(1)}`,
  );
  await page.mouse.move(720, 430);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(350);
  const cameraZoomed = (await page.evaluate(() => window.__fieldguard.metrics())).camera;
  check('camera zooms with the wheel', cameraZoomed.distance < cameraAfter.distance - 0.2, `${cameraAfter.distance.toFixed(1)} → ${cameraZoomed.distance.toFixed(1)}`);

  // Pause and help overlays pause the simulation.
  await page.locator('#btn-pause').click();
  await page.waitForTimeout(180);
  state = await getState(page);
  check('pause overlay pauses the run', state.phase === 'paused' && (await page.locator('#pause-screen').isVisible()), state.phase);
  await page.locator('#btn-resume').click();
  await page.waitForTimeout(150);
  await page.locator('#btn-help').click();
  await page.waitForTimeout(150);
  state = await getState(page);
  check('help overlay pauses the run', state.phase === 'paused' && (await page.locator('#help-screen').isVisible()), state.phase);
  await page.locator('#help-screen .modal-close').click();
  await page.waitForTimeout(150);
  state = await getState(page);
  check('closing help resumes the run', state.phase === 'playing', state.phase);

  await desktop.context.close();

  /* ── 5. Leak, trampled farmland, repair ───────────────────────────── */
  const leak = await openPage(browser, { width: 1280, height: 800 });
  await startGame(leak.page);
  await leak.page.evaluate(() => window.__fieldguard.plant(0, 'wheat'));
  await leak.page.evaluate(() => window.__fieldguard.nextWave());
  await leak.page.evaluate(() => window.__fieldguard.simulate(6));
  state = await getState(leak.page);
  const facings = state.enemies.map((enemy) => enemy.facing).filter((value) => typeof value === 'number');
  check(
    'enemy models face along their movement direction',
    facings.length > 0 && facings.every((value) => value > 0.3),
    `facing dots ${facings.map((value) => value.toFixed(2)).join(', ')}`,
  );
  await leak.page.evaluate(() => window.__fieldguard.simulate(24));
  state = await getState(leak.page);
  check('enemies leak, cost lives and scorch a crop', state.phase === 'playing' && state.lives < 20 && state.plots[0].scorched, `lives ${state.lives}, leaks ${state.stats.leaks}`);
  const goldBeforeRepair = state.gold;
  point = await screenPoint(leak.page, 'plot', 0);
  await leak.page.mouse.click(point.x, point.y);
  await leak.page.waitForTimeout(180);
  state = await getState(leak.page);
  check(
    'scorched farmland can be repaired',
    state.plots[0].scorched === false && state.gold === goldBeforeRepair - 14,
    `gold ${goldBeforeRepair} → ${state.gold}`,
  );
  await leak.context.close();

  /* ── 6. Defeat screen ─────────────────────────────────────────────── */
  const defeat = await openPage(browser, { width: 1280, height: 800 });
  await startGame(defeat.page);
  await defeat.page.evaluate(() => window.__fieldguard.simulate(180));
  state = await getState(defeat.page);
  check('an unguarded run reaches a defeat state', state.phase === 'defeat' && (await defeat.page.locator('#end-screen').isVisible()), state.phase);
  await defeat.page.waitForTimeout(500);
  const defeatShot = path.join(root, 'docs/screenshots/after-defeat.png');
  fs.mkdirSync(path.dirname(defeatShot), { recursive: true });
  await defeat.page.screenshot({ path: defeatShot });
  recordScreenshot(path.relative(root, defeatShot));
  await defeat.context.close();

  /* ── 7. Full six-wave run using the normal economy ─────────────────── */
  const play = await openPage(browser, { width: 1440, height: 900 });
  await startGame(play.page);
  const towerPlan = [
    { pad: 1, type: 'arrow' },
    { pad: 2, type: 'cannon' },
    { pad: 4, type: 'arrow' },
    { pad: 5, type: 'cannon' },
    { pad: 3, type: 'star' },
    { pad: 6, type: 'star' },
  ];
  const costs = { arrow: 45, cannon: 90, star: 120 };
  let lastWave = 0;
  const milestones = [];
  let guard = 0;
  while (guard < 260) {
    guard++;
    state = await getState(play.page);
    if (state.phase !== 'playing') break;
    if (state.wave !== lastWave) {
      lastWave = state.wave;
      milestones.push({ t: guard, wave: state.wave, lives: state.lives, gold: state.gold, star: state.star });
    }
    await play.page.evaluate(() => window.__fieldguard.harvestAll());
    let current = await getState(play.page);
    const empty = current.plots.filter((plot) => plot.unlocked && !plot.scorched && !plot.crop).map((plot) => plot.index);
    for (const index of empty) {
      current = await getState(play.page);
      if (current.gold < 26) break;
      const flowers = current.plots.filter((plot) => plot.crop?.type === 'flower').length;
      await play.page.evaluate(
        ({ index, type }) => window.__fieldguard.plant(index, type),
        { index, type: flowers < 2 ? 'flower' : 'wheat' },
      );
    }
    current = await getState(play.page);
    for (const plan of towerPlan) {
      if (current.towers.some((tower) => tower.pad === plan.pad)) continue;
      const starCost = plan.type === 'star' ? 2 : 0;
      if (current.gold >= costs[plan.type] && current.star >= starCost) {
        await play.page.evaluate(({ pad, type }) => window.__fieldguard.build(pad, type), { pad: plan.pad, type: plan.type });
        break;
      }
    }
    current = await getState(play.page);
    if (current.gold > 160 && current.star > 3) {
      for (const tower of current.towers) {
        if (tower.level < 3) {
          await play.page.evaluate(({ pad }) => window.__fieldguard.upgrade(pad), { pad: tower.pad });
          break;
        }
      }
    }
    await play.page.evaluate(() => window.__fieldguard.simulate(1));
  }
  state = await getState(play.page);
  results.playthrough = {
    outcome: state.phase,
    wave: state.wave,
    lives: state.lives,
    gold: state.gold,
    star: state.star,
    kills: state.stats.kills,
    leaks: state.stats.leaks,
    harvestedGold: state.stats.harvestedGold,
    simulatedSeconds: Math.round(state.stats.playSeconds),
    towers: state.towers,
    milestones,
  };
  check(
    'farming → gold → towers → six waves completes with a victory',
    state.phase === 'victory' && state.wave === 6 && state.lives > 0,
    `wave ${state.wave}, lives ${state.lives}, kills ${state.stats.kills}`,
  );
  check(
    'the winning run used crops and tower upgrades end-to-end',
    state.stats.harvestedGold > 0 && state.towers.length >= 4 && state.towers.some((tower) => tower.level >= 2),
    `${state.towers.length} towers, harvested ${state.stats.harvestedGold} gold`,
  );
  await play.page.waitForTimeout(700);
  const victoryShot = path.join(root, 'docs/screenshots/after-victory.png');
  fs.mkdirSync(path.dirname(victoryShot), { recursive: true });
  await play.page.screenshot({ path: victoryShot });
  recordScreenshot(path.relative(root, victoryShot));
  await play.context.close();

  /* ── 8. FPS on a busy, rendered wave ──────────────────────────────── */
  const perf = await openPage(browser, { width: 1440, height: 900 });
  await startGame(perf.page);
  await perf.page.evaluate(() => {
    window.__fieldguard.addGold(700);
    window.__fieldguard.addStar(8);
  });
  for (const [index, type] of [
    [0, 'wheat'],
    [1, 'wheat'],
    [2, 'wheat'],
    [3, 'pumpkin'],
    [4, 'pumpkin'],
    [5, 'flower'],
    [6, 'flower'],
    [7, 'wheat'],
  ]) {
    await perf.page.evaluate(({ index, type }) => window.__fieldguard.plant(index, type), { index, type });
  }
  for (const [pad, type] of [
    [1, 'arrow'],
    [2, 'cannon'],
    [4, 'star'],
    [5, 'arrow'],
  ]) {
    await perf.page.evaluate(({ pad, type }) => window.__fieldguard.build(pad, type), { pad, type });
  }
  await perf.page.evaluate(() => {
    window.__fieldguard.nextWave();
    window.__fieldguard.simulate(5);
  });
  await perf.page.waitForTimeout(600);
  const fpsSample = await perf.page.evaluate(async () => {
    const deltas = [];
    let last = performance.now();
    const start = last;
    while (performance.now() - start < 5000) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      deltas.push(now - last);
      last = now;
    }
    deltas.sort((a, b) => a - b);
    const average = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    const p95 = deltas[Math.floor(deltas.length * 0.95)];
    return {
      frames: deltas.length,
      averageMs: average,
      p95Ms: p95,
      fpsAverage: 1000 / average,
      fpsP95: 1000 / p95,
      metrics: window.__fieldguard.metrics(),
    };
  });
  results.fps = fpsSample;
  check(
    'busy battle field renders near 60 fps',
    fpsSample.fpsAverage >= 55,
    `${fpsSample.fpsAverage.toFixed(1)} fps average, p95 ${fpsSample.p95Ms.toFixed(1)} ms, ${fpsSample.metrics.calls} draw calls, ${fpsSample.metrics.triangles} triangles`,
  );
  await perf.context.close();

  /* ── 9. Mobile narrow screen ──────────────────────────────────────── */
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  wirePage(mobile);
  await mobile.goto(`${baseUrl}/?debug=1`, { waitUntil: 'networkidle' });
  await waitForGame(mobile);
  await mobile.screenshot({ path: path.join(root, 'docs/screenshots/after-mobile-menu.png') });
  recordScreenshot('docs/screenshots/after-mobile-menu.png');
  check('mobile start screen is usable', await mobile.locator('#btn-start').isVisible(), '390×844');
  await mobile.locator('#btn-start').tap();
  await mobile.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
  await mobile.waitForTimeout(300);
  const mobileLayout = await mobile.evaluate(() => {
    const utility = document.querySelector('.tool-utility')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      utilityVisible: !!utility && utility.width > 0 && utility.height > 0 && utility.bottom <= window.innerHeight + 1,
    };
  });
  check(
    'mobile HUD and action controls fit without page overflow',
    mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1 && mobileLayout.utilityVisible,
    JSON.stringify(mobileLayout),
  );
  await mobile.locator('[data-crop="pumpkin"]').tap();
  point = await screenPoint(mobile, 'plot', 0);
  await mobile.touchscreen.tap(point.x, point.y);
  await mobile.waitForTimeout(220);
  state = await getState(mobile);
  check('mobile tap-to-plant works', state.plots[0].crop?.type === 'pumpkin', `plot 0 = ${state.plots[0].crop?.type}`);
  await mobile.screenshot({ path: path.join(root, 'docs/screenshots/after-mobile-game.png') });
  recordScreenshot('docs/screenshots/after-mobile-game.png');
  await mobileContext.close();

  /* ── 10. Licence evidence ──────────────────────────────────────────── */
  const kenneyLicense = fs.readFileSync(path.join(root, 'public/assets/kenney/License.txt'), 'utf8');
  const quaterniusEvidence = fs.readFileSync(path.join(root, 'public/assets/quaternius/LICENSE-EVIDENCE.md'), 'utf8');
  const credits = fs.readFileSync(path.join(root, 'CREDITS.md'), 'utf8');
  const licenceChecks = [
    ['Kenney CC0 licence file is present', /Creative Commons Zero, CC0/i.test(kenneyLicense)],
    ['Kenney licence allows commercial use', /commercial projects/i.test(kenneyLicense)],
    ['Quaternius CC0 evidence links each pack', ['ultimatecrops', 'ultimateanimatedanimals', 'ultimatefantasyrts', 'medievalvillage', 'ultimatenature'].every((slug) => quaterniusEvidence.includes(slug))],
    ['CREDITS enumerates both external sources', credits.includes('Quaternius') && credits.includes('Kenney') && credits.includes('CC0')],
    ['CC0Tree is documented as evaluated but not shipped', credits.includes('CC0Tree') && !fs.existsSync(path.join(root, 'public/assets/cc0tree'))],
  ];
  for (const [name, ok] of licenceChecks) check(name, ok);
  const externalGlbs = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.glb')) externalGlbs.push(full);
    }
  };
  walk(path.join(root, 'public/assets'));
  check(
    'every shipped external model is from a licensed source directory',
    externalGlbs.every((file) => file.includes(`${path.sep}kenney${path.sep}`) || file.includes(`${path.sep}quaternius${path.sep}`)),
    `${externalGlbs.length} GLB files`,
  );

  /* ── 11. Console hygiene ──────────────────────────────────────────── */
  results.consoleErrors = [...new Set(consoleErrors)];
  check('browser console has no unhandled errors or page exceptions', consoleErrors.length === 0, `${consoleErrors.length} errors`);
} catch (error) {
  console.error('Acceptance run error:', error?.stack || error);
  results.checks = checks;
  results.consoleErrors = [...new Set(consoleErrors)];
  results.error = String(error?.stack || error);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (preview) {
    preview.kill('SIGTERM');
  }
  results.finishedAt = new Date().toISOString();
  results.passed = results.checks.every((entry) => entry.ok) && !results.error;
  results.summary = {
    total: results.checks.length,
    passed: results.checks.filter((entry) => entry.ok).length,
    failed: results.checks.filter((entry) => !entry.ok).length,
  };
  results.consoleErrors = [...new Set(consoleErrors)];
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/verification.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\n${results.passed ? 'ACCEPTANCE PASS' : 'ACCEPTANCE FAIL'} — ${results.summary.passed}/${results.summary.total} checks`);
  console.log('Report: docs/verification.json');
  if (!results.passed) process.exitCode = 1;
}
