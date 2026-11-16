import {
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  BLESSINGS,
  CROPS,
  ENEMIES,
  PLOTS,
  RULES,
  SHOP_ITEMS,
  STORAGE_KEY,
  TOWERS,
  VERSUS_RULES,
  VERSUS_WAVES,
  WAVES,
  WORLD,
} from './config';
import type {
  BlessingChoice,
  BlessingId,
  CameraMode,
  CropId,
  CropStage,
  EnemyId,
  EnemyRuntime,
  GamePhase,
  GameStats,
  PlotRuntime,
  RivalState,
  RunMode,
  SaveData,
  ShopItemId,
  ShopOffer,
  TowerId,
  TowerRuntime,
  WavePhase,
  WaveGroup,
  WaveDef,
} from './types';
import { AudioEngine, type SoundName } from './audio';
import { FloatingTexts, ParticleSystem } from './effects';
import { GameUI, type InteractPrompt, type InspectorData, type UIActions } from './ui';
import { World, type PlotVisual } from './world';
import { Player } from './player';
import type { ArtProvider } from './art';
import type { EnvironmentAssets } from './assets';

interface ArrowProjectile {
  kind: 'arrow';
  mesh: Mesh;
  speed: number;
  damage: number;
  target: EnemyRuntime | null;
  lastTarget: Vector3;
  life: number;
}

interface MortarProjectile {
  kind: 'mortar';
  mesh: Mesh;
  start: Vector3;
  end: Vector3;
  duration: number;
  t: number;
  damage: number;
  splash: number;
  arc: number;
  trailTimer: number;
}

type Projectile = ArrowProjectile | MortarProjectile;

interface Beam {
  line: Line;
  life: number;
  maxLife: number;
}

interface CachedSave {
  bestWave: number;
  victories: number;
  versusWins: number;
  versusBestWave: number;
  muted: boolean;
}

const HERO_Y = 0.02;
function readSave(): CachedSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestWave: 0, victories: 0, versusWins: 0, versusBestWave: 0, muted: false };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      bestWave: typeof parsed.bestWave === 'number' && parsed.bestWave >= 0 ? parsed.bestWave : 0,
      victories: typeof parsed.victories === 'number' && parsed.victories >= 0 ? parsed.victories : 0,
      versusWins: typeof parsed.versusWins === 'number' && parsed.versusWins >= 0 ? parsed.versusWins : 0,
      versusBestWave:
        typeof parsed.versusBestWave === 'number' && parsed.versusBestWave >= 0 ? parsed.versusBestWave : 0,
      muted: parsed.muted === true,
    };
  } catch {
    return { bestWave: 0, victories: 0, versusWins: 0, versusBestWave: 0, muted: false };
  }
}

function writeSave(save: CachedSave) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Private mode / storage disabled: progression simply stays in memory.
  }
}

function cleanNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function wavePreview(groups: WaveGroup[]) {
  const counts = new Map<string, number>();
  for (const group of groups) counts.set(group.enemy, (counts.get(group.enemy) ?? 0) + group.count);
  return [...counts.entries()].map(([id, count]) => ({ id, count }));
}

function scheduleForWave(wave: WaveDef) {
  const entries: Array<{ enemy: EnemyId; at: number }> = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) entries.push({ enemy: group.enemy, at: group.startAt + i * group.interval });
  }
  entries.sort((a, b) => a.at - b.at);
  return entries;
}

function timeText(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class Game {
  private readonly world: World;
  private readonly player: Player;
  private readonly art: ArtProvider;
  private readonly audio: AudioEngine;
  private readonly ui: GameUI;
  private readonly particles: ParticleSystem;
  private readonly floaters: FloatingTexts;
  private readonly enemyBarLayer: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  private phase: GamePhase = 'loading';
  private runMode: RunMode = 'classic';
  private mode: CameraMode = 'first';
  private speed: number = 1;
  private gold: number = RULES.startingGold;
  private star: number = 0;
  private lives: number = RULES.startingLives;
  private maxLives: number = RULES.startingLives;
  private wave: number = 0;
  private wavePhase: WavePhase = 'prep';
  private prepRemaining: number = RULES.firstPrep;
  private prepTotal: number = RULES.firstPrep;
  private waveTime: number = 0;
  private waveResolved: number = 0;
  private waveSpawnTotal: number = 0;
  private waveHpMul = 1;
  private waveRewardMul = 1;
  private spawnSchedule: Array<{ enemy: EnemyId; at: number }> = [];
  private spawnIndex = 0;
  private blessingStacks: Partial<Record<BlessingId, number>> = {};
  private blessingOffers: BlessingChoice[] = [];
  private blessingPicks = 0;
  private shopOffers: ShopOffer[] = [];
  private shopRerolls = 0;
  private shopPurchases = 0;
  private rival: RivalState | null = null;
  private freeReclaim = false;
  private halfUpgrade = false;
  private doubleHarvest = false;

  private plots: PlotRuntime[] = [];
  private towers: TowerRuntime[] = [];
  private enemies: EnemyRuntime[] = [];
  private projectiles: Projectile[] = [];
  private beams: Beam[] = [];
  private selectedTool: { kind: 'crop' | 'tower'; id: CropId | TowerId } | null = null;
  private selectedTower: TowerRuntime | null = null;
  private activeReclaim: PlotRuntime | null = null;
  private targetPlot: PlotRuntime | null = null;
  private hoveredPlot: PlotRuntime | null = null;
  private lastPointer = { x: 0, y: 0 };
  private previewRange: Mesh;
  private arrowGeo = new ConeGeometry(0.065, 0.38, 4);
  private mortarGeo = new SphereGeometry(0.16, 6, 4);
  private arrowMat = new MeshStandardMaterial({ color: 0xffe2a1, emissive: 0xa86c14, emissiveIntensity: 0.5, roughness: 0.5 });
  private mortarMat = new MeshStandardMaterial({ color: 0xff8b52, emissive: 0x8f2d10, emissiveIntensity: 0.55, roughness: 0.7 });
  private helpPausedRun = false;
  private readonly isTouchDevice =
    window.matchMedia('(pointer: coarse)').matches ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches);

  private stats: GameStats = {
    kills: 0,
    harvestedGold: 0,
    harvestedStar: 0,
    planted: 0,
    towersBuilt: 0,
    leaks: 0,
    playSeconds: 0,
    reclaimed: 0,
    merges: 0,
    blessings: 0,
  };

  private save: CachedSave;
  private accumulator = 0;
  private debugHold = false;
  private lastTime = 0;
  private hudTimer = 0;
  private runTime = 0;
  private lastHitSound = 0;
  private lastShotSound = 0;
  private lastErrorToast = 0;
  private promptTimer = 0;

  constructor(canvas: HTMLCanvasElement, art: ArtProvider, environment: EnvironmentAssets | null) {
    this.canvas = canvas;
    this.art = art;
    this.world = new World(canvas, environment);
    this.particles = new ParticleSystem(this.world.scene);
    this.floaters = new FloatingTexts(this.uiFloatingLayer());
    this.enemyBarLayer = this.getLayer('enemy-bar-layer');
    this.save = readSave();
    this.audio = new AudioEngine(this.save.muted);
    this.ui = new GameUI(this.buildActions());
    this.ui.onHelpClosed = () => this.closeHelp();
    this.ui.setMuted(this.save.muted);
    this.player = new Player(
      this.world.camera,
      canvas,
      (x, z) => this.resolvePlayer(x, z),
      {
        joystick: document.getElementById('joystick'),
        joystickKnob: document.getElementById('joystick-knob'),
      },
      () => this.interact(),
    );
    this.world.scene.add(this.player.rig.group);
    this.player.setAvatarVisible(false);
    this.player.setMode('overview');
    this.player.setEnabled(false);
    this.previewRange = this.makeRangeRing(0xa8c97b, 1);
    this.previewRange.visible = false;
    this.world.scene.add(this.previewRange);
    this.ui.setSpeedLabel(1);
    this.ui.setCameraMode('overview');
    this.ui.setInteractPrompt(null);
    this.ui.setTouchControlsVisible(false);
    this.ui.setCrosshair(false);
    this.resetPlots();
    this.bindInput();
    this.bindKeyboard();
    this.bindVisibility();
    this.world.setCameraMode('orbit');
    this.world.setMenuMode(true);
    this.world.updateAmbient(0);
    this.world.render();
    this.phase = 'menu';
    this.ui.showMenu(this.save.bestWave, this.save.victories, this.save.versusWins, this.save.versusBestWave);
    requestAnimationFrame(() => {
      this.ui.setLoading(1, '准备就绪');
      window.setTimeout(() => this.ui.hideLoading(), 180);
    });
    this.installDebugApi();
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private uiFloatingLayer() {
    const layer = document.getElementById('float-layer');
    if (!layer) throw new Error('Missing #float-layer');
    return layer;
  }

  private getLayer(id: string) {
    const layer = document.getElementById(id);
    if (!layer) throw new Error(`Missing #${id}`);
    return layer;
  }

  private buildActions(): UIActions {
    return {
      start: () => this.startGame('classic'),
      startVersus: () => this.startGame('versus'),
      resume: () => this.resumeGame(),
      restart: () => this.startGame(this.runMode),
      quitToMenu: () => this.goToMenu(),
      selectCrop: (id) => this.selectCrop(id),
      selectTower: (id) => this.selectTower(id),
      interact: () => this.interact(),
      toggleCamera: () => this.toggleCameraMode(),
      nextWave: () => this.startNextWave(true),
      togglePause: () => this.togglePause(),
      toggleSpeed: () => this.toggleSpeed(),
      toggleSound: () => this.toggleSound(),
      showHelp: () => this.openHelp(),
      upgradeTower: () => this.upgradeSelectedTower(),
      mergeTower: () => this.mergeSelectedTower(),
      sellTower: () => this.sellSelectedTower(),
      closeInspector: () => this.clearTowerSelection(),
      chooseBlessing: (id) => this.chooseBlessing(id as BlessingId),
      buyShopItem: (id) => this.buyShopItem(id as ShopItemId),
      rerollShop: () => this.rerollShop(),
      closeShop: () => this.closeShop(),
      retry: () => this.startGame(this.runMode),
    };
  }

  private resolvePlayer(x: number, z: number) {
    const resolved = this.world.resolvePlayer(x, z);
    // Tower footings are solid; wild/farmland plots are walkable.
    let px = resolved.x;
    let pz = resolved.z;
    for (const tower of this.towers) {
      const dx = px - tower.plot.x;
      const dz = pz - tower.plot.z;
      const distance = Math.hypot(dx, dz);
      const min = 1.72 + WORLD.player.radius;
      if (distance < min && distance > 0.0001) {
        px = tower.plot.x + (dx / distance) * min;
        pz = tower.plot.z + (dz / distance) * min;
      }
    }
    return { x: px, z: pz };
  }

  /* ───────────────────────────── lifecycle ───────────────────────────── */

  private startGame(mode: RunMode = 'classic') {
    if (this.phase === 'loading') return;
    this.runMode = mode;
    const versus = mode === 'versus';
    this.audio.init();
    this.audio.setMuted(this.save.muted);
    this.clearDynamicWorld();
    this.resetPlots();
    this.gold = versus ? VERSUS_RULES.startingGold : RULES.startingGold;
    this.star = 0;
    this.maxLives = versus ? VERSUS_RULES.startingLives : RULES.startingLives;
    this.lives = this.maxLives;
    this.wave = 0;
    this.wavePhase = 'prep';
    this.prepRemaining = versus ? VERSUS_RULES.firstPrep : RULES.firstPrep;
    this.prepTotal = this.prepRemaining;
    this.waveTime = 0;
    this.waveResolved = 0;
    this.waveSpawnTotal = 0;
    this.waveHpMul = 1;
    this.waveRewardMul = 1;
    this.spawnSchedule = [];
    this.spawnIndex = 0;
    this.selectedTool = null;
    this.selectedTower = null;
    this.targetPlot = null;
    this.hoveredPlot = null;
    this.accumulator = 0;
    this.runTime = 0;
    this.helpPausedRun = false;
    this.blessingStacks = {};
    this.blessingOffers = [];
    this.blessingPicks = 0;
    this.shopOffers = [];
    this.shopRerolls = 0;
    this.shopPurchases = 0;
    this.rival = versus ? this.makeRival() : null;
    this.freeReclaim = false;
    this.halfUpgrade = false;
    this.doubleHarvest = false;
    this.stats = {
      kills: 0,
      harvestedGold: 0,
      harvestedStar: 0,
      planted: 0,
      towersBuilt: 0,
      leaks: 0,
      playSeconds: 0,
      reclaimed: 0,
      merges: 0,
      blessings: 0,
    };
    this.ui.hideMenu();
    this.ui.hideIntermission();
    this.ui.hideEnd();
    this.ui.hidePause();
    this.ui.hideHelp();
    this.ui.showGameHud();
    this.ui.setSelectedTool(null);
    this.ui.hideInspector();
    this.ui.hideTooltip();
    this.ui.setRival(this.rival, this.lives);
    this.ui.setBlessings([]);
    this.world.setMenuMode(false);
    this.world.setCameraMode('first');
    this.player.reset();
    this.player.setAvatarVisible(true);
    this.player.setEnabled(true);
    this.mode = 'first';
    this.ui.setCameraMode('first');
    this.ui.setCrosshair(true);
    if (versus) {
      this.ui.showBanner(
        '对垒 · 第 1 波准备',
        `${this.rival?.name ?? '对手'}也在守田`,
        '八波定胜负。第 1–7 波后三选一季令；第 2、4、6 波后行商来访。先失去全部生命者败。',
        false,
        4800,
      );
    } else {
      this.ui.showBanner(
        '第 1 波准备',
        '先把荒地变成麦田',
        '走到地块旁按 E 开垦，再播种。金币来自收获，塔要建在能照看石径的地块上。',
        false,
        4200,
      );
    }
    this.previewRange.visible = false;
    this.phase = 'playing';
    this.ui.setResources(this.gold, this.star, this.lives, this.maxLives, 0, this.plots.length);
    this.updateHudNow();
    this.updateInteractionPrompt();
    this.audio.play('click');
  }

  private resumeGame() {
    this.ui.hidePause();
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.ui.showGameHud();
      this.player.setEnabled(this.mode === 'first');
      this.updateInteractionPrompt();
    }
  }

  private togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.player.setEnabled(false);
      this.player.releasePointer();
      this.ui.showPause();
      this.ui.hideTooltip();
      this.ui.hideInspector();
      this.ui.setSelectedTool(null);
      this.ui.setInteractPrompt(null);
      this.ui.setTouchControlsVisible(false);
      this.selectedTool = null;
      this.hoveredPlot = null;
      this.previewRange.visible = false;
      this.clearHighlights();
      this.audio.play('click');
    } else if (this.phase === 'paused') {
      this.resumeGame();
    }
  }

  private openHelp() {
    if (this.phase === 'playing') {
      this.helpPausedRun = true;
      this.phase = 'paused';
      this.player.setEnabled(false);
      this.player.releasePointer();
    }
    this.ui.showHelp();
    this.ui.hideTooltip();
    this.ui.setInteractPrompt(null);
    this.ui.setTouchControlsVisible(false);
  }

  private closeHelp() {
    if (this.helpPausedRun && this.phase === 'paused') {
      this.phase = 'playing';
      this.helpPausedRun = false;
      this.player.setEnabled(this.mode === 'first');
      this.updateInteractionPrompt();
    }
  }

  private goToMenu() {
    this.clearDynamicWorld();
    this.clearHighlights();
    this.ui.hideEnd();
    this.ui.hidePause();
    this.ui.hideHelp();
    this.ui.hideIntermission();
    this.ui.setRival(null);
    this.ui.setBlessings([]);
    this.ui.hideGameHud();
    this.ui.setInteractPrompt(null);
    this.ui.setTouchControlsVisible(false);
    this.ui.setCrosshair(false);
    this.ui.showMenu(this.save.bestWave, this.save.victories, this.save.versusWins, this.save.versusBestWave);
    this.world.setMenuMode(true);
    this.world.setCameraMode('orbit');
    this.world.resetCamera(true);
    this.player.setEnabled(false);
    this.player.setMode('overview');
    this.player.setAvatarVisible(false);
    this.mode = 'overview';
    this.phase = 'menu';
  }

  private endGame(victory: boolean, reason: 'cleared' | 'lives' | 'rival' | 'compare' = 'cleared') {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = victory ? 'victory' : 'defeat';
    this.player.setEnabled(false);
    this.player.releasePointer();
    this.clearTowerSelection();
    this.selectedTool = null;
    this.ui.setSelectedTool(null);
    this.ui.setInteractPrompt(null);
    this.ui.setTouchControlsVisible(false);
    this.ui.setCrosshair(false);
    this.ui.hideIntermission();
    this.previewRange.visible = false;
    this.clearHighlights();
    this.ui.hideTooltip();
    this.ui.hideInspector();
    this.clearTargetPlot();
    const versus = this.runMode === 'versus';
    const total = this.totalWaves();
    const reachedWave =
      reason === 'rival' || reason === 'lives' || reason === 'compare'
        ? Math.max(1, this.wave)
        : victory
          ? total
          : Math.max(1, this.wave);
    if (versus) {
      this.save.versusBestWave = Math.max(this.save.versusBestWave, reachedWave);
      if (victory) this.save.versusWins += 1;
    } else {
      this.save.bestWave = Math.max(this.save.bestWave, reachedWave);
      if (victory) this.save.victories += 1;
    }
    writeSave(this.save);
    this.ui.showEnd({
      victory,
      mode: this.runMode,
      reason,
      wave: reachedWave,
      total,
      kills: this.stats.kills,
      harvestedGold: Math.round(this.stats.harvestedGold),
      towersBuilt: this.stats.towersBuilt,
      seconds: this.stats.playSeconds,
      record: versus
        ? `对垒纪录：第 ${this.save.versusBestWave} 波 · ${this.save.versusWins} 胜`
        : `最佳纪录：第 ${this.save.bestWave} 波${this.save.victories > 0 ? ` · ${this.save.victories} 次守成` : ''}`,
      lives: this.lives,
      maxLives: this.maxLives,
      blessings: this.stats.blessings,
      merges: this.stats.merges,
      rivalName: this.rival?.name,
      rivalLives: this.rival?.lives ?? 0,
    });
    this.player.setMode('overview');
    this.player.setAvatarVisible(true);
    this.world.setMenuMode(true);
    this.world.resetCamera(true);
    this.mode = 'overview';
    this.ui.setCameraMode('overview');
    this.audio.play(victory ? 'victory' : 'defeat');
    if (victory) {
      const title = versus ? (reason === 'rival' ? '对手先失守' : '对垒胜利') : '山野重归宁静';
      const sub =
        reason === 'rival'
          ? `${this.rival?.name ?? '对手'}的田先失守了。你守到第 ${Math.max(1, this.wave)} 波。`
          : `你坚守了 ${timeText(this.stats.playSeconds)}，守住了所有农田。`;
      this.ui.showBanner(versus ? '对垒' : '守成', title, sub, false, 4800);
      for (let i = 0; i < 5; i++) {
        this.particles.spawn(
          new Vector3(WORLD.core.x + (Math.random() - 0.5) * 6, 1 + Math.random() * 4, WORLD.core.z + (Math.random() - 0.5) * 6),
          0xf3c455,
          18,
          { speed: 3.4, life: 2.4, size: 0.15, gravity: 1.1, up: 3.8 },
        );
      }
    } else if (versus) {
      this.ui.showBanner('对垒', '田野先失守了', `${this.rival?.name ?? '对手'}还守着 ${this.rival?.lives ?? 0} 命。下季再战。`, true, 4200);
    }
  }

  /* ───────────────────────────── season helpers ───────────────────────────── */

  private wavesForRun(): WaveDef[] {
    return this.runMode === 'versus' ? VERSUS_WAVES : WAVES;
  }

  private totalWaves() {
    return this.wavesForRun().length;
  }

  private prepDuration() {
    return this.runMode === 'versus' ? VERSUS_RULES.prepBetweenWaves : RULES.prepBetweenWaves;
  }

  private makeRival(): RivalState {
    const seed = Math.floor(Math.random() * 100000);
    const name = VERSUS_RULES.rivalNames[seed % VERSUS_RULES.rivalNames.length];
    const title = VERSUS_RULES.rivalTitles[(seed >> 3) % VERSUS_RULES.rivalTitles.length];
    const skill = 0.9 + ((seed >> 5) % 5) * 0.05;
    const mistakeWave = seed % 2 === 0 ? 1 + ((seed >> 2) % 8) : null;
    return {
      name,
      title,
      lives: VERSUS_RULES.rivalStartLives,
      maxLives: VERSUS_RULES.rivalStartLives,
      wave: 0,
      harvest: 0,
      skill,
      mistakeWave,
      alive: true,
    };
  }

  private stack(id: BlessingId) {
    return this.blessingStacks[id] ?? 0;
  }

  private harvestMul() {
    return 1 + 0.15 * this.stack('harvest');
  }

  private towerCooldownMul() {
    return Math.max(0.65, 1 - 0.07 * this.stack('gale'));
  }

  private towerRangeMul() {
    return 1 + 0.08 * this.stack('hawk');
  }

  private reclaimMul() {
    return Math.max(0.7, 1 - 0.1 * this.stack('soil'));
  }

  private cropGrowMul() {
    return Math.max(0.76, 1 - 0.08 * this.stack('rain'));
  }

  private upgradeGoldMul() {
    return Math.max(0.7, 1 - 0.15 * this.stack('workshop'));
  }

  private shopPriceMul() {
    return Math.max(0.7, 1 - 0.15 * this.stack('bargain'));
  }

  private waveGoldMul() {
    return 1 + 0.4 * this.stack('spoils');
  }

  private seedChance() {
    return 0.2 * this.stack('seed');
  }

  private blessingEntries() {
    return (Object.keys(this.blessingStacks) as BlessingId[])
      .filter((id) => this.stack(id) > 0)
      .map((id) => ({ icon: BLESSINGS[id].icon, name: BLESSINGS[id].name, stacks: this.stack(id) }));
  }

  private refreshBlessingUi() {
    this.ui.setBlessings(this.blessingEntries());
    this.refreshTowerBuffs();
    this.ui.setRival(this.rival, this.lives);
  }

  private pickBlessings(): BlessingChoice[] {
    const pool = (Object.keys(BLESSINGS) as BlessingId[]).filter(
      (id) => this.stack(id) < BLESSINGS[id].maxStacks,
    );
    const weights = { common: 60, rare: 30, epic: 10 } as const;
    const chosen: BlessingChoice[] = [];
    while (chosen.length < 3 && pool.length > 0) {
      const total = pool.reduce((sum, id) => sum + weights[BLESSINGS[id].rarity], 0);
      let roll = Math.random() * total;
      let picked = pool[pool.length - 1];
      for (const id of pool) {
        roll -= weights[BLESSINGS[id].rarity];
        if (roll <= 0) {
          picked = id;
          break;
        }
      }
      pool.splice(pool.indexOf(picked), 1);
      chosen.push({ def: BLESSINGS[picked], stacks: this.stack(picked) });
    }
    return chosen;
  }

  private openBlessing() {
    this.blessingOffers = this.pickBlessings();
    if (this.blessingOffers.length === 0) {
      this.resumeFromIntermission();
      return;
    }
    this.phase = 'blessing';
    this.player.setEnabled(false);
    this.player.releasePointer();
    this.selectedTool = null;
    this.ui.setSelectedTool(null);
    this.ui.setInteractPrompt(null);
    this.ui.setTouchControlsVisible(false);
    this.ui.setCrosshair(false);
    this.previewRange.visible = false;
    this.clearHighlights();
    this.ui.hideTooltip();
    this.ui.hideInspector();
    this.clearTowerSelection();
    this.ui.showBlessings(this.blessingOffers, this.wave, this.totalWaves(), this.blessingPicks + 1);
    this.audio.play('star');
  }

  private chooseBlessing(id: BlessingId) {
    if (this.phase !== 'blessing') return;
    const choice = this.blessingOffers.find((entry) => entry.def.id === id);
    if (!choice) return;
    this.blessingStacks[id] = this.stack(id) + 1;
    if (id === 'bulwark') {
      this.maxLives += 2;
      this.lives = Math.min(this.maxLives, this.lives + 2);
    }
    this.stats.blessings += 1;
    this.blessingPicks += 1;
    this.blessingOffers = [];
    this.ui.hideBlessings();
    this.ui.toast(`季令：${choice.def.name} ×${this.stack(id)}`, 'star');
    this.refreshBlessingUi();
    this.updateHudNow();
    this.afterBlessing();
  }

  private afterBlessing() {
    if (VERSUS_RULES.shopWaves.includes(this.wave as (typeof VERSUS_RULES.shopWaves)[number])) {
      this.openShop();
    } else {
      this.resumeFromIntermission();
    }
  }

  private openShop() {
    this.shopRerolls = 0;
    this.shopPurchases = 0;
    this.shopOffers = this.makeShopOffers();
    this.phase = 'shop';
    this.player.setEnabled(false);
    this.player.releasePointer();
    this.ui.setInteractPrompt(null);
    this.ui.setTouchControlsVisible(false);
    this.ui.setCrosshair(false);
    this.ui.showShop(this.shopOffers, this.wave, this.shopRerollCost(), this.gold, this.shopPurchases);
    this.audio.play('click');
  }

  private shopRerollCost() {
    return VERSUS_RULES.shopRerollBase + this.shopRerolls * VERSUS_RULES.shopRerollStep;
  }

  private makeShopOffers(): ShopOffer[] {
    const pool = Object.keys(SHOP_ITEMS) as ShopItemId[];
    const count = 3 + this.stack('merchant');
    const offers: ShopOffer[] = [];
    while (offers.length < count && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      const id = pool.splice(index, 1)[0];
      const item = SHOP_ITEMS[id];
      const price = Math.round(item.basePrice * (1 + 0.06 * this.wave) * this.shopPriceMul());
      offers.push({ item, price, sold: false });
    }
    return offers;
  }

  private showCurrentShop() {
    this.ui.showShop(this.shopOffers, this.wave, this.shopRerollCost(), this.gold, this.shopPurchases);
  }

  private buyShopItem(id: ShopItemId) {
    if (this.phase !== 'shop') return;
    if (this.shopPurchases >= 2) {
      this.nudgeError('行商每次只卖两件：留点金币给下一波');
      return;
    }
    const offer = this.shopOffers.find((entry) => entry.item.id === id);
    if (!offer || offer.sold) return;
    if (this.gold < offer.price) {
      this.nudgeError(`金币不足：${offer.item.name}需要 ${offer.price} 金币`);
      return;
    }
    this.gold -= offer.price;
    offer.sold = true;
    this.shopPurchases += 1;
    switch (id) {
      case 'starVial':
        this.star += 2;
        break;
      case 'lifeCharm':
        this.maxLives += 2;
        this.lives = Math.min(this.maxLives, this.lives + 2);
        break;
      case 'deed':
        this.freeReclaim = true;
        break;
      case 'iron':
        this.halfUpgrade = true;
        break;
      case 'seedPouch':
        this.doubleHarvest = true;
        break;
    }
    this.ui.toast(`行商：${offer.item.name}（-${offer.price} 金币）`, 'gold');
    this.audio.play('harvest');
    this.refreshBlessingUi();
    this.updateHudNow();
    this.showCurrentShop();
  }

  private rerollShop() {
    if (this.phase !== 'shop') return;
    const cost = this.shopRerollCost();
    if (this.gold < cost) {
      this.nudgeError(`刷新需要 ${cost} 金币`);
      return;
    }
    this.gold -= cost;
    this.shopRerolls += 1;
    this.shopOffers = this.makeShopOffers();
    this.ui.toast(`行商换了批货（-${cost} 金币）`, 'default');
    this.updateHudNow();
    this.showCurrentShop();
  }

  private closeShop() {
    if (this.phase !== 'shop') return;
    this.ui.hideShop();
    this.resumeFromIntermission();
  }

  private resumeFromIntermission() {
    this.ui.hideBlessings();
    this.ui.hideShop();
    this.phase = 'playing';
    this.accumulator = 0;
    this.player.setEnabled(this.mode === 'first');
    this.ui.setCrosshair(this.mode === 'first');
    this.ui.setRival(this.rival, this.lives);
    this.ui.setBlessings(this.blessingEntries());
    this.updateHudNow();
    this.updateInteractionPrompt();
    this.ui.showBanner(
      `第 ${this.wave + 1} 波准备`,
      this.wave === 0 ? '先把荒地变成麦田' : '下一波正在集结',
      this.runMode === 'versus' ? '补种、修塔、开垦；对垒还在继续。' : '走到地块旁按 E 开垦、播种或建塔。',
      false,
      2500,
    );
  }

  private applyRivalWave() {
    if (!this.rival || !this.rival.alive) return;
    const base = VERSUS_RULES.rivalLeaks[this.wave - 1] ?? 2;
    let leaks = Math.max(0, Math.round(base * this.rival.skill));
    if (this.rival.mistakeWave === this.wave) leaks += 1;
    const lead = this.lives - this.rival.lives;
    // Gentle rubber band: only a far-behind player gets a small break. A rival
    // that is behind does not magically stabilise. See docs/design-v2.md §PvP.
    if (lead <= -4) leaks = Math.min(4, leaks + 1);
    this.rival.lives = Math.max(0, this.rival.lives - leaks);
    this.rival.wave = this.wave;
    this.rival.harvest += 40 + this.wave * 20;
    this.rival.alive = this.rival.lives > 0;
    this.ui.setRival(this.rival, this.lives);
    if (leaks > 0) {
      this.ui.toast(`对垒战报：${this.rival.name}漏掉 ${leaks} 只，剩 ${this.rival.lives} 命`, 'warn');
    } else {
      this.ui.toast(`对垒战报：${this.rival.name}守住了这一波`, 'default');
    }
    if (!this.rival.alive) {
      this.ui.toast(`${this.rival.name}的守望之种熄灭了！`, 'gold');
      this.endGame(true, 'rival');
    }
  }

  private finishVersus() {
    if (!this.rival) {
      this.endGame(true, 'cleared');
      return;
    }
    if (!this.rival.alive) {
      this.endGame(true, 'rival');
      return;
    }
    if (this.lives > this.rival.lives) {
      this.endGame(true, 'compare');
    } else if (this.lives < this.rival.lives) {
      this.endGame(false, 'compare');
    } else {
      this.endGame(this.stats.harvestedGold >= this.rival.harvest, 'compare');
    }
  }

  private refreshTowerBuffs() {
    for (const tower of this.towers) {
      tower.rangeRing.scale.setScalar(tower.range * this.towerRangeMul());
    }
    if (this.selectedTower) this.showTowerInspector(this.selectedTower);
  }

  private findMergePartner(tower: TowerRuntime): TowerRuntime | null {
    if (tower.level >= 3) return null;
    return (
      this.towers.find(
        (other) =>
          other !== tower &&
          other.id === tower.id &&
          other.level === tower.level &&
          Math.abs(other.plot.col - tower.plot.col) + Math.abs(other.plot.row - tower.plot.row) === 1,
      ) ?? null
    );
  }

  private applyTowerLevel(tower: TowerRuntime, nextLevel: 2 | 3) {
    const def = TOWERS[tower.id];
    tower.group.removeFromParent();
    const art = this.art.tower(tower.id, nextLevel);
    art.group.position.set(0, 0.2, 0);
    art.group.rotation.y = 0.35 + ((tower.plot.index * 1.7) % 6.28);
    this.world.plotVisuals[tower.plot.index].group.add(art.group);
    tower.group = art.group;
    tower.level = nextLevel;
    const stats = def.levels[nextLevel - 1];
    tower.damage = stats.damage;
    tower.range = stats.range;
    tower.splash = stats.splash;
    tower.slow = stats.slow;
    tower.slowDuration = stats.slowDuration;
    tower.fireCooldown = stats.cooldown;
    tower.cooldown = Math.min(tower.cooldown, stats.cooldown * this.towerCooldownMul());
    tower.rangeRing.scale.setScalar(tower.range * this.towerRangeMul());
  }

  private mergeTower(tower: TowerRuntime) {
    if (this.phase !== 'playing') return false;
    if (tower.level >= 3) {
      this.nudgeError('这座塔已经到最高等级，不能再合成');
      return false;
    }
    const partner = this.findMergePartner(tower);
    if (!partner) {
      this.nudgeError('合成需要一座相邻的同类型、同等级防御塔');
      return false;
    }
    const plot = this.plots[partner.plot.index];
    const refund = Math.round(partner.investedGold * (this.stack('confluence') > 0 ? 0.5 : 0));
    partner.group.removeFromParent();
    partner.rangeRing.removeFromParent();
    this.towers = this.towers.filter((entry) => entry !== partner);
    if (plot) {
      plot.state = plot.underlying;
      plot.scorched = false;
      plot.crop = null;
      this.syncPlot(plot);
    }
    this.gold += refund;
    tower.investedGold += partner.investedGold;
    tower.investedStar += partner.investedStar;
    this.applyTowerLevel(tower, (tower.level + 1) as 2 | 3);
    this.stats.merges += 1;
    this.particles.burstBuild(new Vector3(tower.plot.x, 0.8, tower.plot.z));
    this.audio.play('upgrade');
    this.ui.toast(
      `合成成功：${TOWERS[tower.id].name} Lv.${tower.level}${refund > 0 ? ` · 返还 ${refund} 金币` : ''}`,
      'gold',
    );
    this.showTowerInspector(tower);
    this.updateHudNow();
    return true;
  }

  private mergeSelectedTower() {
    if (this.selectedTower) this.mergeTower(this.selectedTower);
  }

  private toggleSpeed() {
    if (this.phase !== 'playing') return;
    this.speed = this.speed === 1 ? 2 : 1;
    this.ui.setSpeedLabel(this.speed);
    this.ui.toast(this.speed === 2 ? '双倍速进行中' : '恢复常规速度', 'default');
    this.audio.play('click');
  }

  private toggleSound() {
    this.save.muted = !this.save.muted;
    this.audio.setMuted(this.save.muted);
    this.ui.setMuted(this.save.muted);
    writeSave(this.save);
    if (!this.save.muted) {
      this.audio.init();
      this.audio.play('click');
    }
  }

  private toggleCameraMode() {
    if (this.phase !== 'playing') return;
    if (this.mode === 'first') {
      this.player.releasePointer();
      this.player.setEnabled(false);
      this.player.setMode('overview');
      this.world.setOverviewFromPlayer(this.player.position, this.player.yaw);
      this.mode = 'overview';
      this.ui.setCameraMode('overview');
      this.ui.setInteractPrompt(null);
      this.ui.setCrosshair(false);
      this.ui.setTouchControlsVisible(false);
      this.ui.hideTooltip();
      this.previewRange.visible = false;
      this.clearHighlights();
      this.audio.play('click');
      this.ui.toast('俯瞰视角：滚轮缩放、拖动旋转；再按 V 返回第一人称', 'default');
    } else {
      this.world.setCameraMode('first');
      this.player.setMode('first');
      this.player.setEnabled(true);
      this.mode = 'first';
      this.ui.setCameraMode('first');
      this.ui.setCrosshair(true);
      this.ui.hideTooltip();
      this.audio.play('click');
      this.ui.toast('第一人称：点击画面锁定鼠标，E 交互', 'default');
      this.updateInteractionPrompt();
    }
  }

  /* ───────────────────────────── plots / land ───────────────────────────── */

  private resetPlots() {
    this.activeReclaim = null;
    this.plots = [];
    for (const view of this.world.plotVisuals) {
      this.clearCropVisual(view);
      view.highlight.visible = false;
      view.matureGlow.visible = false;
      view.scorched.visible = false;
      view.wild.scale.setScalar(1);
      view.wild.position.set(0, 0, 0);
      view.farm.scale.setScalar(1);
      view.farm.position.set(0, 0, 0);
      const plot: PlotRuntime = {
        spec: view.spec,
        state: 'wild',
        underlying: 'wild',
        scorched: false,
        crop: null,
        reclaim: null,
        group: view.group,
      };
      this.plots.push(plot);
      this.world.syncPlotVisual(plot, view);
    }
  }

  private viewFor(index: number): PlotVisual {
    return this.world.plotVisuals[index];
  }

  private reclaimedCount() {
    return this.plots.filter((plot) => plot.underlying === 'farmland').length;
  }

  private reclaimCost() {
    if (this.freeReclaim) return 0;
    const count = this.reclaimedCount();
    const base = Math.min(RULES.reclaimMaxCost, RULES.reclaimBaseCost + count * RULES.reclaimStep);
    return Math.max(1, Math.round(base * this.reclaimMul()));
  }

  private syncPlot(plot: PlotRuntime) {
    this.world.syncPlotVisual(plot, this.viewFor(plot.spec.index));
  }

  private clearCropVisual(view: PlotVisual) {
    while (view.cropAnchor.children.length) view.cropAnchor.children[0].removeFromParent();
  }

  private setCropVisual(plot: PlotRuntime, stage: CropStage) {
    if (!plot.crop) return;
    const view = this.viewFor(plot.spec.index);
    this.clearCropVisual(view);
    const art = this.art.crop(plot.crop.type, stage, stage === 3);
    art.group.rotation.y = ((plot.spec.index * 2.399) % (Math.PI * 2)) + 0.4;
    art.group.scale.setScalar(WORLD.farm.cropScale * (0.94 + ((plot.spec.index * 7) % 5) * 0.016));
    view.cropAnchor.add(art.group);
  }

  private plantCrop(index: number, type: CropId, silent = false) {
    if (this.phase !== 'playing') return false;
    const plot = this.plots[index];
    if (!plot) return false;
    if (plot.state !== 'farmland') {
      if (!silent) this.nudgeError('这块地还不是农田：先按 E 开垦');
      return false;
    }
    if (plot.scorched) {
      if (!silent) this.nudgeError('焦土需要先修复');
      return false;
    }
    if (plot.reclaim) return false;
    if (plot.crop) {
      if (plot.crop.mature) return this.harvestPlot(index);
      return false;
    }
    const def = CROPS[type];
    if (this.gold < def.cost) {
      this.nudgeError(`金币不足：${def.name}需要 ${def.cost} 金币`);
      return false;
    }
    this.gold -= def.cost;
    this.stats.planted += 1;
    plot.crop = { type, elapsed: 0, stage: 0, mature: false };
    this.setCropVisual(plot, 0);
    this.syncPlot(plot);
    const pos = new Vector3(plot.spec.x, 0.5, plot.spec.z);
    this.particles.spawn(pos, def.accent, 8, { speed: 1.6, life: 0.55, size: 0.075, gravity: 3.5, up: 1.5 });
    this.floaters.spawn(`-${def.cost}`, new Vector3(plot.spec.x, 1.0, plot.spec.z), 'warn');
    this.audio.play('plant');
    this.updateHudNow();
    return true;
  }

  private harvestPlot(index: number, silent = false) {
    const plot = this.plots[index];
    if (!plot?.crop?.mature) return false;
    const def = CROPS[plot.crop.type];
    const forcedDouble = this.doubleHarvest;
    if (forcedDouble) this.doubleHarvest = false;
    const doubled = forcedDouble || Math.random() < this.seedChance();
    const goldGain = Math.round(def.yieldGold * this.harvestMul() * (doubled ? 2 : 1));
    const starGain =
      def.yieldStar > 0 ? def.yieldStar + this.stack('starlight') : 0;
    this.gold += goldGain;
    this.star += starGain;
    this.stats.harvestedGold += goldGain;
    this.stats.harvestedStar += starGain;
    const pos = new Vector3(plot.spec.x, 0.8, plot.spec.z);
    this.particles.burstHarvest(pos, def.color, starGain > 0);
    this.floaters.spawn(`+${goldGain}`, new Vector3(plot.spec.x, 1.3, plot.spec.z), 'gold');
    if (starGain > 0) {
      this.floaters.spawn(`+${starGain} 星辉`, new Vector3(plot.spec.x + 0.35, 1.8, plot.spec.z), 'star');
      this.audio.play('star');
    } else {
      this.audio.play('harvest');
    }
    plot.crop = null;
    this.clearCropVisual(this.viewFor(plot.spec.index));
    this.syncPlot(plot);
    this.updateHudNow();
    if (!silent && starGain > 0) {
      this.ui.toast(`收获 ${def.name}：+${goldGain} 金币，+${starGain} 星辉`, 'star');
    } else if (!silent && doubled) {
      this.ui.toast(`双生麦穗：${def.name}收获翻倍（+${goldGain} 金币）`, 'gold');
    }
    return true;
  }

  private harvestAll() {
    if (this.phase !== 'playing') return;
    const mature = this.plots.filter((plot) => plot.crop?.mature);
    if (mature.length === 0) {
      this.ui.toast('还没有成熟的作物', 'default');
      this.audio.play('error');
      return;
    }
    for (const plot of mature) this.harvestPlot(plot.spec.index, true);
    this.ui.toast(`收获了 ${mature.length} 块农田`, 'gold');
    this.updateHudNow();
  }

  private startReclaim(index: number) {
    if (this.phase !== 'playing') return false;
    const plot = this.plots[index];
    if (!plot || plot.state !== 'wild') return false;
    if (this.activeReclaim) {
      this.nudgeError('先把正在开垦的地块整理完');
      return false;
    }
    const cost = this.reclaimCost();
    const free = this.freeReclaim;
    if (!free && this.gold < cost) {
      this.nudgeError(`金币不足：开垦这块荒地需要 ${cost} 金币`);
      return false;
    }
    if (free) this.freeReclaim = false;
    else this.gold -= cost;
    plot.reclaim = { elapsed: 0, total: RULES.reclaimDuration };
    this.activeReclaim = plot;
    const view = this.viewFor(plot.spec.index);
    view.farm.visible = true;
    view.farm.scale.setScalar(0.35);
    view.wild.scale.setScalar(1);
    view.highlight.visible = true;
    if (!free) this.floaters.spawn(`-${cost}`, new Vector3(plot.spec.x, 1.0, plot.spec.z), 'warn');
    this.particles.spawn(new Vector3(plot.spec.x, 0.3, plot.spec.z), 0x9ac46b, 8, {
      speed: 1.6,
      life: 0.6,
      size: 0.075,
      gravity: 3,
      up: 1.6,
    });
    this.audio.play('plant');
    this.ui.toast(free ? '地契生效：这次开垦免费' : `开始开垦（-${cost} 金币），稍等片刻`, free ? 'gold' : 'default');
    this.updateHudNow();
    return true;
  }

  private finishReclaim(plot: PlotRuntime) {
    const view = this.viewFor(plot.spec.index);
    plot.reclaim = null;
    plot.state = 'farmland';
    plot.underlying = 'farmland';
    plot.scorched = false;
    plot.crop = null;
    this.activeReclaim = null;
    view.wild.visible = false;
    view.wild.scale.setScalar(1);
    view.wild.position.set(0, 0, 0);
    view.farm.visible = true;
    view.farm.scale.setScalar(1);
    view.farm.position.set(0, 0, 0);
    view.highlight.visible = false;
    this.syncPlot(plot);
    this.stats.reclaimed += 1;
    this.particles.spawn(new Vector3(plot.spec.x, 0.5, plot.spec.z), 0xd9b56d, 18, {
      speed: 2.6,
      life: 0.8,
      size: 0.1,
      gravity: 3.4,
      up: 2.2,
    });
    this.particles.spawn(new Vector3(plot.spec.x, 0.8, plot.spec.z), 0x9ac46b, 10, {
      speed: 1.8,
      life: 0.9,
      size: 0.08,
      gravity: 1.2,
      up: 2.4,
    });
    this.audio.play('harvest');
    this.ui.toast('荒地开垦完成，已经可以播种了', 'default');
    this.updateHudNow();
    this.updateInteractionPrompt();
  }

  private repairPlot(index: number) {
    const plot = this.plots[index];
    if (!plot || !plot.scorched) return false;
    const cost = WORLD.farm.repairCost;
    if (this.gold < cost) {
      this.nudgeError(`金币不足：修复焦土需要 ${cost} 金币`);
      return false;
    }
    this.gold -= cost;
    plot.scorched = false;
    this.syncPlot(plot);
    this.particles.spawn(new Vector3(plot.spec.x, 0.45, plot.spec.z), 0xa8c97b, 12, {
      speed: 2,
      life: 0.65,
      size: 0.08,
      gravity: 3,
      up: 1.8,
    });
    this.audio.play('build');
    this.ui.toast(`焦土已经修复（-${cost} 金币）`, 'default');
    this.updateHudNow();
    return true;
  }

  private trampleCrops(count: number) {
    const planted = this.plots.filter((plot) => plot.crop && plot.state === 'farmland' && !plot.scorched);
    if (planted.length === 0) return 0;
    const shuffled = [...planted].sort(() => Math.random() - 0.5);
    const destroyed = shuffled.slice(0, Math.min(count, shuffled.length));
    for (const plot of destroyed) {
      plot.crop = null;
      plot.scorched = true;
      this.clearCropVisual(this.viewFor(plot.spec.index));
      this.syncPlot(plot);
      this.particles.spawn(new Vector3(plot.spec.x, 0.55, plot.spec.z), 0x4a3d2f, 10, {
        speed: 1.6,
        life: 0.8,
        size: 0.11,
        gravity: 2,
        up: 1.4,
      });
      this.particles.spawn(new Vector3(plot.spec.x, 0.55, plot.spec.z), 0xef8056, 6, {
        speed: 2.2,
        life: 0.6,
        size: 0.07,
        gravity: 3.5,
        up: 2.2,
      });
    }
    return destroyed.length;
  }

  private updatePlots(dt: number) {
    this.runTime += dt;
    for (const plot of this.plots) {
      const view = this.viewFor(plot.spec.index);
      if (plot.reclaim) {
        plot.reclaim.elapsed += dt;
        const t = Math.min(1, plot.reclaim.elapsed / plot.reclaim.total);
        view.wild.scale.setScalar(Math.max(0.08, 1 - t * 0.92));
        view.farm.scale.setScalar(0.35 + t * 0.65);
        if (Math.random() < dt * 9) {
          this.particles.spawn(new Vector3(plot.spec.x + (Math.random() - 0.5) * 1.8, 0.25, plot.spec.z + (Math.random() - 0.5) * 1.8), 0x8d6a45, 2, {
            speed: 1.1,
            life: 0.55,
            size: 0.07,
            gravity: 2.5,
            up: 1.6,
          });
        }
        if (t >= 1) this.finishReclaim(plot);
        continue;
      }
      if (!plot.crop) continue;
      const def = CROPS[plot.crop.type];
      if (!plot.crop.mature) {
        plot.crop.elapsed += dt / this.cropGrowMul();
        const progress = Math.min(1, plot.crop.elapsed / def.growTime);
        const nextStage: CropStage = progress >= 1 ? 3 : progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
        const becameMature = nextStage === 3;
        if (nextStage !== plot.crop.stage) {
          plot.crop.stage = nextStage;
          plot.crop.mature = becameMature;
          this.setCropVisual(plot, nextStage);
          this.syncPlot(plot);
          if (becameMature) {
            this.particles.spawn(new Vector3(plot.spec.x, 0.65, plot.spec.z), def.accent, 5, {
              speed: 0.9,
              life: 0.55,
              size: 0.06,
              gravity: 2,
              up: 1.3,
            });
          }
        }
      }
      const visual = view.cropAnchor.children[0];
      if (visual) {
        visual.rotation.z = Math.sin(this.runTime * 1.6 + plot.spec.index * 1.7) * 0.025;
      }
    }
  }

  /* ───────────────────────────── towers ───────────────────────────── */

  private towerAt(plotIndex: number) {
    return this.towers.find((tower) => tower.plot.index === plotIndex) ?? null;
  }

  private makeRangeRing(color: number, opacity: number) {
    const geometry = new RingGeometry(0.982, 1, 72);
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false,
    });
    const ring = new Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.38;
    ring.visible = false;
    ring.renderOrder = 1;
    return ring;
  }

  private buildTower(plotIndex: number, type: TowerId) {
    if (this.phase !== 'playing') return false;
    const plot = this.plots[plotIndex];
    const view = this.world.plotVisuals[plotIndex];
    if (!plot || !view) return false;
    if (plot.state === 'tower') {
      const existing = this.towerAt(plotIndex);
      if (existing) this.selectTowerObject(existing);
      return false;
    }
    if (plot.scorched) {
      this.nudgeError('焦土上不能建塔：先按 E 修复');
      return false;
    }
    if (plot.crop) {
      const def = CROPS[plot.crop.type];
      this.nudgeError(plot.crop.mature ? `先收获这块地的${def.name}，再建塔` : `这块地的${def.name}还在长，先等它成熟`);
      return false;
    }
    if (plot.reclaim) return false;
    const def = TOWERS[type];
    if (this.star < def.starCost) {
      this.nudgeError(`星辉不足：${def.name}需要 ${def.starCost} 星辉（种植星辉花获得）`);
      return false;
    }
    if (this.gold < def.cost) {
      this.nudgeError(`金币不足：${def.name}需要 ${def.cost} 金币`);
      return false;
    }
    this.gold -= def.cost;
    this.star -= def.starCost;
    const levelDef = def.levels[0];
    const art = this.art.tower(type, 1);
    art.group.position.set(0, 0.2, 0);
    art.group.rotation.y = 0.35 + ((plotIndex * 1.7) % 6.28);
    view.group.add(art.group);
    const rangeRing = this.makeRangeRing(def.accent, 0.42);
    rangeRing.position.set(plot.spec.x, 0.36, plot.spec.z);
    rangeRing.scale.setScalar(levelDef.range);
    this.world.scene.add(rangeRing);
    const tower: TowerRuntime = {
      id: type,
      plot: plot.spec,
      level: 1,
      cooldown: 0,
      group: art.group,
      rangeRing,
      range: levelDef.range,
      damage: levelDef.damage,
      splash: levelDef.splash,
      slow: levelDef.slow,
      slowDuration: levelDef.slowDuration,
      fireCooldown: levelDef.cooldown,
      investedGold: def.cost,
      investedStar: def.starCost,
    };
    this.towers.push(tower);
    const resolved = this.resolvePlayer(this.player.position.x, this.player.position.z);
    this.player.position.set(resolved.x, 0, resolved.z);
    plot.underlying = plot.state === 'farmland' ? 'farmland' : 'wild';
    plot.state = 'tower';
    plot.crop = null;
    this.clearCropVisual(view);
    this.syncPlot(plot);
    this.stats.towersBuilt += 1;
    this.particles.burstBuild(new Vector3(plot.spec.x, 0.4, plot.spec.z));
    this.audio.play('build');
    this.ui.toast(`${def.name} 建成！占用了这块地，拆除后恢复${plot.underlying === 'farmland' ? '农田' : '荒地'}`, 'default');
    this.updateHudNow();
    this.updateInteractionPrompt();
    return true;
  }

  private upgradeTower(tower: TowerRuntime) {
    if (this.phase !== 'playing') return false;
    const def = TOWERS[tower.id];
    if (tower.level >= 3) return false;
    const nextLevel = (tower.level + 1) as 2 | 3;
    let goldCost = Math.round(def.upgradeGold[tower.level - 1] * this.upgradeGoldMul());
    if (this.halfUpgrade) goldCost = Math.ceil(goldCost / 2);
    const starCost = def.upgradeStar[tower.level - 1];
    if (this.gold < goldCost || this.star < starCost) {
      this.nudgeError(`升级 ${def.name} 需要 ${goldCost} 金币${starCost ? ` + ${starCost} 星辉` : ''}`);
      return false;
    }
    this.gold -= goldCost;
    this.star -= starCost;
    this.halfUpgrade = false;
    this.particles.burstBuild(new Vector3(tower.plot.x, 0.7, tower.plot.z));
    tower.investedGold += goldCost;
    tower.investedStar += starCost;
    this.applyTowerLevel(tower, nextLevel);
    this.audio.play('upgrade');
    this.ui.toast(`${def.name} 升至 Lv.${nextLevel}`, 'gold');
    this.showTowerInspector(tower);
    this.updateHudNow();
    return true;
  }

  private sellTower(tower: TowerRuntime) {
    const plot = this.plots[tower.plot.index];
    const goldRefund = Math.round(tower.investedGold * RULES.sellRefund);
    const starRefund = Math.floor(tower.investedStar * RULES.sellRefund);
    this.gold += goldRefund;
    this.star += starRefund;
    tower.group.removeFromParent();
    tower.rangeRing.removeFromParent();
    this.towers = this.towers.filter((entry) => entry !== tower);
    if (plot) {
      plot.state = plot.underlying;
      plot.scorched = false;
      plot.crop = null;
      this.syncPlot(plot);
    }
    this.clearTowerSelection();
    this.particles.spawn(new Vector3(tower.plot.x, 0.55, tower.plot.z), 0xd9c9a8, 12, {
      speed: 1.8,
      life: 0.75,
      size: 0.09,
      gravity: 4,
      up: 1.8,
    });
    this.audio.play('sell');
    this.ui.toast(
      `拆除防御塔：+${goldRefund} 金币${starRefund ? ` +${starRefund} 星辉` : ''}，地块恢复为${plot?.underlying === 'farmland' ? '农田' : '荒地'}`,
      'default',
    );
    this.updateHudNow();
    this.updateInteractionPrompt();
  }

  private upgradeSelectedTower() {
    if (this.selectedTower) this.upgradeTower(this.selectedTower);
  }

  private sellSelectedTower() {
    if (this.selectedTower) this.sellTower(this.selectedTower);
  }

  private selectTowerObject(tower: TowerRuntime) {
    if (this.selectedTower && this.selectedTower !== tower) this.selectedTower.rangeRing.visible = false;
    this.selectedTower = tower;
    tower.rangeRing.visible = true;
    this.selectedTool = null;
    this.ui.setSelectedTool(null);
    this.showTowerInspector(tower);
    this.previewRange.visible = false;
    this.player.releasePointer();
  }

  private clearTowerSelection() {
    if (this.selectedTower) this.selectedTower.rangeRing.visible = false;
    this.selectedTower = null;
    this.ui.hideInspector();
  }

  private showTowerInspector(tower: TowerRuntime) {
    const def = TOWERS[tower.id];
    const level = def.levels[tower.level - 1];
    const stats: InspectorData['stats'] = [
      { label: '等级', value: `Lv.${tower.level}` },
      { label: '伤害', value: String(level.damage) },
      { label: '射程', value: (level.range * this.towerRangeMul()).toFixed(1) },
      { label: '攻击间隔', value: `${(level.cooldown * this.towerCooldownMul()).toFixed(2)}s` },
      { label: '每秒伤害', value: (level.damage / (level.cooldown * this.towerCooldownMul())).toFixed(1) },
    ];
    if (tower.id === 'cannon') stats.push({ label: '爆炸半径', value: level.splash.toFixed(1) });
    if (tower.id === 'star') stats.push({ label: '减速', value: `${Math.round(level.slow * 100)}% / ${level.slowDuration}s` });
    if (tower.id === 'arrow') stats.push({ label: '特性', value: '单体速射' });
    const canUpgrade = tower.level < 3;
    const nextGold = canUpgrade
      ? Math.ceil(Math.round(def.upgradeGold[tower.level - 1] * this.upgradeGoldMul()) / (this.halfUpgrade ? 2 : 1))
      : 0;
    const nextStar = canUpgrade ? def.upgradeStar[tower.level - 1] : 0;
    const upgradeEnabled =
      canUpgrade && this.phase === 'playing' && this.gold >= nextGold && this.star >= nextStar;
    const upgradeLabel = canUpgrade
      ? `升级 Lv.${tower.level + 1} · ${nextGold} 金币${nextStar ? ` + ${nextStar} 星辉` : ''}`
      : '已达最高等级';
    const partner = this.findMergePartner(tower);
    const mergeLabel =
      tower.level >= 3
        ? ''
        : partner
          ? `合成 Lv.${tower.level + 1}`
          : '合成：需相邻同阶塔';
    const mergeEnabled = !!partner && this.phase === 'playing';
    const refund = Math.round(tower.investedGold * RULES.sellRefund);
    const mergeHint = partner
      ? `可与相邻的${TOWERS[partner.id].name}（Lv.${partner.level}）合成：消耗它，本塔免费升到 Lv.${tower.level + 1}。`
      : '在相邻地块再建一座同类型、同等级的塔，即可免费合成升阶。';
    const note =
      tower.level >= 3
        ? `这座塔已经抵达最高等级。拆除后这块地会恢复为${this.plots[tower.plot.index]?.underlying === 'farmland' ? '农田' : '荒地'}。`
        : `${mergeHint}${upgradeEnabled ? '' : ` 直接升级需要 ${nextGold} 金币${nextStar ? ` 和 ${nextStar} 星辉` : ''}。`}`;
    this.ui.showInspector({
      icon: def.icon,
      name: def.name,
      sub: `${def.en} · Lv.${tower.level}`,
      stats,
      note,
      upgradeLabel,
      upgradeEnabled,
      mergeLabel,
      mergeEnabled,
      sellLabel: `拆除 +${refund} 金币`,
      sellEnabled: this.phase === 'playing',
    });
  }

  /* ───────────────────────────── waves / enemies ───────────────────────────── */

  private beginPrep(duration: number) {
    this.wavePhase = 'prep';
    this.prepRemaining = duration;
    this.prepTotal = duration;
    this.updateHudNow();
  }

  private startNextWave(early: boolean) {
    if (this.phase !== 'playing' || this.wavePhase !== 'prep') return;
    if (this.wave >= this.totalWaves()) return;
    if (early) {
      this.gold += RULES.earlyStartBonus;
      this.ui.toast(`提前迎战：+${RULES.earlyStartBonus} 金币`, 'gold');
    }
    this.spawnWave();
  }

  private spawnWave() {
    this.wave += 1;
    const def = this.wavesForRun()[this.wave - 1];
    this.waveHpMul = def.hpMul ?? 1;
    this.waveRewardMul = def.rewardMul ?? 1;
    this.wavePhase = 'active';
    this.waveTime = 0;
    this.waveResolved = 0;
    this.spawnSchedule = scheduleForWave(def);
    this.waveSpawnTotal = this.spawnSchedule.length;
    this.spawnIndex = 0;
    this.previewRange.visible = false;
    const preview = wavePreview(def.groups);
    const desc = preview
      .map((item) => `${ENEMIES[item.id as EnemyId]?.name ?? item.id}×${item.count}`)
      .join(' · ');
    this.ui.showBanner(`第 ${this.wave} 波 · ${def.name}`, desc, '守住石径，别让它们碰到守望之种。', false, 3200);
    this.audio.play('wave');
    this.updateHudNow();
  }

  private spawnEnemy(id: EnemyId) {
    const def = ENEMIES[id];
    const art = this.art.enemy(id);
    const group = art.group;
    const pos = this.world.path.curve.getPointAt(0);
    group.position.set(pos.x, HERO_Y, pos.z);
    group.userData.lateral = def.boss ? 0 : (Math.random() - 0.5) * 1.15;
    group.userData.phase = Math.random() * Math.PI * 2;
    group.userData.legs = art.legs;
    group.userData.visual = art.visual;
    group.userData.head = art.head ?? null;
    this.world.scene.add(group);
    if (!def.boss) {
      const aura = new Mesh(
        new RingGeometry(0.25, 0.38, 20),
        new MeshBasicMaterial({ color: def.tint, transparent: true, opacity: 0.34, side: DoubleSide, depthWrite: false }),
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.02;
      aura.castShadow = false;
      group.add(aura);
    }
    const bar = document.createElement('div');
    bar.className = `enemy-bar${def.boss ? ' is-boss' : ''}`;
    const track = document.createElement('div');
    track.className = 'enemy-bar-track';
    const fill = document.createElement('div');
    fill.className = 'enemy-bar-fill';
    fill.style.background = def.barColor;
    track.appendChild(fill);
    bar.appendChild(track);
    this.enemyBarLayer.appendChild(bar);
    const hp = Math.round(def.hp * this.waveHpMul);
    const enemy: EnemyRuntime = {
      id,
      hp,
      maxHp: hp,
      speed: def.speed,
      progress: 0,
      worldPos: new Vector3(pos.x, HERO_Y, pos.z),
      group,
      mixer: art.mixer,
      slowFactor: 0,
      slowTimer: 0,
      barEl: bar,
      barFill: fill,
      barVisible: def.boss,
      dead: false,
    };
    this.enemies.push(enemy);
    this.particles.spawn(new Vector3(pos.x, 0.6, pos.z), def.tint, 6, {
      speed: 1.2,
      life: 0.6,
      size: 0.09,
      gravity: 1.5,
      up: 1.5,
    });
  }

  private updateWave(dt: number) {
    if (this.wavePhase === 'prep') {
      this.prepRemaining -= dt;
      if (this.prepRemaining <= 0) this.spawnWave();
      return;
    }
    if (this.wavePhase !== 'active') return;
    this.waveTime += dt;
    while (this.spawnIndex < this.spawnSchedule.length && this.spawnSchedule[this.spawnIndex].at <= this.waveTime) {
      if (this.enemies.length < RULES.maxEnemies) {
        this.spawnEnemy(this.spawnSchedule[this.spawnIndex].enemy);
      }
      this.spawnIndex += 1;
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const def = ENEMIES[enemy.id];
      const slow = enemy.slowTimer > 0 ? 1 - enemy.slowFactor : 1;
      if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
      enemy.progress += (enemy.speed * slow * dt) / this.world.path.length;
      if (enemy.progress >= 1) {
        this.enemyLeaked(enemy);
        continue;
      }
      const t = Math.min(0.9999, enemy.progress);
      const point = this.world.path.curve.getPointAt(t);
      const tangent = this.world.path.curve.getTangentAt(t);
      const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
      const lateral = (enemy.group.userData.lateral as number) ?? 0;
      enemy.group.position.set(point.x + normal.x * lateral, HERO_Y, point.z + normal.z * lateral);
      enemy.worldPos.copy(enemy.group.position);
      enemy.group.rotation.y = Math.atan2(tangent.x, tangent.z);
      const phase = ((enemy.group.userData.phase as number) ?? 0) + dt * (4 + enemy.speed * 2.5);
      enemy.group.userData.phase = phase;
      const legs = (enemy.group.userData.legs as Object3D[] | undefined) ?? [];
      legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(phase + (i % 2) * Math.PI + (i < 2 ? 0 : Math.PI / 2)) * 0.55;
      });
      const visual = enemy.group.userData.visual as Group | undefined;
      if (visual) {
        visual.position.y = Math.abs(Math.sin(phase)) * 0.035;
      }
      if (enemy.mixer) enemy.mixer.update(dt * slow * (0.85 + enemy.speed * 0.18));
      if (enemy.slowTimer > 0 && Math.random() < dt * 2) {
        this.particles.spawn(enemy.group.position.clone().add(new Vector3(0, 0.3, 0)), 0x8deee0, 1, {
          speed: 0.4,
          life: 0.5,
          size: 0.06,
          gravity: -0.5,
          up: 0.4,
        });
      }
      enemy.barFill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
      if (def.boss) enemy.barVisible = true;
      enemy.barEl.classList.toggle('is-visible', enemy.barVisible);
    }
  }

  private enemyLeaked(enemy: EnemyRuntime) {
    if (enemy.dead) return;
    enemy.dead = true;
    const def = ENEMIES[enemy.id];
    const damage = Math.max(1, def.coreDamage - (this.stack('thorns') > 0 ? 1 : 0));
    this.lives -= damage;
    this.stats.leaks += 1;
    this.waveResolved += 1;
    const destroyed = this.trampleCrops(def.boss ? 2 : 1);
    this.ui.flashDamage();
    this.audio.play('leak');
    this.particles.spawn(new Vector3(WORLD.core.x, 1, WORLD.core.z), 0xef8056, 18, {
      speed: 3.2,
      life: 0.9,
      size: 0.13,
      gravity: 4,
      up: 2.6,
    });
    this.floaters.spawn(`-${damage} 生命`, new Vector3(WORLD.core.x, 3, WORLD.core.z), 'warn');
    if (destroyed > 0) {
      this.ui.toast(`${def.name}冲过防线：-${damage} 生命，${destroyed} 块农田被烧毁！`, 'warn');
    } else {
      this.ui.toast(`${def.name}冲过防线：-${damage} 生命`, 'warn');
    }
    if (this.lives <= 0) {
      this.lives = 0;
      this.updateHudNow();
      this.endGame(false, 'lives');
    }
  }

  private killEnemy(enemy: EnemyRuntime) {
    if (enemy.dead) return;
    enemy.dead = true;
    const def = ENEMIES[enemy.id];
    const reward = Math.round(def.reward * this.waveRewardMul);
    this.gold += reward;
    this.stats.kills += 1;
    this.waveResolved += 1;
    this.particles.burstDeath(enemy.group.position.clone().add(new Vector3(0, 0.35, 0)), def.tint);
    this.floaters.spawn(`+${reward}`, enemy.group.position.clone().add(new Vector3(0, def.height + 0.2, 0)), 'gold');
    if (def.boss) {
      this.star += RULES.bossStarDrop;
      this.ui.showBanner('BOSS 击破', '鹿王倒下了', `获得 ${RULES.bossStarDrop} 星辉 · +${reward} 金币`, false, 2800);
      this.audio.play('star');
    }
    if (Date.now() - this.lastHitSound > 65) {
      this.lastHitSound = Date.now();
      this.audio.play('hit');
    }
  }

  private cleanupEnemies() {
    if (!this.enemies.some((enemy) => enemy.dead)) return;
    for (const enemy of this.enemies) {
      if (!enemy.dead) continue;
      enemy.group.removeFromParent();
      enemy.barEl.remove();
      enemy.mixer?.stopAllAction();
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
  }

  private damageEnemy(enemy: EnemyRuntime, amount: number) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.barVisible = true;
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    } else {
      this.particles.burstHit(enemy.group.position.clone().add(new Vector3(0, ENEMIES[enemy.id].height * 0.6, 0)));
    }
  }

  private findTarget(tower: TowerRuntime): EnemyRuntime | null {
    let best: EnemyRuntime | null = null;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.group.position.x - tower.plot.x;
      const dz = enemy.group.position.z - tower.plot.z;
      const range = tower.range * this.towerRangeMul();
      if (dx * dx + dz * dz > range * range) continue;
      if (!best || enemy.progress > best.progress) best = enemy;
    }
    return best;
  }

  private fireTower(tower: TowerRuntime, target: EnemyRuntime) {
    const def = TOWERS[tower.id];
    const origin =
      tower.id === 'arrow'
        ? new Vector3(tower.plot.x, 3.6, tower.plot.z)
        : tower.id === 'cannon'
          ? new Vector3(tower.plot.x, 2.5, tower.plot.z)
          : new Vector3(tower.plot.x, 3.7, tower.plot.z);
    if (tower.id === 'star') {
      const targetPos = target.group.position.clone().add(new Vector3(0, ENEMIES[target.id].height * 0.6, 0));
      this.fireBeam(origin, targetPos, def.projectileColor);
      this.damageEnemy(target, tower.damage);
      if (tower.slow > 0) {
        target.slowFactor = Math.max(target.slowFactor, tower.slow);
        target.slowTimer = Math.max(target.slowTimer, tower.slowDuration);
      }
      const halo = new Mesh(new RingGeometry(0.2, 0.34, 20), new MeshBasicMaterial({ color: 0x9de9ff, transparent: true, opacity: 0.8, side: DoubleSide }));
      halo.position.copy(target.group.position).add(new Vector3(0, 0.1, 0));
      halo.rotation.x = -Math.PI / 2;
      this.world.scene.add(halo);
      window.setTimeout(() => halo.removeFromParent(), 320);
      this.particles.spawn(targetPos, 0x8deee0, 5, { speed: 1.2, life: 0.4, size: 0.07, gravity: 1.5, up: 1.5 });
      this.playShot('starShot');
      return;
    }
    if (tower.id === 'arrow') {
      const mesh = new Mesh(this.arrowGeo, this.arrowMat);
      mesh.position.copy(origin);
      mesh.castShadow = false;
      this.world.scene.add(mesh);
      this.projectiles.push({
        kind: 'arrow',
        mesh,
        speed: 16,
        damage: tower.damage,
        target,
        lastTarget: target.group.position.clone().add(new Vector3(0, ENEMIES[target.id].height * 0.5, 0)),
        life: 2.5,
      });
      this.playShot('arrow');
      return;
    }
    const targetPos = target.group.position.clone();
    const mesh = new Mesh(this.mortarGeo, this.mortarMat);
    mesh.position.copy(origin);
    this.world.scene.add(mesh);
    const distance = origin.distanceTo(targetPos);
    this.projectiles.push({
      kind: 'mortar',
      mesh,
      start: origin.clone(),
      end: targetPos,
      duration: Math.max(0.32, distance / 9),
      t: 0,
      damage: tower.damage,
      splash: tower.splash,
      arc: 1.8 + distance * 0.16,
      trailTimer: 0,
    });
    this.playShot('cannon');
  }

  private playShot(name: SoundName) {
    if (Date.now() - this.lastShotSound < 55) return;
    this.lastShotSound = Date.now();
    this.audio.play(name);
  }

  private fireBeam(from: Vector3, to: Vector3, color: number) {
    const geometry = new BufferGeometry().setFromPoints([from, to]);
    const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new Line(geometry, material);
    line.renderOrder = 3;
    this.world.scene.add(line);
    this.beams.push({ line, life: 0.2, maxLife: 0.2 });
  }

  private updateTowers(dt: number) {
    for (const tower of this.towers) {
      if (tower.cooldown > 0) tower.cooldown -= dt;
      const target = this.findTarget(tower);
      const spin = tower.group.getObjectByName('tower-spin');
      if (spin) spin.rotation.y += dt * 0.85;
      if (!target) continue;
      if (tower.cooldown <= 0) {
        tower.cooldown = tower.fireCooldown * this.towerCooldownMul();
        this.fireTower(tower, target);
        const orb = tower.group.getObjectByName('tower-orb') as Mesh | undefined;
        if (orb) {
          orb.scale.setScalar(1.6);
          window.setTimeout(() => {
            if (orb.parent) orb.scale.setScalar(1);
          }, 110);
        }
      }
    }
  }

  private updateProjectiles(dt: number) {
    const alive: Projectile[] = [];
    for (const projectile of this.projectiles) {
      if (projectile.kind === 'arrow') {
        projectile.life -= dt;
        if (projectile.target && !projectile.target.dead) {
          projectile.lastTarget.copy(
            projectile.target.group.position.clone().add(new Vector3(0, ENEMIES[projectile.target.id].height * 0.5, 0)),
          );
        }
        const dir = projectile.lastTarget.clone().sub(projectile.mesh.position);
        const distance = dir.length();
        if (distance < 0.32 || projectile.life <= 0) {
          if (projectile.target && !projectile.target.dead) this.damageEnemy(projectile.target, projectile.damage);
          projectile.mesh.removeFromParent();
          continue;
        }
        dir.normalize();
        projectile.mesh.position.addScaledVector(dir, Math.min(distance, projectile.speed * dt));
        projectile.mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
        alive.push(projectile);
      } else {
        projectile.t += dt / projectile.duration;
        if (projectile.t >= 1) {
          const impact = projectile.end.clone();
          this.world.scene.remove(projectile.mesh);
          this.particles.spawn(impact.clone().add(new Vector3(0, 0.2, 0)), 0xff9b5a, 16, {
            speed: 3.4,
            life: 0.6,
            size: 0.12,
            gravity: 4,
            up: 2.2,
          });
          for (const enemy of [...this.enemies]) {
            if (enemy.dead) continue;
            const dist = Math.hypot(enemy.group.position.x - impact.x, enemy.group.position.z - impact.z);
            if (dist <= projectile.splash) this.damageEnemy(enemy, projectile.damage);
          }
          this.audio.play('cannon');
          continue;
        }
        const t = Math.min(1, projectile.t);
        projectile.mesh.position.lerpVectors(projectile.start, projectile.end, t);
        projectile.mesh.position.y += Math.sin(t * Math.PI) * projectile.arc;
        projectile.trailTimer += dt;
        if (projectile.trailTimer > 0.035) {
          projectile.trailTimer = 0;
          this.particles.spawn(projectile.mesh.position.clone(), 0xffb46b, 1, {
            speed: 0.2,
            life: 0.28,
            size: 0.055,
            gravity: 1.2,
            up: 0.2,
          });
        }
        alive.push(projectile);
      }
    }
    this.projectiles = alive;
    const beams: Beam[] = [];
    for (const beam of this.beams) {
      beam.life -= dt;
      if (beam.life <= 0) {
        beam.line.removeFromParent();
        beam.line.geometry.dispose();
        (beam.line.material as LineBasicMaterial).dispose();
        continue;
      }
      (beam.line.material as LineBasicMaterial).opacity = beam.life / beam.maxLife;
      beams.push(beam);
    }
    this.beams = beams;
  }

  private checkWaveCleared() {
    if (this.phase !== 'playing' || this.wavePhase !== 'active') return;
    if (this.enemies.length > 0) return;
    if (this.spawnIndex < this.spawnSchedule.length) return;
    const versus = this.runMode === 'versus';
    const total = this.totalWaves();
    const reward = Math.round(RULES.waveClearGold(this.wave) * this.waveGoldMul());
    const starReward = RULES.waveClearStar(this.wave);
    this.gold += reward;
    this.star += starReward;
    this.audio.play('harvest');
    if (versus) {
      this.applyRivalWave();
      if (this.phase !== 'playing') return;
    }
    if (this.wave >= total) {
      this.ui.showBanner(
        versus ? '最终波' : '最终波',
        versus ? '八波已尽' : '山野守住了',
        `最后一波已清除 · +${reward} 金币`,
        false,
        2600,
      );
      this.updateHudNow();
      if (versus) this.finishVersus();
      else this.endGame(true);
      return;
    }
    this.ui.showBanner(
      `第 ${this.wave} 波清除`,
      `+${reward} 金币${starReward ? ` · +${starReward} 星辉` : ''}`,
      versus ? '季令将至：三选一，然后继续对垒。' : '准备时间开始：开垦新地、补种、到地块上建塔。',
      false,
      3200,
    );
    this.ui.toast(`第 ${this.wave} 波清除：+${reward} 金币${starReward ? ` +${starReward} 星辉` : ''}`, 'gold');
    if (starReward > 0) this.ui.toast(`挑战奖励：+${starReward} 星辉`, 'star');
    this.beginPrep(this.prepDuration());
    this.updateHudNow();
    if (versus) this.openBlessing();
  }

  /* ───────────────────────────── interaction ───────────────────────────── */

  private inReach(plot: PlotRuntime) {
    const dx = plot.spec.x - this.player.position.x;
    const dz = plot.spec.z - this.player.position.z;
    return Math.hypot(dx, dz) <= WORLD.player.interactRange;
  }

  private findTargetPlot(): PlotRuntime | null {
    if (this.phase !== 'playing' || this.mode !== 'first') return null;
    const hit = this.world.pickAtNdc(0, 0);
    if (hit) {
      const plot = this.plots[hit.index];
      if (plot && this.inReach(plot)) return plot;
    }
    const eye = this.player.eyePosition(new Vector3());
    const direction = this.world.camera.getWorldDirection(new Vector3());
    let best: PlotRuntime | null = null;
    let bestScore = -Infinity;
    for (const plot of this.plots) {
      const dx = plot.spec.x - this.player.position.x;
      const dz = plot.spec.z - this.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > WORLD.player.interactRange) continue;
      const height = plot.state === 'tower' ? 1.25 : 0.5;
      const toTarget = new Vector3(plot.spec.x, height, plot.spec.z).sub(eye).normalize();
      const dot = toTarget.dot(direction);
      if (dot < 0.05) continue;
      const score = dot * 2 - distance * 0.12;
      if (score > bestScore) {
        bestScore = score;
        best = plot;
      }
    }
    return best;
  }

  private promptFor(plot: PlotRuntime | null): InteractPrompt | null {
    if (!plot) return null;
    const tool = this.selectedTool;
    if (plot.reclaim) {
      const progress = Math.min(1, plot.reclaim.elapsed / plot.reclaim.total);
      return {
        key: '',
        title: '开垦中…',
        detail: '铁锹在翻土，稍等片刻',
        tone: 'work',
        progress,
        actionable: false,
      };
    }
    if (plot.state === 'wild') {
      if (tool?.kind === 'tower') {
        const def = TOWERS[tool.id as TowerId];
        return {
          key: 'E',
          title: `在荒地上建 ${def.name}`,
          detail: `${def.starCost ? `${def.starCost} 星辉 + ` : ''}${def.cost} 金币 · 建塔后不能种作物`,
          tone: 'action',
          actionable: true,
        };
      }
      return {
        key: 'E',
        title: '开垦这块荒地',
        detail: `${this.reclaimCost()} 金币 · 开垦后可以播种`,
        tone: 'action',
        actionable: true,
      };
    }
    if (plot.state === 'tower') {
      const tower = this.towerAt(plot.spec.index);
      if (!tower) return null;
      const def = TOWERS[tower.id];
      return {
        key: 'E',
        title: `查看 ${def.name} Lv.${tower.level}`,
        detail: '打开面板升级或拆除，拆除后恢复地块',
        tone: 'info',
        actionable: true,
      };
    }
    if (plot.scorched) {
      return {
        key: 'E',
        title: '修复焦土',
        detail: `${WORLD.farm.repairCost} 金币 · 修复后才能重新播种`,
        tone: 'warn',
        actionable: true,
      };
    }
    if (plot.crop) {
      const def = CROPS[plot.crop.type];
      if (plot.crop.mature) {
        return {
          key: 'E',
          title: `收获 ${def.name}`,
          detail: `+${def.yieldGold} 金币${def.yieldStar ? ` +${def.yieldStar} 星辉` : ''}`,
          tone: 'action',
          actionable: true,
        };
      }
      const pct = Math.min(99, Math.floor((plot.crop.elapsed / def.growTime) * 100));
      return {
        key: '',
        title: `${def.name} · 生长中`,
        detail: `${pct}% · 还需 ${Math.max(0, def.growTime - plot.crop.elapsed).toFixed(1)} 秒`,
        tone: 'info',
        actionable: false,
      };
    }
    if (tool?.kind === 'tower') {
      const def = TOWERS[tool.id as TowerId];
      return {
        key: 'E',
        title: `在空农田上建 ${def.name}`,
        detail: `${def.starCost ? `${def.starCost} 星辉 + ` : ''}${def.cost} 金币 · 会占用这块农田`,
        tone: 'action',
        actionable: true,
      };
    }
    if (tool?.kind === 'crop') {
      const def = CROPS[tool.id as CropId];
      return {
        key: 'E',
        title: `播种 ${def.name}`,
        detail: `${def.cost} 金币 · ${def.growTime} 秒成熟 · +${def.yieldGold} 金币${def.yieldStar ? ` +${def.yieldStar} 星辉` : ''}`,
        tone: 'action',
        actionable: true,
      };
    }
    return {
      key: '',
      title: '空农田',
      detail: '按 1–3 选作物，或 4–6 选防御塔',
      tone: 'info',
      actionable: false,
    };
  }

  private updateInteractionPrompt() {
    if (this.phase !== 'playing' || this.mode !== 'first') {
      this.targetPlot = null;
      this.ui.setInteractPrompt(null);
      return;
    }
    const plot = this.findTargetPlot();
    if (plot !== this.targetPlot) {
      this.clearTargetPlot();
      this.targetPlot = plot;
      if (plot) this.viewFor(plot.spec.index).highlight.visible = true;
    }
    if (plot && this.selectedTool?.kind === 'tower' && plot.state !== 'tower' && !plot.scorched && !plot.reclaim && !plot.crop) {
      const def = TOWERS[this.selectedTool.id as TowerId];
      this.previewRange.position.set(plot.spec.x, 0.36, plot.spec.z);
      this.previewRange.scale.setScalar(def.levels[0].range);
      (this.previewRange.material as MeshBasicMaterial).color.setHex(def.accent);
      this.previewRange.visible = true;
    } else {
      this.previewRange.visible = false;
    }
    this.ui.setInteractPrompt(this.promptFor(plot));
    this.ui.setTouchInteractEnabled(!!plot && !!this.promptFor(plot)?.actionable);
  }

  private clearTargetPlot() {
    if (!this.targetPlot) return;
    this.viewFor(this.targetPlot.spec.index).highlight.visible = false;
    this.targetPlot = null;
    this.previewRange.visible = false;
  }

  private interact() {
    if (this.phase !== 'playing' || this.mode !== 'first') return;
    const plot = this.findTargetPlot();
    if (!plot) {
      this.ui.toast('走近地块再操作（WASD 移动）', 'default');
      return;
    }
    this.targetPlot = plot;
    this.player.swing();
    if (plot.reclaim) return;
    if (plot.state === 'tower') {
      const tower = this.towerAt(plot.spec.index);
      if (tower) this.selectTowerObject(tower);
      return;
    }
    if (plot.state === 'wild') {
      if (this.selectedTool?.kind === 'tower') this.buildTower(plot.spec.index, this.selectedTool.id as TowerId);
      else this.startReclaim(plot.spec.index);
      this.updateInteractionPrompt();
      return;
    }
    if (plot.scorched) {
      this.repairPlot(plot.spec.index);
      this.updateInteractionPrompt();
      return;
    }
    if (plot.crop) {
      if (plot.crop.mature) this.harvestPlot(plot.spec.index);
      else this.ui.toast(`${CROPS[plot.crop.type].name}还在生长`, 'default');
      this.updateInteractionPrompt();
      return;
    }
    if (this.selectedTool?.kind === 'tower') {
      this.buildTower(plot.spec.index, this.selectedTool.id as TowerId);
    } else if (this.selectedTool?.kind === 'crop') {
      this.plantCrop(plot.spec.index, this.selectedTool.id as CropId);
    } else {
      this.ui.toast('先在下方选一种作物或防御塔，再按 E', 'default');
    }
    this.updateInteractionPrompt();
  }

  private handleOverviewClick(clientX: number, clientY: number) {
    if (this.phase !== 'playing' || this.mode !== 'overview') return;
    const hit = this.world.pick(clientX, clientY);
    if (hit) {
      const plot = this.plots[hit.index];
      const tower = plot ? this.towerAt(plot.spec.index) : null;
      if (tower) {
        this.selectTowerObject(tower);
        return;
      }
    }
    this.ui.toast('切回第一人称（V），走到地块旁才能开垦、播种或建塔', 'default');
  }

  private updateOverviewHover() {
    if (this.phase !== 'playing' || this.mode !== 'overview') {
      this.clearOverviewHover();
      return;
    }
    const hit = this.world.pick(this.lastPointer.x, this.lastPointer.y);
    const plot = hit ? this.plots[hit.index] : null;
    if (plot !== this.hoveredPlot) {
      this.clearOverviewHover();
      this.hoveredPlot = plot;
      if (plot) this.viewFor(plot.spec.index).highlight.visible = true;
    }
    if (!plot) {
      this.ui.hideTooltip();
      this.previewRange.visible = false;
      return;
    }
    this.ui.showTooltip(this.plotTooltip(plot), this.lastPointer.x, this.lastPointer.y);
    const tower = this.towerAt(plot.spec.index);
    if (this.selectedTool?.kind === 'tower' && !tower && plot.state !== 'tower' && !plot.scorched && !plot.crop && !plot.reclaim) {
      const def = TOWERS[this.selectedTool.id as TowerId];
      this.previewRange.position.set(plot.spec.x, 0.36, plot.spec.z);
      this.previewRange.scale.setScalar(def.levels[0].range);
      (this.previewRange.material as MeshBasicMaterial).color.setHex(def.accent);
      this.previewRange.visible = true;
    } else {
      this.previewRange.visible = false;
    }
  }

  private clearOverviewHover() {
    if (this.hoveredPlot) this.viewFor(this.hoveredPlot.spec.index).highlight.visible = false;
    this.hoveredPlot = null;
    this.previewRange.visible = false;
    this.ui.hideTooltip();
  }

  private plotTooltip(plot: PlotRuntime) {
    const tool = this.selectedTool;
    if (plot.reclaim) return `<b>开垦中</b><br>${Math.floor(Math.min(1, plot.reclaim.elapsed / plot.reclaim.total) * 100)}% · 还需约 ${Math.max(0, plot.reclaim.total - plot.reclaim.elapsed).toFixed(1)} 秒`;
    if (plot.state === 'wild') {
      if (tool?.kind === 'tower') {
        const def = TOWERS[tool.id as TowerId];
        return `<b>荒地 · 建 ${def.name}</b><br>${def.starCost ? `${def.starCost} 星辉 + ` : ''}${def.cost} 金币<br>第一人称走到近处按 E`;
      }
      return `<b>荒地</b><br>开垦需要 ${this.reclaimCost()} 金币<br>第一人称走到近处按 E`;
    }
    if (plot.state === 'tower') {
      const tower = this.towerAt(plot.spec.index);
      const def = tower ? TOWERS[tower.id] : null;
      return `<b>塔基 · ${def?.name ?? '防御塔'}${tower ? ` Lv.${tower.level}` : ''}</b><br>拆除后恢复为${plot.underlying === 'farmland' ? '农田' : '荒地'}`;
    }
    if (plot.scorched) return `<b>焦土</b><br>修复需要 ${WORLD.farm.repairCost} 金币`;
    if (plot.crop) {
      const def = CROPS[plot.crop.type];
      if (plot.crop.mature) return `<b>${def.name} · 成熟</b><br>可收获 +${def.yieldGold} 金币${def.yieldStar ? ` +${def.yieldStar} 星辉` : ''}`;
      return `<b>${def.name} · 生长中</b><br>${Math.min(99, Math.floor((plot.crop.elapsed / def.growTime) * 100))}%`;
    }
    return '<b>空农田</b><br>第一人称走到近处按 E 播种';
  }

  private clearHighlights() {
    for (const view of this.world.plotVisuals) view.highlight.visible = false;
    this.previewRange.visible = false;
  }

  private nudgeError(message: string) {
    const now = Date.now();
    this.audio.play('error');
    if (now - this.lastErrorToast < 700) return;
    this.lastErrorToast = now;
    this.ui.toast(message, 'warn');
  }

  private selectCrop(id: CropId) {
    if (this.phase !== 'playing') return;
    if (this.selectedTool?.kind === 'crop' && this.selectedTool.id === id) {
      this.selectedTool = null;
      this.ui.setSelectedTool(null);
    } else {
      this.selectedTool = { kind: 'crop', id };
      this.ui.setSelectedTool('crop', id);
      this.clearTowerSelection();
    }
    this.audio.play('click');
    this.updateInteractionPrompt();
  }

  private selectTower(id: TowerId) {
    if (this.phase !== 'playing') return;
    if (this.selectedTool?.kind === 'tower' && this.selectedTool.id === id) {
      this.selectedTool = null;
      this.ui.setSelectedTool(null);
    } else {
      this.selectedTool = { kind: 'tower', id };
      this.ui.setSelectedTool('tower', id);
      this.clearTowerSelection();
    }
    this.audio.play('click');
    this.updateInteractionPrompt();
  }

  /* ───────────────────────────── input ───────────────────────────── */

  private bindInput() {
    this.canvas.addEventListener('pointermove', (event) => {
      this.lastPointer = { x: event.clientX, y: event.clientY };
      if (this.mode === 'overview') this.updateOverviewHover();
    });
    this.canvas.addEventListener('click', (event) => {
      if (this.mode === 'overview') this.handleOverviewClick(event.clientX, event.clientY);
    });
    this.canvas.addEventListener('pointerleave', () => {
      if (this.mode === 'overview') this.clearOverviewHover();
    });
  }

  private bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const helpOpen = !document.getElementById('help-screen')?.hidden;
      const pauseOpen = !document.getElementById('pause-screen')?.hidden;
      const endOpen = !document.getElementById('end-screen')?.hidden;
      if (event.code === 'Escape') {
        event.preventDefault();
        if (helpOpen) this.ui.hideHelp();
        else if (pauseOpen) this.resumeGame();
        else if (endOpen) this.goToMenu();
        else if (this.selectedTower) this.clearTowerSelection();
        else if (this.selectedTool) {
          this.selectedTool = null;
          this.ui.setSelectedTool(null);
          this.updateInteractionPrompt();
        } else if (this.phase === 'playing') {
          this.togglePause();
        }
        return;
      }
      if (helpOpen || pauseOpen || endOpen) return;
      if (this.phase === 'menu') {
        if (event.code === 'Enter') {
          event.preventDefault();
          this.startGame();
        }
        return;
      }
      if (this.phase !== 'playing') return;
      switch (event.code) {
        case 'KeyE':
          event.preventDefault();
          this.interact();
          break;
        case 'KeyV':
          event.preventDefault();
          this.toggleCameraMode();
          break;
        case 'Enter':
          event.preventDefault();
          if (this.wavePhase === 'prep') this.startNextWave(true);
          break;
        case 'Digit1':
          this.selectCrop('wheat');
          break;
        case 'Digit2':
          this.selectCrop('pumpkin');
          break;
        case 'Digit3':
          this.selectCrop('flower');
          break;
        case 'Digit4':
          this.selectTower('arrow');
          break;
        case 'Digit5':
          this.selectTower('cannon');
          break;
        case 'Digit6':
          this.selectTower('star');
          break;
        case 'KeyT':
          this.toggleSpeed();
          break;
        case 'KeyM':
          this.toggleSound();
          break;
        case 'KeyP':
          this.togglePause();
          break;
        default:
          break;
      }
    });
  }

  private bindVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.togglePause();
    });
  }

  /* ───────────────────────────── main loop ───────────────────────────── */

  private loop = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.world.updateAmbient(dt);
    this.player.update(dt);
    if (this.phase === 'playing' && !this.debugHold) {
      this.accumulator += dt * this.speed;
      let steps = 0;
      while (this.accumulator >= RULES.simStep && steps < RULES.maxStepsPerFrame && this.phase === 'playing') {
        this.step(RULES.simStep);
        this.accumulator -= RULES.simStep;
        steps++;
      }
      if (steps >= RULES.maxStepsPerFrame) this.accumulator = 0;
      this.hudTimer += dt;
      if (this.hudTimer >= 0.1) {
        this.hudTimer = 0;
        this.updateHudNow();
      }
    }
    if (this.phase === 'playing') {
      this.promptTimer += dt;
      if (this.promptTimer >= 0.05) {
        this.promptTimer = 0;
        this.updateInteractionPrompt();
      }
    }
    this.particles.update(dt);
    this.floaters.update(dt, this.world.camera);
    if (this.phase === 'playing' || this.phase === 'paused') this.updateEnemyBars();
    this.syncControlUi();
    this.ui.tickFps(dt);
    this.world.render();
    requestAnimationFrame(this.loop);
  };

  private syncControlUi() {
    const locked = this.player.isLocked;
    const showLockHint = this.phase === 'playing' && this.mode === 'first' && !locked && !this.isTouchDevice;
    this.ui.setLockHint(showLockHint);
    this.canvas.classList.toggle('is-locked', locked);
    const showTouch = this.phase === 'playing' && this.mode === 'first' && this.isTouchDevice && !this.ui.inspectorOpen;
    this.ui.setTouchControlsVisible(showTouch);
  }

  private step(dt: number) {
    this.stats.playSeconds += dt;
    this.updateWave(dt);
    this.updatePlots(dt);
    this.updateEnemies(dt);
    this.cleanupEnemies();
    if (this.phase !== 'playing') return;
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.cleanupEnemies();
    this.checkWaveCleared();
  }

  private updateEnemyBars() {
    for (const enemy of this.enemies) {
      const def = ENEMIES[enemy.id];
      if (!enemy.barVisible || enemy.dead) {
        enemy.barEl.classList.remove('is-visible');
        continue;
      }
      const pos = enemy.group.position.clone();
      pos.y += def.height + (def.boss ? 0.8 : 0.35);
      const projected = pos.project(this.world.camera);
      const visible =
        projected.z < 1 &&
        projected.z > -1 &&
        Math.abs(projected.x) < 1.1 &&
        Math.abs(projected.y) < 1.1;
      if (!visible) {
        enemy.barEl.classList.remove('is-visible');
        continue;
      }
      enemy.barEl.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`;
      enemy.barEl.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`;
      enemy.barEl.classList.add('is-visible');
    }
  }

  private updateHudNow() {
    this.ui.setResources(this.gold, this.star, this.lives, this.maxLives, this.reclaimedCount(), this.plots.length);
    if (this.rival) this.ui.setRival(this.rival, this.lives);
    this.ui.setBlessings(this.blessingEntries());
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    const total = this.totalWaves();
    const waves = this.wavesForRun();
    const previewWave =
      this.wavePhase === 'prep'
        ? waves[Math.min(total, this.wave + 1) - 1]
        : waves[Math.max(0, this.wave - 1)];
    const groups = previewWave?.groups ?? [];
    const canStart = this.wavePhase === 'prep' && this.wave < total;
    const enemiesLeft = this.enemies.length + Math.max(0, this.spawnSchedule.length - this.spawnIndex);
    let progress: number;
    let timer: number;
    if (this.wavePhase === 'prep') {
      progress = this.prepTotal > 0 ? 1 - this.prepRemaining / this.prepTotal : 0;
      timer = this.prepRemaining;
    } else {
      progress = this.waveSpawnTotal > 0 ? this.waveResolved / this.waveSpawnTotal : 0;
      timer = this.waveTime;
    }
    this.ui.updateWave({
      mode: this.wavePhase === 'prep' ? 'prep' : 'active',
      wave: this.wavePhase === 'prep' ? Math.min(total, this.wave + 1) : this.wave,
      total,
      timer,
      progress,
      enemiesLeft,
      preview: wavePreview(groups),
      canStart,
    });
    if (this.selectedTower) this.showTowerInspector(this.selectedTower);
  }

  private clearDynamicWorld() {
    for (const enemy of this.enemies) {
      enemy.group.removeFromParent();
      enemy.barEl.remove();
      enemy.mixer?.stopAllAction();
    }
    this.enemies = [];
    for (const tower of this.towers) {
      tower.group.removeFromParent();
      tower.rangeRing.removeFromParent();
    }
    this.towers = [];
    for (const projectile of this.projectiles) projectile.mesh.removeFromParent();
    this.projectiles = [];
    for (const beam of this.beams) {
      beam.line.removeFromParent();
      beam.line.geometry.dispose();
      (beam.line.material as LineBasicMaterial).dispose();
    }
    this.beams = [];
    for (const view of this.world.plotVisuals) {
      this.clearCropVisual(view);
      view.wild.visible = true;
      view.farm.visible = false;
      view.towerBase.visible = false;
      view.scorched.visible = false;
      view.matureGlow.visible = false;
      view.highlight.visible = false;
      view.wild.scale.setScalar(1);
      view.wild.position.set(0, 0, 0);
      view.farm.scale.setScalar(1);
      view.farm.position.set(0, 0, 0);
    }
    this.activeReclaim = null;
    this.targetPlot = null;
    this.selectedTower = null;
    this.ui.hideInspector();
    this.ui.setInteractPrompt(null);
    this.clearHighlights();
    this.clearOverviewHover();
  }

  /* ───────────────────────────── debug API ───────────────────────────── */

  private installDebugApi() {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const game = this;
    const api = {
      version: '2.0.0',
      art: game.art.kind,
      get ready() {
        return game.phase !== 'loading';
      },
      getState() {
        return {
          phase: game.phase,
          runMode: game.runMode,
          mode: game.mode,
          totalWaves: game.totalWaves(),
          gold: game.gold,
          star: game.star,
          lives: game.lives,
          maxLives: game.maxLives,
          wave: game.wave,
          wavePhase: game.wavePhase,
          prepRemaining: game.prepRemaining,
          speed: game.speed,
          selectedTool: game.selectedTool,
          selectedTower: game.selectedTower ? { plot: game.selectedTower.plot.index, level: game.selectedTower.level } : null,
          blessings: { ...game.blessingStacks },
          blessingOffers: game.blessingOffers.map((choice) => ({
            id: choice.def.id,
            name: choice.def.name,
            rarity: choice.def.rarity,
            stacks: choice.stacks,
            maxStacks: choice.def.maxStacks,
          })),
          shopOffers: game.shopOffers.map((offer) => ({
            id: offer.item.id,
            name: offer.item.name,
            price: offer.price,
            sold: offer.sold,
          })),
          shopRerollCost: game.shopRerollCost(),
          shopRerolls: game.shopRerolls,
          shopPurchases: game.shopPurchases,
          rival: game.rival ? { ...game.rival } : null,
          tokens: {
            freeReclaim: game.freeReclaim,
            halfUpgrade: game.halfUpgrade,
            doubleHarvest: game.doubleHarvest,
          },
          player: {
            x: game.player.position.x,
            z: game.player.position.z,
            yaw: game.player.yaw,
            pitch: game.player.pitch,
            mode: game.player.mode,
            locked: game.player.isLocked,
            jumpY: game.player.jumpYForDebug,
            grounded: game.player.groundedForDebug,
          },
          cameraMode: game.mode,
          reclaimCost: game.reclaimCost(),
          enemies: game.enemies.map((enemy) => {
            const tangent = game.world.path.curve.getTangentAt(Math.min(0.9999, enemy.progress));
            const head = enemy.group.userData.head as Object3D | null;
            let facing: number | null = null;
            if (head) {
              const headWorld = head.getWorldPosition(new Vector3());
              const dx = headWorld.x - enemy.group.position.x;
              const dz = headWorld.z - enemy.group.position.z;
              const length = Math.hypot(dx, dz);
              if (length > 0.0001) facing = (dx * tangent.x + dz * tangent.z) / length;
            }
            return { id: enemy.id, hp: enemy.hp, progress: enemy.progress, facing };
          }),
          plots: game.plots.map((plot) => ({
            index: plot.spec.index,
            state: plot.state,
            underlying: plot.underlying,
            scorched: plot.scorched,
            reclaim: plot.reclaim
              ? { progress: Math.min(1, plot.reclaim.elapsed / plot.reclaim.total) }
              : null,
            crop: plot.crop
              ? {
                  type: plot.crop.type,
                  stage: plot.crop.stage,
                  mature: plot.crop.mature,
                  progress: Math.min(1, plot.crop.elapsed / CROPS[plot.crop.type].growTime),
                }
              : null,
          })),
          towers: game.towers.map((tower) => ({
            id: tower.id,
            plot: tower.plot.index,
            level: tower.level,
            damage: tower.damage,
            range: tower.range,
          })),
          stats: { ...game.stats },
          pathLength: game.world.path.length,
        };
      },
      start(mode: RunMode = 'classic') {
        game.startGame(mode);
      },
      startVersus() {
        game.startGame('versus');
      },
      restart() {
        game.startGame(game.runMode);
      },
      menu() {
        game.goToMenu();
      },
      simulate(seconds: number) {
        const limit = Math.min(cleanNumber(seconds), 600);
        let remaining = limit;
        let guard = 0;
        while (remaining > 0 && game.phase === 'playing' && guard < 60000) {
          const dt = Math.min(RULES.simStep, remaining);
          game.step(dt);
          remaining -= dt;
          guard++;
        }
        game.updateHudNow();
        game.updateInteractionPrompt();
        game.world.updateAmbient(0.016);
        game.world.render();
        return game.debugState();
      },
      tick(seconds: number) {
        return api.simulate(seconds);
      },
      addGold(amount: number) {
        game.gold += cleanNumber(amount);
        game.updateHudNow();
        return game.gold;
      },
      addStar(amount: number) {
        game.star += cleanNumber(amount);
        game.updateHudNow();
        return game.star;
      },
      selectCrop(id: CropId) {
        game.selectCrop(id);
        return game.selectedTool;
      },
      selectTower(id: TowerId) {
        game.selectTower(id);
        return game.selectedTool;
      },
      plant(index: number, type: CropId = 'wheat') {
        return game.plantCrop(index, type);
      },
      harvest(index: number) {
        return game.harvestPlot(index);
      },
      harvestAll() {
        game.harvestAll();
        return game.gold;
      },
      reclaim(index: number) {
        return game.startReclaim(index);
      },
      repair(index: number) {
        return game.repairPlot(index);
      },
      finishReclaim(index: number) {
        const plot = game.plots[index];
        if (!plot?.reclaim) return false;
        game.finishReclaim(plot);
        return true;
      },
      build(plot: number, type: TowerId) {
        return game.buildTower(plot, type);
      },
      upgrade(plot: number) {
        const tower = game.towerAt(plot);
        return tower ? game.upgradeTower(tower) : false;
      },
      merge(plot: number) {
        const tower = game.towerAt(plot);
        return tower ? game.mergeTower(tower) : false;
      },
      selectTowerAt(plot: number) {
        const tower = game.towerAt(plot);
        if (!tower) return false;
        game.selectTowerObject(tower);
        return true;
      },
      canMerge(plot: number) {
        const tower = game.towerAt(plot);
        return tower ? !!game.findMergePartner(tower) : false;
      },
      chooseBlessing(id: BlessingId) {
        game.chooseBlessing(id);
      },
      blessingChoices() {
        return game.blessingOffers.map((choice) => choice.def.id);
      },
      buyShopItem(id: ShopItemId) {
        game.buyShopItem(id);
      },
      rerollShop() {
        game.rerollShop();
      },
      closeShop() {
        game.closeShop();
      },
      sell(plot: number) {
        const tower = game.towerAt(plot);
        if (!tower) return false;
        game.sellTower(tower);
        return true;
      },
      interact() {
        game.interact();
      },
      toggleCamera() {
        game.toggleCameraMode();
      },
      teleport(x: number, z: number) {
        game.player.position.set(x, 0, z);
        game.player.lookAt(new Vector3(x, 0.6, z));
        game.player.eyePosition();
        game.world.render();
        return { x: game.player.position.x, z: game.player.position.z };
      },
      facePlot(index: number, standDistance = 2.35) {
        const spec = PLOTS[index];
        const x = spec.x;
        const z = spec.z + standDistance;
        game.player.position.set(x, 0, z);
        game.player.lookAt(new Vector3(spec.x, 0.5, spec.z));
        game.world.render();
        return { x, z };
      },
      setLook(yaw: number, pitch: number) {
        game.player.setLook(yaw, pitch);
        game.world.render();
      },
      nextWave() {
        game.startNextWave(false);
      },
      hold() {
        game.debugHold = true;
        game.updateHudNow();
        game.world.render();
      },
      release() {
        game.debugHold = false;
      },
      closeInspector() {
        game.clearTowerSelection();
      },
      setCamera(position: [number, number, number], target: [number, number, number]) {
        game.world.setCameraMode('orbit');
        game.world.camera.position.set(...position);
        game.world.controls.target.set(...target);
        game.world.controls.update();
        game.world.render();
        if (game.mode !== 'overview') {
          game.mode = 'overview';
          game.player.setMode('overview');
          game.player.setEnabled(false);
          game.ui.setCameraMode('overview');
        }
      },
      screenPoint(kind: 'plot' | 'pad', index: number) {
        void kind;
        const spec = PLOTS[index];
        return game.world.screenPoint(new Vector3(spec.x, 0.5, spec.z));
      },
      metrics() {
        return {
          fps: game.ui.fps,
          calls: game.world.renderer.info.render.calls,
          triangles: game.world.renderer.info.render.triangles,
          pixelRatio: game.world.renderer.getPixelRatio(),
          width: window.innerWidth,
          height: window.innerHeight,
          mode: game.mode,
          player: { x: game.player.position.x, z: game.player.position.z, yaw: game.player.yaw, pitch: game.player.pitch },
          camera: {
            position: game.world.camera.position.toArray(),
            target: game.world.controls.target.toArray(),
            fov: game.world.camera.fov,
            distance: game.world.camera.position.distanceTo(game.world.controls.target),
          },
        };
      },
      async wait(ms: number) {
        await new Promise((resolve) => window.setTimeout(resolve, ms));
      },
    };
    (window as unknown as { __fieldguard?: typeof api }).__fieldguard = api;
  }

  private debugState() {
    return (window as unknown as { __fieldguard?: { getState: () => unknown } }).__fieldguard?.getState();
  }
}

// Avoid unused type import while keeping the public surface explicit.
export type { WaveGroup };
