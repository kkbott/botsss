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
import { CROPS, ENEMIES, PLOTS, RULES, STORAGE_KEY, TOWERS, WAVES, WORLD } from './config';
import { TOWER_PADS } from './config';
import type {
  CropId,
  CropStage,
  EnemyId,
  EnemyRuntime,
  GamePhase,
  GameStats,
  PlotRuntime,
  SaveData,
  TowerId,
  TowerRuntime,
  WavePhase,
  WaveGroup,
  WaveDef,
} from './types';
import { AudioEngine, type SoundName } from './audio';
import { FloatingTexts, ParticleSystem } from './effects';
import { GameUI, type InspectorData, type UIActions } from './ui';
import { World, type PlotVisual } from './world';
import type { ArtProvider } from './art';
import type { EnvironmentAssets } from './assets';

interface PointerState {
  downX: number;
  downY: number;
  time: number;
  pick: { kind: 'plot' | 'pad'; index: number } | null;
  acted: boolean;
  painting: boolean;
  pointerId: number;
  pointerType: string;
}

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
  muted: boolean;
}

const HERO_Y = 0.02;

function readSave(): CachedSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestWave: 0, victories: 0, muted: false };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      bestWave: typeof parsed.bestWave === 'number' && parsed.bestWave >= 0 ? parsed.bestWave : 0,
      victories: typeof parsed.victories === 'number' && parsed.victories >= 0 ? parsed.victories : 0,
      muted: parsed.muted === true,
    };
  } catch {
    return { bestWave: 0, victories: 0, muted: false };
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
  private readonly art: ArtProvider;
  private readonly audio: AudioEngine;
  private readonly ui: GameUI;
  private readonly particles: ParticleSystem;
  private readonly floaters: FloatingTexts;
  private readonly enemyBarLayer: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  private phase: GamePhase = 'loading';
  private speed: number = 1;
  private gold: number = RULES.startingGold;
  private star: number = 0;
  private lives: number = RULES.startingLives;
  private wave: number = 0;
  private wavePhase: WavePhase = 'prep';
  private prepRemaining: number = RULES.firstPrep;
  private prepTotal: number = RULES.firstPrep;
  private waveTime: number = 0;
  private waveResolved: number = 0;
  private waveSpawnTotal: number = 0;
  private spawnSchedule: Array<{ enemy: EnemyId; at: number }> = [];
  private spawnIndex = 0;

  private plots: PlotRuntime[] = [];
  private towers: TowerRuntime[] = [];
  private enemies: EnemyRuntime[] = [];
  private projectiles: Projectile[] = [];
  private beams: Beam[] = [];
  private selectedTool: { kind: 'crop' | 'tower'; id: CropId | TowerId } | null = null;
  private selectedTower: TowerRuntime | null = null;
  private hovered: { kind: 'plot' | 'pad'; index: number } | null = null;
  private previewRange: Mesh;
  private arrowGeo = new ConeGeometry(0.065, 0.38, 4);
  private mortarGeo = new SphereGeometry(0.16, 6, 4);
  private arrowMat = new MeshStandardMaterial({ color: 0xffe2a1, emissive: 0xa86c14, emissiveIntensity: 0.5, roughness: 0.5 });
  private mortarMat = new MeshStandardMaterial({ color: 0xff8b52, emissive: 0x8f2d10, emissiveIntensity: 0.55, roughness: 0.7 });
  private helpPausedRun = false;

  private stats: GameStats = {
    kills: 0,
    harvestedGold: 0,
    harvestedStar: 0,
    planted: 0,
    towersBuilt: 0,
    leaks: 0,
    playSeconds: 0,
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
  private pointer: PointerState | null = null;
  private lastPaintPlot = -1;

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
    this.previewRange = this.makeRangeRing(0xa8c97b, 1);
    this.previewRange.visible = false;
    this.world.scene.add(this.previewRange);
    this.ui.setSpeedLabel(1);
    this.resetPlots();
    this.bindInput();
    this.bindKeyboard();
    this.bindVisibility();
    this.world.updateAmbient(0);
    this.world.render();
    this.phase = 'menu';
    this.world.setMenuMode(true);
    this.ui.showMenu(this.save.bestWave, this.save.victories);
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
      start: () => this.startGame(),
      resume: () => this.resumeGame(),
      restart: () => this.startGame(),
      quitToMenu: () => this.goToMenu(),
      selectCrop: (id) => this.selectCrop(id),
      selectTower: (id) => this.selectTower(id),
      harvestAll: () => this.harvestAll(),
      nextWave: () => this.startNextWave(true),
      togglePause: () => this.togglePause(),
      toggleSpeed: () => this.toggleSpeed(),
      toggleSound: () => this.toggleSound(),
      showHelp: () => this.openHelp(),
      upgradeTower: () => this.upgradeSelectedTower(),
      sellTower: () => this.sellSelectedTower(),
      closeInspector: () => this.clearTowerSelection(),
      retry: () => this.startGame(),
    };
  }

  /* ───────────────────────────── lifecycle ───────────────────────────── */

  private startGame() {
    if (this.phase === 'loading') return;
    this.audio.init();
    this.audio.setMuted(this.save.muted);
    this.clearDynamicWorld();
    this.resetPlots();
    this.gold = RULES.startingGold;
    this.star = 0;
    this.lives = RULES.startingLives;
    this.wave = 0;
    this.wavePhase = 'prep';
    this.prepRemaining = RULES.firstPrep;
    this.prepTotal = RULES.firstPrep;
    this.waveTime = 0;
    this.waveResolved = 0;
    this.waveSpawnTotal = 0;
    this.spawnSchedule = [];
    this.spawnIndex = 0;
    this.selectedTool = null;
    this.selectedTower = null;
    this.hovered = null;
    this.accumulator = 0;
    this.runTime = 0;
    this.helpPausedRun = false;
    this.stats = { kills: 0, harvestedGold: 0, harvestedStar: 0, planted: 0, towersBuilt: 0, leaks: 0, playSeconds: 0 };
    this.ui.hideMenu();
    this.ui.hideEnd();
    this.ui.hidePause();
    this.ui.hideHelp();
    this.ui.showGameHud();
    this.ui.setSelectedTool(null);
    this.ui.hideInspector();
    this.ui.hideTooltip();
    this.ui.setResources(this.gold, this.star, this.lives, RULES.startingLives);
    this.ui.showBanner('第 1 波准备', '先种下一片麦田', '金币来自收获。先播 3–4 块麦田，再在石台建第一座箭塔。', false, 3800);
    this.world.setMenuMode(false);
    this.world.resetCamera(true);
    this.previewRange.visible = false;
    this.phase = 'playing';
    this.updateHudNow();
    this.audio.play('click');
  }

  private resumeGame() {
    this.ui.hidePause();
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.ui.showGameHud();
    }
  }

  private togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.ui.showPause();
      this.ui.hideTooltip();
      this.ui.hideInspector();
      this.ui.setSelectedTool(null);
      this.selectedTool = null;
      this.hovered = null;
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
    }
    this.ui.showHelp();
    this.ui.hideTooltip();
  }

  private closeHelp() {
    if (this.helpPausedRun && this.phase === 'paused') {
      this.phase = 'playing';
      this.helpPausedRun = false;
    }
  }

  private goToMenu() {
    this.clearDynamicWorld();
    this.clearHover();
    this.ui.hideEnd();
    this.ui.hidePause();
    this.ui.hideHelp();
    this.ui.hideGameHud();
    this.ui.showMenu(this.save.bestWave, this.save.victories);
    this.world.setMenuMode(true);
    this.world.resetCamera(true);
    this.phase = 'menu';
  }

  private endGame(victory: boolean) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = victory ? 'victory' : 'defeat';
    this.clearTowerSelection();
    this.selectedTool = null;
    this.ui.setSelectedTool(null);
    this.previewRange.visible = false;
    this.clearHighlights();
    this.ui.hideTooltip();
    this.ui.hideInspector();
    this.clearHover();
    const reachedWave = victory ? RULES.totalWaves : Math.max(1, this.wave);
    this.save.bestWave = Math.max(this.save.bestWave, reachedWave);
    if (victory) this.save.victories += 1;
    writeSave(this.save);
    this.ui.showEnd({
      victory,
      wave: reachedWave,
      total: RULES.totalWaves,
      kills: this.stats.kills,
      harvestedGold: Math.round(this.stats.harvestedGold),
      towersBuilt: this.stats.towersBuilt,
      seconds: this.stats.playSeconds,
      record: `最佳纪录：第 ${this.save.bestWave} 波${this.save.victories > 0 ? ` · ${this.save.victories} 次守成` : ''}`,
    });
    this.world.setMenuMode(true);
    this.audio.play(victory ? 'victory' : 'defeat');
    if (victory) {
      this.ui.showBanner('守成', '山野重归宁静', `你坚守了 ${timeText(this.stats.playSeconds)}，守住了所有农田。`, false, 4800);
      for (let i = 0; i < 5; i++) {
        this.particles.spawn(
          new Vector3(WORLD.core.x + (Math.random() - 0.5) * 6, 1 + Math.random() * 4, WORLD.core.z + (Math.random() - 0.5) * 6),
          0xf3c455,
          18,
          { speed: 3.4, life: 2.4, size: 0.15, gravity: 1.1, up: 3.8 },
        );
      }
    }
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

  /* ───────────────────────────── plots / crops ───────────────────────────── */

  private resetPlots() {
    this.plots = [];
    for (const view of this.world.plotVisuals) {
      while (view.cropAnchor.children.length) view.cropAnchor.children[0].removeFromParent();
      view.locked.visible = view.spec.index >= WORLD.farm.initialUnlocked;
      view.scorched.visible = false;
      view.matureGlow.visible = false;
      view.highlight.visible = false;
      const plot: PlotRuntime = {
        spec: view.spec,
        unlocked: view.spec.index < WORLD.farm.initialUnlocked,
        scorched: false,
        crop: null,
        group: view.group,
      };
      this.plots.push(plot);
    }
  }

  private viewFor(index: number): PlotVisual {
    return this.world.plotVisuals[index];
  }

  private unlockCost(index: number) {
    const i = Math.max(0, index - WORLD.farm.initialUnlocked);
    return WORLD.farm.unlockCosts[Math.min(i, WORLD.farm.unlockCosts.length - 1)] ?? 110;
  }

  private syncPlot(plot: PlotRuntime) {
    const view = this.viewFor(plot.spec.index);
    view.locked.visible = !plot.unlocked;
    view.scorched.visible = plot.scorched;
    view.matureGlow.visible = !!plot.crop?.mature;
    view.highlight.visible = false;
  }

  private clearCropVisual(plot: PlotRuntime) {
    const view = this.viewFor(plot.spec.index);
    while (view.cropAnchor.children.length) view.cropAnchor.children[0].removeFromParent();
  }

  private setCropVisual(plot: PlotRuntime, stage: CropStage) {
    if (!plot.crop) return;
    const view = this.viewFor(plot.spec.index);
    this.clearCropVisual(plot);
    const art = this.art.crop(plot.crop.type, stage, stage === 3);
    art.group.rotation.y = ((plot.spec.index * 2.399) % (Math.PI * 2)) + 0.4;
    art.group.scale.setScalar(0.92 + ((plot.spec.index * 7) % 5) * 0.018);
    view.cropAnchor.add(art.group);
  }

  private plantPlot(index: number) {
    if (this.phase !== 'playing' || !this.selectedTool || this.selectedTool.kind !== 'crop') return false;
    return this.plantCrop(index, this.selectedTool.id as CropId, false);
  }

  private plantCrop(index: number, type: CropId, unlockIfNeeded: boolean) {
    const plot = this.plots[index];
    if (!plot) return false;
    if (!plot.unlocked) {
      if (!unlockIfNeeded) return false;
      return this.tryUnlock(index, true);
    }
    if (plot.scorched) return false;
    if (plot.crop) {
      if (plot.crop.mature) {
        this.harvestPlot(index);
        return true;
      }
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
    const pos = new Vector3(plot.spec.x, 0.45, plot.spec.z);
    this.particles.spawn(pos, def.accent, 7, { speed: 1.5, life: 0.5, size: 0.075, gravity: 3.5, up: 1.4 });
    this.floaters.spawn(`-${def.cost}`, new Vector3(plot.spec.x, 0.9, plot.spec.z), 'warn');
    this.audio.play('plant');
    this.updateHudNow();
    return true;
  }

  private harvestPlot(index: number, silent = false) {
    const plot = this.plots[index];
    if (!plot?.crop?.mature) return false;
    const def = CROPS[plot.crop.type];
    this.gold += def.yieldGold;
    this.star += def.yieldStar;
    this.stats.harvestedGold += def.yieldGold;
    this.stats.harvestedStar += def.yieldStar;
    const pos = new Vector3(plot.spec.x, 0.75, plot.spec.z);
    this.particles.burstHarvest(pos, def.color, def.yieldStar > 0);
    this.floaters.spawn(`+${def.yieldGold}`, new Vector3(plot.spec.x, 1.2, plot.spec.z), 'gold');
    if (def.yieldStar > 0) {
      this.floaters.spawn(`+${def.yieldStar} 星辉`, new Vector3(plot.spec.x + 0.3, 1.7, plot.spec.z), 'star');
      this.audio.play('star');
    } else {
      this.audio.play('harvest');
    }
    plot.crop = null;
    this.clearCropVisual(plot);
    this.syncPlot(plot);
    this.updateHudNow();
    if (!silent && def.yieldStar > 0) {
      this.ui.toast(`收获 ${def.name}：+${def.yieldGold} 金币，+${def.yieldStar} 星辉`, 'star');
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

  private updateCrops(dt: number) {
    this.runTime += dt;
    for (const plot of this.plots) {
      if (!plot.crop) continue;
      const def = CROPS[plot.crop.type];
      if (!plot.crop.mature) {
        plot.crop.elapsed += dt;
        const progress = Math.min(1, plot.crop.elapsed / def.growTime);
        const nextStage: CropStage = progress >= 1 ? 3 : progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
        const becameMature = nextStage === 3;
        if (nextStage !== plot.crop.stage) {
          plot.crop.stage = nextStage;
          plot.crop.mature = becameMature;
          this.setCropVisual(plot, nextStage);
          this.syncPlot(plot);
          if (becameMature) {
            this.particles.spawn(new Vector3(plot.spec.x, 0.6, plot.spec.z), def.accent, 4, {
              speed: 0.8,
              life: 0.5,
              size: 0.06,
              gravity: 2,
              up: 1.2,
            });
          }
        }
      }
      const view = this.viewFor(plot.spec.index);
      const visual = view.cropAnchor.children[0];
      if (visual) {
        visual.rotation.z = Math.sin(this.runTime * 1.6 + plot.spec.index * 1.7) * 0.025;
      }
    }
  }

  private tryUnlock(index: number, silent = false) {
    const plot = this.plots[index];
    if (!plot || plot.unlocked) return false;
    const cost = this.unlockCost(index);
    if (this.gold < cost) {
      this.nudgeError(`金币不足：开垦这块田需要 ${cost} 金币`);
      return false;
    }
    this.gold -= cost;
    plot.unlocked = true;
    this.syncPlot(plot);
    this.particles.spawn(new Vector3(plot.spec.x, 0.4, plot.spec.z), 0x9ac46b, 12, {
      speed: 2.2,
      life: 0.7,
      size: 0.08,
      gravity: 4,
      up: 2,
    });
    this.floaters.spawn(`-${cost}`, new Vector3(plot.spec.x, 0.95, plot.spec.z), 'warn');
    this.audio.play('build');
    if (!silent) this.ui.toast(`开垦了一块新农田（-${cost} 金币）`, 'default');
    this.updateHudNow();
    return true;
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
    this.particles.spawn(new Vector3(plot.spec.x, 0.4, plot.spec.z), 0xa8c97b, 10, {
      speed: 2,
      life: 0.6,
      size: 0.075,
      gravity: 3,
      up: 1.8,
    });
    this.audio.play('build');
    this.ui.toast(`焦土已经修复（-${cost} 金币）`, 'default');
    this.updateHudNow();
    return true;
  }

  private trampleCrops(count: number) {
    const planted = this.plots.filter((plot) => plot.crop && plot.unlocked && !plot.scorched);
    if (planted.length === 0) return 0;
    const shuffled = [...planted].sort(() => Math.random() - 0.5);
    const destroyed = shuffled.slice(0, Math.min(count, shuffled.length));
    for (const plot of destroyed) {
      plot.crop = null;
      plot.scorched = true;
      this.clearCropVisual(plot);
      this.syncPlot(plot);
      this.particles.spawn(new Vector3(plot.spec.x, 0.5, plot.spec.z), 0x4a3d2f, 10, {
        speed: 1.6,
        life: 0.8,
        size: 0.11,
        gravity: 2,
        up: 1.4,
      });
      this.particles.spawn(new Vector3(plot.spec.x, 0.5, plot.spec.z), 0xef8056, 6, {
        speed: 2.2,
        life: 0.6,
        size: 0.07,
        gravity: 3.5,
        up: 2.2,
      });
    }
    return destroyed.length;
  }

  /* ───────────────────────────── towers ───────────────────────────── */

  private towerAtPad(padIndex: number) {
    return this.towers.find((tower) => tower.pad.index === padIndex) ?? null;
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
    ring.position.y = 0.36;
    ring.visible = false;
    ring.renderOrder = 1;
    return ring;
  }

  private buildTowerAt(padIndex: number, type: TowerId) {
    if (this.phase !== 'playing') return false;
    const padSpec = this.world.padVisuals[padIndex]?.spec;
    if (!padSpec) return false;
    if (this.towerAtPad(padIndex)) {
      this.ui.toast('这个石台已经有防御塔了', 'default');
      this.audio.play('error');
      return false;
    }
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
    art.group.position.set(padSpec.x, 0.02, padSpec.z);
    art.group.rotation.y = padSpec.rotation;
    this.world.scene.add(art.group);
    const rangeRing = this.makeRangeRing(def.accent, 0.42);
    rangeRing.position.set(padSpec.x, 0.34, padSpec.z);
    rangeRing.scale.setScalar(levelDef.range);
    this.world.scene.add(rangeRing);
    const tower: TowerRuntime = {
      id: type,
      pad: padSpec,
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
    this.world.padVisuals[padIndex].marker.visible = false;
    this.stats.towersBuilt += 1;
    this.particles.burstBuild(new Vector3(padSpec.x, 0.35, padSpec.z));
    this.audio.play('build');
    this.ui.toast(`${def.name} 建成！`, 'default');
    this.selectTowerObject(tower);
    this.updateHudNow();
    return true;
  }

  private upgradeTower(tower: TowerRuntime) {
    if (this.phase !== 'playing') return false;
    const def = TOWERS[tower.id];
    if (tower.level >= 3) return false;
    const nextLevel = (tower.level + 1) as 2 | 3;
    const goldCost = def.upgradeGold[tower.level - 1];
    const starCost = def.upgradeStar[tower.level - 1];
    if (this.gold < goldCost || this.star < starCost) {
      this.nudgeError(
        `升级 ${def.name} 需要 ${goldCost} 金币${starCost ? ` + ${starCost} 星辉` : ''}`,
      );
      return false;
    }
    this.gold -= goldCost;
    this.star -= starCost;
    this.particles.burstBuild(new Vector3(tower.pad.x, 0.6, tower.pad.z));
    tower.group.removeFromParent();
    const art = this.art.tower(tower.id, nextLevel);
    art.group.position.set(tower.pad.x, 0.02, tower.pad.z);
    art.group.rotation.y = tower.pad.rotation;
    this.world.scene.add(art.group);
    tower.group = art.group;
    tower.level = nextLevel;
    const stats = def.levels[nextLevel - 1];
    tower.damage = stats.damage;
    tower.range = stats.range;
    tower.splash = stats.splash;
    tower.slow = stats.slow;
    tower.slowDuration = stats.slowDuration;
    tower.fireCooldown = stats.cooldown;
    tower.cooldown = Math.min(tower.cooldown, stats.cooldown);
    tower.investedGold += goldCost;
    tower.investedStar += starCost;
    tower.rangeRing.scale.setScalar(tower.range);
    this.audio.play('upgrade');
    this.ui.toast(`${def.name} 升至 Lv.${nextLevel}`, 'gold');
    this.showTowerInspector(tower);
    this.updateHudNow();
    return true;
  }

  private sellTower(tower: TowerRuntime) {
    const goldRefund = Math.round(tower.investedGold * RULES.sellRefund);
    const starRefund = Math.floor(tower.investedStar * RULES.sellRefund);
    this.gold += goldRefund;
    this.star += starRefund;
    tower.group.removeFromParent();
    tower.rangeRing.removeFromParent();
    this.world.padVisuals[tower.pad.index].marker.visible = true;
    this.towers = this.towers.filter((t) => t !== tower);
    this.clearTowerSelection();
    this.particles.spawn(new Vector3(tower.pad.x, 0.5, tower.pad.z), 0xd9c9a8, 10, {
      speed: 1.6,
      life: 0.7,
      size: 0.09,
      gravity: 4,
      up: 1.7,
    });
    this.audio.play('sell');
    this.ui.toast(`拆除防御塔：+${goldRefund} 金币${starRefund ? ` +${starRefund} 星辉` : ''}`, 'default');
    this.updateHudNow();
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
      { label: '射程', value: level.range.toFixed(1) },
      { label: '攻击间隔', value: `${level.cooldown.toFixed(2)}s` },
      { label: '每秒伤害', value: (level.damage / level.cooldown).toFixed(1) },
    ];
    if (tower.id === 'cannon') stats.push({ label: '爆炸半径', value: level.splash.toFixed(1) });
    if (tower.id === 'star') stats.push({ label: '减速', value: `${Math.round(level.slow * 100)}% / ${level.slowDuration}s` });
    if (tower.id === 'arrow') stats.push({ label: '特性', value: '单体速射' });
    const canUpgrade = tower.level < 3;
    const nextGold = canUpgrade ? def.upgradeGold[tower.level - 1] : 0;
    const nextStar = canUpgrade ? def.upgradeStar[tower.level - 1] : 0;
    const upgradeEnabled =
      canUpgrade && this.phase === 'playing' && this.gold >= nextGold && this.star >= nextStar;
    const upgradeLabel = canUpgrade
      ? `升级 Lv.${tower.level + 1} · ${nextGold} 金币${nextStar ? ` + ${nextStar} 星辉` : ''}`
      : '已达最高等级';
    const refund = Math.round(tower.investedGold * RULES.sellRefund);
    const note =
      tower.level >= 3
        ? '这座塔已经抵达最高等级。记得留些金币修复被践踏的焦土。'
        : upgradeEnabled
          ? `${def.name}会随等级提高伤害与射程。升级同时消耗金币与星辉。`
          : `还不够升级：需要 ${nextGold} 金币${nextStar ? `和 ${nextStar} 星辉` : ''}。多种星辉花可以补充星辉。`;
    this.ui.showInspector({
      icon: def.icon,
      name: def.name,
      sub: `${def.en} · Lv.${tower.level}`,
      stats,
      note,
      upgradeLabel,
      upgradeEnabled,
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
    if (this.wave >= RULES.totalWaves) return;
    if (early) {
      this.gold += RULES.earlyStartBonus;
      this.ui.toast(`提前迎战：+${RULES.earlyStartBonus} 金币`, 'gold');
    }
    this.spawnWave();
  }

  private spawnWave() {
    this.wave += 1;
    const def = WAVES[this.wave - 1];
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
    group.userData.lateral = def.boss ? 0 : (Math.random() - 0.5) * 0.95;
    group.userData.phase = Math.random() * Math.PI * 2;
    group.userData.legs = art.legs;
    group.userData.visual = art.visual;
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
    const enemy: EnemyRuntime = {
      id,
      hp: def.hp,
      maxHp: def.hp,
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
      this.spawnEnemy(this.spawnSchedule[this.spawnIndex].enemy);
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
    this.lives -= def.coreDamage;
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
    this.floaters.spawn(`-${def.coreDamage} 生命`, new Vector3(WORLD.core.x, 3, WORLD.core.z), 'warn');
    if (destroyed > 0) {
      this.ui.toast(`${def.name}冲过防线：-${def.coreDamage} 生命，${destroyed} 块农田被烧毁！`, 'warn');
    } else {
      this.ui.toast(`${def.name}冲过防线：-${def.coreDamage} 生命`, 'warn');
    }
    if (this.lives <= 0) {
      this.lives = 0;
      this.updateHudNow();
      this.endGame(false);
    }
  }

  private killEnemy(enemy: EnemyRuntime) {
    if (enemy.dead) return;
    enemy.dead = true;
    const def = ENEMIES[enemy.id];
    this.gold += def.reward;
    this.stats.kills += 1;
    this.waveResolved += 1;
    this.particles.burstDeath(enemy.group.position.clone().add(new Vector3(0, 0.35, 0)), def.tint);
    this.floaters.spawn(`+${def.reward}`, enemy.group.position.clone().add(new Vector3(0, def.height + 0.2, 0)), 'gold');
    if (def.boss) {
      this.star += RULES.bossStarDrop;
      this.ui.showBanner('BOSS 击破', '鹿王倒下了', `获得 ${RULES.bossStarDrop} 星辉 · +${def.reward} 金币`, false, 2800);
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
      const dx = enemy.group.position.x - tower.pad.x;
      const dz = enemy.group.position.z - tower.pad.z;
      if (dx * dx + dz * dz > tower.range * tower.range) continue;
      if (!best || enemy.progress > best.progress) best = enemy;
    }
    return best;
  }

  private fireTower(tower: TowerRuntime, target: EnemyRuntime) {
    const def = TOWERS[tower.id];
    const origin =
      tower.id === 'arrow'
        ? new Vector3(tower.pad.x, 3.6, tower.pad.z)
        : tower.id === 'cannon'
          ? new Vector3(tower.pad.x, 2.5, tower.pad.z)
          : new Vector3(tower.pad.x, 3.7, tower.pad.z);
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
        tower.cooldown = tower.fireCooldown;
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
    const reward = RULES.waveClearGold(this.wave);
    const starReward = RULES.waveClearStar(this.wave);
    this.gold += reward;
    this.star += starReward;
    this.audio.play('harvest');
    if (this.wave >= RULES.totalWaves) {
      this.ui.showBanner('最终波', '山野守住了', `最后一波已清除 · +${reward} 金币`, false, 2600);
      this.updateHudNow();
      this.endGame(true);
      return;
    }
    this.ui.showBanner(
      `第 ${this.wave} 波清除`,
      `+${reward} 金币${starReward ? ` · +${starReward} 星辉` : ''}`,
      '准备时间开始，补种、修田、升级防御。',
      false,
      3200,
    );
    this.ui.toast(`第 ${this.wave} 波清除：+${reward} 金币${starReward ? ` +${starReward} 星辉` : ''}`, 'gold');
    if (starReward > 0) this.ui.toast(`挑战奖励：+${starReward} 星辉`, 'star');
    this.beginPrep(RULES.prepBetweenWaves);
    this.updateHudNow();
  }

  /* ───────────────────────────── input ───────────────────────────── */

  private bindInput() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.phase !== 'playing' || event.button !== 0) return;
    const pick = this.world.pick(event.clientX, event.clientY);
    this.pointer = {
      downX: event.clientX,
      downY: event.clientY,
      time: performance.now(),
      pick,
      acted: false,
      painting: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    const tool = this.selectedTool;
    const toolMatches =
      tool !== null &&
      pick !== null &&
      ((tool.kind === 'crop' && pick.kind === 'plot') || (tool.kind === 'tower' && pick.kind === 'pad'));
    if (!toolMatches || !pick) return;
    this.world.controls.enabled = false;
    this.pointer.acted = true;
    this.pointer.painting = tool.kind === 'crop' && event.pointerType === 'mouse';
    if (this.pointer.painting) {
      this.lastPaintPlot = -1;
      this.canvas.setPointerCapture(event.pointerId);
    }
    this.handleTap(pick, event.clientX, event.clientY);
    if (this.pointer?.painting && pick.kind === 'plot') this.lastPaintPlot = pick.index;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.phase !== 'playing') return;
    if (this.pointer?.painting) {
      const pick = this.world.pick(event.clientX, event.clientY);
      if (pick?.kind === 'plot' && pick.index !== this.lastPaintPlot) {
        this.lastPaintPlot = pick.index;
        const plot = this.plots[pick.index];
        if (plot.unlocked && !plot.scorched && !plot.crop) this.plantPlot(pick.index);
      }
      return;
    }
    if (event.pointerType !== 'mouse') return;
    this.updateHover(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointer) {
      this.world.controls.enabled = true;
      return;
    }
    const state = this.pointer;
    const moved = Math.hypot(event.clientX - state.downX, event.clientY - state.downY);
    if (!state.acted && moved < 7 && performance.now() - state.time < 900) {
      const pick = this.world.pick(event.clientX, event.clientY);
      if (pick) this.handleTap(pick, event.clientX, event.clientY);
      else {
        this.clearTowerSelection();
        this.ui.hideTooltip();
      }
    }
    if (state.painting) {
      try {
        this.canvas.releasePointerCapture(state.pointerId);
      } catch {
        // Pointer capture may already be gone on touch cancellation.
      }
    }
    this.pointer = null;
    this.world.controls.enabled = true;
    void event;
  };

  private onPointerLeave = () => {
    if (this.pointer?.painting) return;
    this.clearHover();
  };

  private handleTap(pick: { kind: 'plot' | 'pad'; index: number }, clientX: number, clientY: number) {
    if (pick.kind === 'plot') this.handlePlotTap(pick.index);
    else this.handlePadTap(pick.index);
    if (this.phase === 'playing') this.updateHover(clientX, clientY);
  }

  private handlePlotTap(index: number) {
    if (this.phase !== 'playing') return;
    const plot = this.plots[index];
    if (!plot) return;
    if (!plot.unlocked) {
      this.tryUnlock(index);
      return;
    }
    if (plot.scorched) {
      this.repairPlot(index);
      return;
    }
    if (plot.crop) {
      if (plot.crop.mature) {
        this.harvestPlot(index);
      } else if (this.selectedTool?.kind === 'crop') {
        this.ui.toast('作物还在生长，成熟后点击收获', 'default');
      } else {
        this.ui.toast(`${CROPS[plot.crop.type].name}正在生长，成熟后点击收获`, 'default');
      }
      return;
    }
    if (this.selectedTool?.kind === 'crop') {
      this.plantPlot(index);
    } else {
      this.ui.toast('先在下方选择一种作物，再点击空地播种', 'default');
    }
  }

  private handlePadTap(index: number) {
    if (this.phase !== 'playing') return;
    const tower = this.towerAtPad(index);
    if (tower) {
      this.selectTowerObject(tower);
      return;
    }
    if (this.selectedTool?.kind === 'tower') {
      this.buildTowerAt(index, this.selectedTool.id as TowerId);
    } else {
      this.clearTowerSelection();
      this.ui.toast('先在下方选择防御塔，再点击石台建造', 'default');
    }
  }

  private updateHover(clientX: number, clientY: number) {
    if (this.phase !== 'playing') return;
    const pick = this.world.pick(clientX, clientY);
    if (!pick) {
      this.clearHover();
      return;
    }
    if (this.hovered?.kind === pick.kind && this.hovered.index === pick.index) {
      this.positionTooltip(pick, clientX, clientY);
      return;
    }
    this.clearHover();
    this.hovered = pick;
    if (pick.kind === 'plot') {
      const view = this.viewFor(pick.index);
      view.highlight.visible = true;
      this.setPreviewRange(false);
    } else {
      const view = this.world.padVisuals[pick.index];
      view.highlight.visible = true;
      const tower = this.towerAtPad(pick.index);
      if (!tower && this.selectedTool?.kind === 'tower') {
        this.previewRange.position.set(view.spec.x, 0.34, view.spec.z);
        this.previewRange.scale.setScalar(TOWERS[this.selectedTool.id as TowerId].levels[0].range);
        this.previewRange.visible = true;
      } else {
        this.previewRange.visible = false;
      }
    }
    this.positionTooltip(pick, clientX, clientY);
  }

  private positionTooltip(pick: { kind: 'plot' | 'pad'; index: number }, x: number, y: number) {
    const html = pick.kind === 'plot' ? this.plotTooltip(pick.index) : this.padTooltip(pick.index);
    if (!html) {
      this.ui.hideTooltip();
      return;
    }
    this.ui.showTooltip(html, x, y);
  }

  private plotTooltip(index: number) {
    const plot = this.plots[index];
    if (!plot) return '';
    if (!plot.unlocked) return `<b>未开垦的农田</b><br>点击花 <b>${this.unlockCost(index)} 金币</b>开垦`;
    if (plot.scorched) return `<b>焦土</b><br>点击花 <b>${WORLD.farm.repairCost} 金币</b>修复`;
    if (!plot.crop) {
      const def = this.selectedTool?.kind === 'crop' ? CROPS[this.selectedTool.id as CropId] : null;
      if (def) return `<b>${def.name}</b><br>点击播种 · ${def.cost} 金币<br>${def.growTime} 秒成熟 · +${def.yieldGold} 金币${def.yieldStar ? ` +${def.yieldStar} 星辉` : ''}`;
      return '<b>空农田</b><br>先在下方选择一种作物';
    }
    const def = CROPS[plot.crop.type];
    if (plot.crop.mature) {
      return `<b>${def.name} · 成熟</b><br>点击收获 · +${def.yieldGold} 金币${def.yieldStar ? ` +${def.yieldStar} 星辉` : ''}`;
    }
    const pct = Math.min(99, Math.floor((plot.crop.elapsed / def.growTime) * 100));
    const left = Math.max(0, def.growTime - plot.crop.elapsed);
    return `<b>${def.name} · 生长中</b><br>${pct}% · 还需 ${left.toFixed(1)} 秒`;
  }

  private padTooltip(index: number) {
    const tower = this.towerAtPad(index);
    if (tower) {
      const def = TOWERS[tower.id];
      return `<b>${def.name} · Lv.${tower.level}</b><br>点击查看属性与升级`;
    }
    if (this.selectedTool?.kind === 'tower') {
      const def = TOWERS[this.selectedTool.id as TowerId];
      return `<b>建造 ${def.name}</b><br>${def.cost} 金币${def.starCost ? ` · ${def.starCost} 星辉` : ''}<br>${def.description}`;
    }
    return '<b>空石台</b><br>选择防御塔后点击建造';
  }

  private setPreviewRange(visible: boolean) {
    this.previewRange.visible = visible;
  }

  private clearHover() {
    for (const view of this.world.plotVisuals) view.highlight.visible = false;
    for (const view of this.world.padVisuals) view.highlight.visible = false;
    this.hovered = null;
    this.previewRange.visible = false;
    this.ui.hideTooltip();
  }

  private clearHighlights() {
    for (const view of this.world.plotVisuals) view.highlight.visible = false;
    for (const view of this.world.padVisuals) view.highlight.visible = false;
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
    this.updateHoverFromPointer();
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
    this.updateHoverFromPointer();
  }

  private updateHoverFromPointer() {
    this.clearHover();
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
        else if (this.selectedTool) {
          this.selectedTool = null;
          this.ui.setSelectedTool(null);
        } else if (this.selectedTower) {
          this.clearTowerSelection();
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
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.wavePhase === 'prep') this.startNextWave(true);
        return;
      }
      if (event.code === 'Escape') return;
      switch (event.code) {
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
        case 'KeyH':
          this.harvestAll();
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
    this.particles.update(dt);
    this.floaters.update(dt, this.world.camera);
    if (this.phase === 'playing' || this.phase === 'paused') this.updateEnemyBars();
    this.ui.tickFps(dt);
    this.world.render();
    requestAnimationFrame(this.loop);
  };

  private step(dt: number) {
    this.stats.playSeconds += dt;
    this.updateWave(dt);
    this.updateCrops(dt);
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
    this.ui.setResources(this.gold, this.star, this.lives, RULES.startingLives);
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    const previewWave =
      this.wavePhase === 'prep'
        ? WAVES[Math.min(RULES.totalWaves, this.wave + 1) - 1]
        : WAVES[Math.max(0, this.wave - 1)];
    const groups = previewWave?.groups ?? [];
    const canStart = this.wavePhase === 'prep' && this.wave < RULES.totalWaves;
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
      wave: this.wavePhase === 'prep' ? Math.min(RULES.totalWaves, this.wave + 1) : this.wave,
      total: RULES.totalWaves,
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
      while (view.cropAnchor.children.length) view.cropAnchor.children[0].removeFromParent();
      view.locked.visible = true;
      view.scorched.visible = false;
      view.matureGlow.visible = false;
      view.highlight.visible = false;
    }
    for (const view of this.world.padVisuals) {
      view.highlight.visible = false;
      view.marker.visible = true;
    }
    this.selectedTower = null;
    this.ui.hideInspector();
    this.clearHover();
  }

  /* ───────────────────────────── debug API ───────────────────────────── */

  private installDebugApi() {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const game = this;
    const api = {
      version: '1.0.0',
      art: game.art.kind,
      get ready() {
        return game.phase !== 'loading';
      },
      getState() {
        return {
          phase: game.phase,
          gold: game.gold,
          star: game.star,
          lives: game.lives,
          wave: game.wave,
          wavePhase: game.wavePhase,
          prepRemaining: game.prepRemaining,
          speed: game.speed,
          selectedTool: game.selectedTool,
          enemies: game.enemies.map((enemy) => ({
            id: enemy.id,
            hp: enemy.hp,
            progress: enemy.progress,
          })),
          plots: game.plots.map((plot) => ({
            index: plot.spec.index,
            unlocked: plot.unlocked,
            scorched: plot.scorched,
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
            pad: tower.pad.index,
            level: tower.level,
            damage: tower.damage,
            range: tower.range,
          })),
          stats: { ...game.stats },
        };
      },
      start() {
        game.startGame();
      },
      restart() {
        game.startGame();
      },
      menu() {
        game.goToMenu();
      },
      simulate(seconds: number) {
        const limit = Math.min(cleanNumber(seconds), 600);
        let remaining = limit;
        let guard = 0;
        while (remaining > 0 && game.phase === 'playing' && guard < 40000) {
          const dt = Math.min(RULES.simStep, remaining);
          game.step(dt);
          remaining -= dt;
          guard++;
        }
        game.updateHudNow();
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
        return game.plantCrop(index, type, false);
      },
      plantSelected(index: number) {
        return game.plantPlot(index);
      },
      harvest(index: number) {
        return game.harvestPlot(index);
      },
      harvestAll() {
        game.harvestAll();
        return game.gold;
      },
      build(pad: number, type: TowerId) {
        return game.buildTowerAt(pad, type);
      },
      upgrade(pad: number) {
        const tower = game.towerAtPad(pad);
        return tower ? game.upgradeTower(tower) : false;
      },
      sell(pad: number) {
        const tower = game.towerAtPad(pad);
        if (!tower) return false;
        game.sellTower(tower);
        return true;
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
        game.world.camera.position.set(...position);
        game.world.controls.target.set(...target);
        game.world.controls.update();
        game.world.render();
      },
      screenPoint(kind: 'plot' | 'pad', index: number) {
        const point =
          kind === 'plot'
            ? new Vector3(PLOTS[index].x, 0.5, PLOTS[index].z)
            : new Vector3(TOWER_PADS[index].x, 0.5, TOWER_PADS[index].z);
        return game.world.screenPoint(point);
      },
      metrics() {
        return {
          fps: game.ui.fps,
          calls: game.world.renderer.info.render.calls,
          triangles: game.world.renderer.info.render.triangles,
          pixelRatio: game.world.renderer.getPixelRatio(),
          width: window.innerWidth,
          height: window.innerHeight,
          camera: {
            position: game.world.camera.position.toArray(),
            target: game.world.controls.target.toArray(),
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
