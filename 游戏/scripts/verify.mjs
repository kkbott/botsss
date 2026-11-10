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

const getState = (page) => page.evaluate(() => window.__fieldguard.getState());
const metrics = (page) => page.evaluate(() => window.__fieldguard.metrics());
const screenPoint = (page, index) =>
  page.evaluate((i) => window.__fieldguard.screenPoint('plot', i), index);

async function startGame(page) {
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => window.__fieldguard.getState().phase === 'playing', null, { timeout: 5000 });
}

async function pressE(page) {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(180);
}

async function facePlot(page, index) {
  await page.evaluate((i) => window.__fieldguard.facePlot(i), index);
  await page.waitForTimeout(160);
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

  /* ── 4. Loading, menu and first-person controls ───────────────────── */
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
  // Freeze the simulation while we exercise controls and one-off interactions.
  await page.evaluate(() => window.__fieldguard.hold());
  let state = await getState(page);
  check('starting economy is correct', state.gold === 150 && state.lives === 20 && state.wave === 0, JSON.stringify({ gold: state.gold, lives: state.lives, wave: state.wave }));
  check(
    'every plot starts as untouched wild land',
    state.plots.length === 24 && state.plots.every((plot) => plot.state === 'wild'),
    `${state.plots.length} plots, ${state.plots.filter((plot) => plot.state === 'wild').length} wild`,
  );
  check(
    'the expanded map has a long path and a full buildable grid',
    state.pathLength > 55 && state.plots.length >= 24,
    `path ${state.pathLength.toFixed(1)}m, ${state.plots.length} buildable plots`,
  );

  let snapshot = await metrics(page);
  check(
    'the run starts in first person at eye height',
    snapshot.mode === 'first' && snapshot.camera.fov === 72 && Math.abs(snapshot.camera.position[1] - 1.64) < 0.08,
    `mode ${snapshot.mode}, fov ${snapshot.camera.fov}, eye ${snapshot.camera.position[1].toFixed(2)}`,
  );

  const playerBefore = (await getState(page)).player;
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(750);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(180);
  const playerAfterMove = (await getState(page)).player;
  const movedDistance = Math.hypot(playerAfterMove.x - playerBefore.x, playerAfterMove.z - playerBefore.z);
  check('WASD walks the first-person character', movedDistance > 0.8, `moved ${movedDistance.toFixed(2)}m`);
  snapshot = await metrics(page);
  check(
    'the camera follows the character eye position',
    Math.hypot(snapshot.camera.position[0] - playerAfterMove.x, snapshot.camera.position[2] - playerAfterMove.z) < 0.1,
    `camera ${snapshot.camera.position.map((value) => value.toFixed(2)).join(', ')}`,
  );

  const yawBefore = (await getState(page)).player.yaw;
  await page.mouse.move(720, 300);
  await page.mouse.down();
  await page.mouse.move(860, 300, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(160);
  const yawAfter = (await getState(page)).player.yaw;
  check('mouse look changes the first-person view', Math.abs(yawAfter - yawBefore) > 0.1, `yaw ${yawBefore.toFixed(2)} → ${yawAfter.toFixed(2)}`);

  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const jumpState = (await getState(page)).player;
  check('Space jumps and lands again', jumpState.jumpY > 0.04 && !jumpState.grounded, `jump height ${jumpState.jumpY.toFixed(2)}m`);
  await page.waitForTimeout(900);
  const landedState = (await getState(page)).player;
  check('the character lands back on the ground', landedState.jumpY === 0 && landedState.grounded, `grounded ${landedState.grounded}`);

  await page.keyboard.press('KeyV');
  await page.waitForTimeout(450);
  snapshot = await metrics(page);
  let modeState = await getState(page);
  check(
    'V switches to the overview orbit camera',
    modeState.mode === 'overview' && snapshot.camera.fov === 46 && snapshot.camera.distance >= 7,
    `mode ${modeState.mode}, fov ${snapshot.camera.fov}, distance ${snapshot.camera.distance.toFixed(1)}`,
  );
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(400);
  snapshot = await metrics(page);
  modeState = await getState(page);
  check(
    'V returns to the first-person camera',
    modeState.mode === 'first' && snapshot.camera.fov === 72 && Math.abs(snapshot.camera.position[1] - 1.64) < 0.1,
    `mode ${modeState.mode}, fov ${snapshot.camera.fov}`,
  );

  /* ── 5. Proximity-gated reclaim, planting and harvest ──────────────── */
  await page.evaluate(() => window.__fieldguard.teleport(-1, 10));
  await page.waitForTimeout(180);
  const farState = await getState(page);
  await pressE(page);
  const afterFar = await getState(page);
  check(
    'E does nothing when no plot is within reach',
    afterFar.gold === farState.gold && afterFar.plots.every((plot) => plot.state === 'wild'),
    `gold ${farState.gold} → ${afterFar.gold}`,
  );

  await facePlot(page, 23);
  await pressE(page);
  let reclaimState = await getState(page);
  check(
    'walking near a wild plot and pressing E starts reclamation for gold',
    reclaimState.gold === 136 && !!reclaimState.plots[23].reclaim && reclaimState.plots[23].state === 'wild',
    `gold ${reclaimState.gold}, reclaim ${JSON.stringify(reclaimState.plots[23].reclaim)}`,
  );
  const reclaimPrompt = await page.locator('#interact-title').textContent();
  check('the reclaim process shows a live progress prompt', /开垦中/.test(reclaimPrompt ?? ''), `prompt “${reclaimPrompt}”`);
  await page.evaluate(() => window.__fieldguard.simulate(1.8));
  reclaimState = await getState(page);
  check(
    'the timed reclamation animation finishes into farmland',
    reclaimState.plots[23].state === 'farmland' && reclaimState.plots[23].reclaim === null && reclaimState.stats.reclaimed === 1,
    `state ${reclaimState.plots[23].state}, reclaimed ${reclaimState.stats.reclaimed}`,
  );
  check('reclamation costs escalate as more land is cleared', reclaimState.reclaimCost === 19, `next cost ${reclaimState.reclaimCost}`);

  await page.locator('[data-crop="wheat"]').click();
  await facePlot(page, 23);
  await pressE(page);
  let cropState = await getState(page);
  check(
    'a crop is planted at the plot in front of the farmer',
    cropState.plots[23].crop?.type === 'wheat' && cropState.gold === 130,
    `plot 23 ${cropState.plots[23].crop?.type}, gold ${cropState.gold}`,
  );
  await page.evaluate(() => window.__fieldguard.simulate(10));
  cropState = await getState(page);
  check('crops still grow to maturity on reclaimed land', cropState.plots[23].crop?.mature === true, `stage ${cropState.plots[23].crop?.stage}`);
  await pressE(page);
  cropState = await getState(page);
  check(
    'harvesting next to the crop feeds the economy',
    cropState.plots[23].crop === null && cropState.gold === 146,
    `gold ${cropState.gold}`,
  );

  /* ── 6. Towers are built on chosen land and restore it on sale ────── */
  await page.locator('[data-tower="arrow"]').click();
  await facePlot(page, 18);
  await pressE(page);
  let towerState = await getState(page);
  check(
    'a tower is built on the selected wild plot',
    towerState.towers.length === 1 && towerState.towers[0].plot === 18 && towerState.plots[18].state === 'tower' && towerState.gold === 104,
    `towers ${towerState.towers.length}, plot 18 ${towerState.plots[18].state}, gold ${towerState.gold}`,
  );
  const blockedPlant = await page.evaluate(() => window.__fieldguard.plant(18, 'wheat'));
  const towerBlocked = await getState(page);
  check(
    'a tower base cannot be planted with crops',
    blockedPlant === false && towerBlocked.plots[18].crop === null,
    `plant returned ${blockedPlant}`,
  );
  await pressE(page);
  check('viewing a tower opens its inspector', await page.locator('#inspector').isVisible(), 'inspector visible');
  await page.locator('#btn-sell').click();
  await page.waitForTimeout(180);
  towerState = await getState(page);
  check(
    'selling a tower restores its wild land',
    towerState.towers.length === 0 && towerState.plots[18].state === 'wild',
    `plot 18 ${towerState.plots[18].state}, towers ${towerState.towers.length}`,
  );

  // Clear a second plot, then build on the farmland and check it comes back.
  await page.evaluate(() => window.__fieldguard.selectCrop('wheat'));
  await facePlot(page, 22);
  await pressE(page);
  await page.evaluate(() => window.__fieldguard.simulate(1.8));
  await page.waitForTimeout(120);
  await page.locator('[data-tower="arrow"]').click();
  await facePlot(page, 22);
  await pressE(page);
  let farmlandTower = await getState(page);
  check(
    'a tower can also occupy empty farmland',
    farmlandTower.plots[22].state === 'tower' && farmlandTower.plots[22].underlying === 'farmland',
    `plot 22 ${farmlandTower.plots[22].state}, underlying ${farmlandTower.plots[22].underlying}`,
  );
  await pressE(page);
  await page.locator('#btn-sell').click();
  await page.waitForTimeout(180);
  farmlandTower = await getState(page);
  check(
    'selling that tower returns the plot to farmland',
    farmlandTower.plots[22].state === 'farmland' && farmlandTower.plots[22].underlying === 'farmland',
    `plot 22 ${farmlandTower.plots[22].state}`,
  );

  await page.evaluate(() => {
    window.__fieldguard.addGold(320);
    window.__fieldguard.addStar(5);
  });
  await page.locator('[data-tower="star"]').click();
  await facePlot(page, 19);
  await pressE(page);
  let starState = await getState(page);
  check(
    'high-tier towers still consume starlight',
    starState.towers.some((tower) => tower.plot === 19) && starState.star === 3,
    `towers ${starState.towers.length}, star ${starState.star}`,
  );
  await pressE(page);
  await page.locator('#btn-upgrade').click();
  await page.waitForTimeout(200);
  starState = await getState(page);
  const starTower = starState.towers.find((tower) => tower.plot === 19);
  check(
    'star towers upgrade with gold and starlight',
    starTower?.level === 2 && starState.star === 1,
    `level ${starTower?.level}, star ${starState.star}`,
  );
  await page.locator('#btn-sell').click();
  await page.waitForTimeout(200);
  starState = await getState(page);
  check('selling the star tower clears its plot', !starState.towers.some((tower) => tower.plot === 19) && starState.plots[19].state === 'wild', `plots ${starState.plots[19].state}`);

  /* ── 7. Pause and help overlays ───────────────────────────────────── */
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

  /* ── 8. Leak, scorched farmland and repair ────────────────────────── */
  const leak = await openPage(browser, { width: 1280, height: 800 });
  await startGame(leak.page);
  await leak.page.evaluate(() => window.__fieldguard.hold());
  await facePlot(leak.page, 23);
  await pressE(leak.page);
  await leak.page.evaluate(() => window.__fieldguard.simulate(1.8));
  await leak.page.locator('[data-crop="wheat"]').click();
  await leak.page.evaluate(() => window.__fieldguard.facePlot(23));
  await leak.page.waitForTimeout(100);
  await pressE(leak.page);
  await leak.page.evaluate(() => {
    window.__fieldguard.release();
    window.__fieldguard.nextWave();
    window.__fieldguard.simulate(36);
  });
  state = await getState(leak.page);
  const scorched = state.plots.find((plot) => plot.scorched);
  check(
    'enemies leak, cost lives and scorch farmland',
    state.phase === 'playing' && state.lives < 20 && !!scorched,
    `lives ${state.lives}, scorched ${scorched?.index}`,
  );
  check('enemy models still face their movement direction', state.enemies.length > 0 && state.enemies.every((enemy) => enemy.facing === null || enemy.facing > 0.3), `${state.enemies.length} enemies`);
  const goldBeforeRepair = state.gold;
  await facePlot(leak.page, scorched.index);
  await pressE(leak.page);
  state = await getState(leak.page);
  check(
    'scorched farmland can be repaired near the plot',
    state.plots[scorched.index].scorched === false && state.gold === goldBeforeRepair - 14,
    `gold ${goldBeforeRepair} → ${state.gold}`,
  );
  await leak.context.close();

  /* ── 9. Defeat screen ─────────────────────────────────────────────── */
  const defeat = await openPage(browser, { width: 1280, height: 800 });
  await startGame(defeat.page);
  await defeat.page.evaluate(() => window.__fieldguard.simulate(400));
  state = await getState(defeat.page);
  check('an unguarded run reaches a defeat state', state.phase === 'defeat' && (await defeat.page.locator('#end-screen').isVisible()), state.phase);
  await defeat.page.waitForTimeout(500);
  const defeatShot = path.join(root, 'docs/screenshots/after-defeat.png');
  fs.mkdirSync(path.dirname(defeatShot), { recursive: true });
  await defeat.page.screenshot({ path: defeatShot });
  recordScreenshot(path.relative(root, defeatShot));
  await defeat.context.close();

  /* ── 10. Full six-wave run using the normal economy ───────────────── */
  const play = await openPage(browser, { width: 1440, height: 900 });
  await startGame(play.page);
  const botResult = await play.page.evaluate(async () => {
    const api = window.__fieldguard;
    const state = () => api.getState();
    const farmOrder = [7, 8, 13, 14, 9, 10, 15, 16, 20, 21];
    const towerOrder = [0, 18, 5, 23, 2, 19, 6, 12, 1, 22, 3, 4, 17, 11];
    const towerPlan = ['arrow', 'arrow', 'arrow', 'cannon', 'arrow', 'cannon', 'arrow', 'arrow', 'cannon', 'arrow', 'arrow', 'cannon', 'arrow', 'arrow'];
    const milestones = [];
    let lastWave = 0;
    let lastLives = 20;
    for (let iter = 0; iter < 900; iter++) {
      let current = state();
      if (current.phase !== 'playing') break;
      if (current.wave !== lastWave || current.lives !== lastLives) {
        milestones.push({
          time: Math.round(current.stats.playSeconds),
          wave: current.wave,
          lives: current.lives,
          gold: Math.round(current.gold),
          towers: current.towers.length,
          farmland: current.plots.filter((plot) => plot.underlying === 'farmland').length,
        });
        lastWave = current.wave;
        lastLives = current.lives;
      }
      api.harvestAll();
      current = state();
      for (const plot of current.plots) if (plot.scorched && state().gold > 30) api.repair(plot.index);
      current = state();
      const flowers = current.plots.filter((plot) => plot.crop?.type === 'flower').length;
      for (const plot of current.plots) {
        if (plot.state !== 'farmland' || plot.scorched || plot.crop || plot.reclaim) continue;
        const wantFlower = flowers < 2 && (plot.index === 8 || plot.index === 14);
        const type = wantFlower ? 'flower' : 'wheat';
        if (state().gold >= (type === 'flower' ? 26 : 6)) api.plant(plot.index, type);
      }
      current = state();
      if (!current.plots.some((plot) => plot.reclaim)) {
        const next = farmOrder.find((index) => state().plots[index].state === 'wild');
        if (next !== undefined && state().gold >= state().reclaimCost + 25 && state().plots.filter((plot) => plot.underlying === 'farmland').length < 10) {
          api.reclaim(next);
          api.simulate(1.7);
        }
      }
      current = state();
      for (let i = 0; i < towerOrder.length; i++) {
        const plot = towerOrder[i];
        const target = state().plots[plot];
        if (!target || target.state !== 'wild' || target.reclaim) continue;
        if (state().towers.some((tower) => tower.plot === plot)) continue;
        const type = towerPlan[Math.min(i, towerPlan.length - 1)];
        const cost = { arrow: 42, cannon: 88, star: 118 }[type];
        if (state().star >= (type === 'star' ? 2 : 0) && state().gold >= cost + 15) api.build(plot, type);
        break;
      }
      current = state();
      if (current.gold > 260 && current.star > 2) {
        const target = current.towers.filter((tower) => tower.level < 3).sort((a, b) => a.level - b.level)[0];
        if (target) api.upgrade(target.plot);
      }
      api.simulate(1);
    }
    const final = state();
    return {
      milestones,
      final: {
        phase: final.phase,
        wave: final.wave,
        lives: final.lives,
        gold: Math.round(final.gold),
        star: final.star,
        towers: final.towers,
        reclaimed: final.stats.reclaimed,
        farmland: final.plots.filter((plot) => plot.state === 'farmland').length,
        stats: final.stats,
      },
    };
  });
  results.playthrough = botResult.final;
  const final = botResult.final;
  check(
    'farming → gold → towers → six waves completes with a victory',
    final.phase === 'victory' && final.wave === 6 && final.lives > 0,
    `wave ${final.wave}, lives ${final.lives}, kills ${final.stats.kills}`,
  );
  check(
    'the winning run reclaimed land, farmed it and built towers on plots',
    final.reclaimed >= 6 && final.farmland >= 6 && final.towers.length >= 6 && final.stats.harvestedGold > 0,
    `${final.farmland} farmland, ${final.towers.length} towers, ${final.stats.harvestedGold} harvested gold`,
  );
  check(
    'the winning run upgraded towers',
    final.towers.some((tower) => tower.level >= 2),
    final.towers.map((tower) => `${tower.id}@${tower.plot}:L${tower.level}`).join(', '),
  );
  await play.page.waitForTimeout(700);
  const victoryShot = path.join(root, 'docs/screenshots/after-victory.png');
  fs.mkdirSync(path.dirname(victoryShot), { recursive: true });
  await play.page.screenshot({ path: victoryShot });
  recordScreenshot(path.relative(root, victoryShot));
  await play.context.close();

  /* ── 11. FPS on a busy first-person scene ─────────────────────────── */
  const perf = await openPage(browser, { width: 1440, height: 900 });
  await startGame(perf.page);
  await perf.page.evaluate(() => {
    window.__fieldguard.addGold(700);
    window.__fieldguard.addStar(8);
  });
  for (const index of [23, 22, 21, 20, 19, 18]) {
    await perf.page.evaluate((i) => window.__fieldguard.reclaim(i), index);
    await perf.page.evaluate(() => window.__fieldguard.simulate(1.7));
  }
  for (const [index, type] of [
    [18, 'wheat'],
    [19, 'wheat'],
    [20, 'pumpkin'],
    [21, 'flower'],
    [22, 'wheat'],
    [23, 'wheat'],
  ]) {
    await perf.page.evaluate(({ index, type }) => window.__fieldguard.plant(index, type), { index, type });
  }
  for (const [plot, type] of [
    [0, 'arrow'],
    [5, 'cannon'],
    [6, 'arrow'],
    [12, 'arrow'],
  ]) {
    await perf.page.evaluate(({ plot, type }) => window.__fieldguard.build(plot, type), { plot, type });
  }
  await perf.page.evaluate(() => {
    window.__fieldguard.nextWave();
    window.__fieldguard.simulate(7);
    window.__fieldguard.teleport(8.4, 4.6);
    window.__fieldguard.setLook(1.35, -0.18);
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
    'a busy first-person farm scene renders near 60 fps',
    fpsSample.fpsAverage >= 55,
    `${fpsSample.fpsAverage.toFixed(1)} fps average, p95 ${fpsSample.p95Ms.toFixed(1)} ms, ${fpsSample.metrics.calls} draw calls, ${fpsSample.metrics.triangles} triangles`,
  );
  await perf.context.close();

  /* ── 12. Mobile first-person touch controls ──────────────────────── */
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
    const box = (selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height, bottom: rect.bottom, right: rect.right } : null;
    };
    const chips = box('.resource-chips');
    const right = box('.hud-right');
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      utilityVisible: !!box('.tool-utility') && box('.tool-utility').bottom <= window.innerHeight + 1,
      joystick: box('#joystick'),
      interact: box('#btn-interact'),
      touchVisible: !document.getElementById('touch-controls').hidden,
      hudOverlap: !!chips && !!right && chips.right > right.x,
    };
  });
  check(
    'mobile HUD, joystick and interact button fit without overflow',
    mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1 &&
      mobileLayout.utilityVisible &&
      mobileLayout.touchVisible &&
      !mobileLayout.hudOverlap &&
      mobileLayout.joystick.w > 0 &&
      mobileLayout.interact.w > 0 &&
      mobileLayout.interact.right <= mobileLayout.viewportWidth + 1,
    JSON.stringify(mobileLayout),
  );
  await mobile.evaluate(() => window.__fieldguard.facePlot(23));
  await mobile.waitForTimeout(220);
  const mobilePrompt = await mobile.evaluate(() => ({
    title: document.getElementById('interact-title').textContent,
    keyVisible: getComputedStyle(document.getElementById('interact-key')).display !== 'none',
    interactEnabled: !document.getElementById('btn-interact').disabled,
  }));
  check(
    'the mobile interact button is enabled next to a plot',
    mobilePrompt.interactEnabled && mobilePrompt.title.length > 0,
    JSON.stringify(mobilePrompt),
  );
  await mobile.locator('#btn-interact').tap();
  await mobile.waitForTimeout(350);
  state = await getState(mobile);
  check(
    'tapping the mobile interact button starts reclamation',
    !!state.plots[23].reclaim && state.plots[23].state === 'wild',
    `reclaim progress ${state.plots[23].reclaim?.progress?.toFixed(2)}`,
  );
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: path.join(root, 'docs/screenshots/after-mobile-game.png') });
  recordScreenshot('docs/screenshots/after-mobile-game.png');
  await mobileContext.close();

  /* ── 13. Licence evidence ─────────────────────────────────────────── */
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

  /* ── 14. Console hygiene ──────────────────────────────────────────── */
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
  console.log(`Report: docs/verification.json`);
  if (!results.passed) process.exitCode = 1;
}
