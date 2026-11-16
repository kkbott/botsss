import { CROPS, ENEMIES, RULES, TOWERS, WORLD } from './config';
import type { CropId, TowerId } from './types';

export interface UIActions {
  start: () => void;
  resume: () => void;
  restart: () => void;
  quitToMenu: () => void;
  selectCrop: (id: CropId) => void;
  selectTower: (id: TowerId) => void;
  harvestAll: () => void;
  nextWave: () => void;
  togglePause: () => void;
  toggleSpeed: () => void;
  toggleSound: () => void;
  showHelp: () => void;
  upgradeTower: () => void;
  sellTower: () => void;
  closeInspector: () => void;
  retry: () => void;
}

export interface InspectorData {
  icon: string;
  name: string;
  sub: string;
  stats: Array<{ label: string; value: string }>;
  note: string;
  upgradeLabel: string;
  upgradeEnabled: boolean;
  sellLabel: string;
  sellEnabled: boolean;
}

export interface WaveHud {
  mode: 'prep' | 'active';
  wave: number;
  total: number;
  timer: number;
  progress: number;
  enemiesLeft: number;
  preview: Array<{ id: string; count: number }>;
  canStart: boolean;
}

export interface EndData {
  victory: boolean;
  wave: number;
  total: number;
  kills: number;
  harvestedGold: number;
  towersBuilt: number;
  seconds: number;
  record: string;
}

const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};

const WAVE_KICKER = {
  prep: '准备',
  active: '交战',
} as const;

function formatTime(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

export class GameUI {
  private readonly actions: UIActions;
  private readonly hud = el('hud');
  private readonly bottomBar = el('bottom-bar');
  private readonly loading = el('loading-screen');
  private readonly menu = el('menu-screen');
  private readonly help = el('help-screen');
  private readonly pause = el('pause-screen');
  private readonly end = el('end-screen');
  private readonly inspector = el('inspector');
  private readonly tooltip = el('tooltip');
  private readonly toastLayer = el('toast-layer');
  private readonly bannerEl = el('banner');
  private readonly hintEl = el('context-hint');
  private readonly floatLayer = el('float-layer');
  private readonly loadingFill = el('loading-fill');
  private readonly loadingNote = el('loading-note');
  private readonly waveKicker = el('wave-kicker');
  private readonly waveCount = el('wave-count');
  private readonly wavePreview = el('wave-preview');
  private readonly waveProgress = el<HTMLDivElement>('wave-progress-fill');
  private readonly waveTimer = el('wave-timer');
  private readonly waveSub = el('wave-sub');
  private readonly nextWaveBtn = el<HTMLButtonElement>('btn-next-wave');
  private readonly nextWaveLabel = el('btn-next-label');
  private readonly statGold = el('stat-gold');
  private readonly statStar = el('stat-star');
  private readonly statLives = el('stat-lives');
  private readonly fpsBadge = el('fps-badge');
  private readonly soundBtn = el('btn-sound');
  private readonly speedBtn = el('btn-speed');
  private readonly menuBest = el('menu-best');
  private readonly contextCards: HTMLButtonElement[];
  private bannerTimeout = 0;
  private hintTimeout = 0;
  private fpsAccum = 0;
  private fpsCount = 0;
  private lastFpsValue = 0;
  private currentTool: { kind: 'crop' | 'tower'; id: CropId | TowerId } | null = null;
  onHelpClosed: (() => void) | null = null;

  constructor(actions: UIActions) {
    this.actions = actions;
    this.contextCards = Array.from(document.querySelectorAll<HTMLButtonElement>('.tool-card'));

    el('btn-start').addEventListener('click', () => this.actions.start());
    el('btn-howto').addEventListener('click', () => this.actions.showHelp());
    el('btn-help').addEventListener('click', () => this.actions.showHelp());
    el('btn-pause').addEventListener('click', () => this.actions.togglePause());
    el('btn-speed').addEventListener('click', () => this.actions.toggleSpeed());
    el('btn-sound').addEventListener('click', () => this.actions.toggleSound());
    el('btn-harvest-all').addEventListener('click', () => this.actions.harvestAll());
    el('btn-next-wave').addEventListener('click', () => this.actions.nextWave());
    el('btn-resume').addEventListener('click', () => this.actions.resume());
    el('btn-restart').addEventListener('click', () => this.actions.restart());
    el('btn-quit').addEventListener('click', () => this.actions.quitToMenu());
    el('btn-again').addEventListener('click', () => this.actions.retry());
    el('btn-back-menu').addEventListener('click', () => this.actions.quitToMenu());
    el('btn-inspector-close').addEventListener('click', () => this.actions.closeInspector());
    el('btn-upgrade').addEventListener('click', () => this.actions.upgradeTower());
    el('btn-sell').addEventListener('click', () => this.actions.sellTower());

    document.querySelectorAll<HTMLElement>('[data-close="help"]').forEach((node) => {
      node.addEventListener('click', () => this.hideHelp());
    });
    this.help.addEventListener('click', (event) => {
      if (event.target === this.help) this.hideHelp();
    });

    for (const card of this.contextCards) {
      card.addEventListener('click', () => {
        const crop = card.dataset.crop as CropId | undefined;
        const tower = card.dataset.tower as TowerId | undefined;
        if (crop) this.actions.selectCrop(crop);
        else if (tower) this.actions.selectTower(tower);
      });
    }

    const helpRepair = this.help.querySelector('.help-list li:last-child');
    if (helpRepair) {
      helpRepair.innerHTML = helpRepair.innerHTML.replace('{{repairCost}}', String(WORLD.farm.repairCost));
    }
  }

  get floatingLayer() {
    return this.floatLayer;
  }

  setLoading(progress: number, note?: string) {
    this.loadingFill.style.width = `${Math.min(100, Math.max(2, progress * 100)).toFixed(1)}%`;
    if (note) this.loadingNote.textContent = note;
  }

  hideLoading() {
    this.loading.style.opacity = '0';
    this.loading.style.transition = 'opacity 0.45s ease';
    window.setTimeout(() => {
      this.loading.hidden = true;
    }, 460);
  }

  showMenu(bestWave: number, victories: number) {
    this.menu.hidden = false;
    this.hud.hidden = true;
    this.bottomBar.hidden = true;
    if (bestWave > 0) {
      this.menuBest.textContent = `最佳纪录：第 ${bestWave} 波${victories > 0 ? ` · ${victories} 次守成` : ''}`;
    } else {
      this.menuBest.textContent = '最佳纪录：—';
    }
  }

  hideMenu() {
    this.menu.hidden = true;
  }

  showGameHud() {
    this.hud.hidden = false;
    this.bottomBar.hidden = false;
  }

  hideGameHud() {
    this.hud.hidden = true;
    this.bottomBar.hidden = true;
    this.hideInspector();
    this.hideTooltip();
  }

  setResources(gold: number, star: number, lives: number, maxLives: number) {
    this.statGold.textContent = String(Math.floor(gold));
    this.statStar.textContent = String(Math.floor(star));
    this.statLives.textContent = `${Math.max(0, Math.ceil(lives))}/${maxLives}`;
    this.statLives.closest('.chip')?.classList.toggle('is-danger', lives <= maxLives * 0.3);
    const goldEl = this.statGold;
    const starEl = this.statStar;
    if (goldEl.dataset.last !== String(gold)) {
      goldEl.dataset.last = String(gold);
      goldEl.classList.remove('is-pulse');
      void goldEl.offsetWidth;
      goldEl.classList.add('is-pulse');
    }
    if (starEl.dataset.last !== String(star)) {
      starEl.dataset.last = String(star);
      starEl.classList.remove('is-pulse');
      void starEl.offsetWidth;
      starEl.classList.add('is-pulse');
    }
    for (const card of this.contextCards) {
      const cropId = card.dataset.crop as CropId | undefined;
      const towerId = card.dataset.tower as TowerId | undefined;
      let affordable = true;
      if (cropId) affordable = gold >= CROPS[cropId].cost;
      if (towerId) affordable = gold >= TOWERS[towerId].cost && star >= TOWERS[towerId].starCost;
      card.classList.toggle('is-unaffordable', !affordable);
    }
  }

  updateWave(data: WaveHud) {
    this.waveKicker.textContent = WAVE_KICKER[data.mode];
    this.waveKicker.classList.toggle('is-danger', data.mode === 'active');
    this.waveCount.textContent = data.wave === 0 ? `第 1 / ${data.total} 波` : `第 ${data.wave} / ${data.total} 波`;
    const sub = data.mode === 'prep' ? (data.wave === 0 ? '整备农田与防御' : '下一波正在集结') : `剩余 ${data.enemiesLeft} 只敌人`;
    this.waveSub.textContent = sub;
    this.waveTimer.textContent = formatTime(data.timer);
    this.waveProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, data.progress))})`;
    this.waveProgress.parentElement?.classList.toggle('is-danger', data.mode === 'active' && data.enemiesLeft > 0);
    this.wavePreview.replaceChildren();
    for (const item of data.preview.slice(0, 6)) {
      const tag = document.createElement('span');
      tag.textContent = enemyGlyph(item.id);
      tag.title = ENEMIES[item.id as keyof typeof ENEMIES]?.name ?? item.id;
      this.wavePreview.appendChild(tag);
      const count = document.createElement('b');
      count.textContent = `×${item.count}`;
      this.wavePreview.appendChild(count);
    }
    this.nextWaveBtn.classList.toggle('is-disabled', !data.canStart);
    this.nextWaveBtn.disabled = !data.canStart;
    this.nextWaveLabel.textContent = data.mode === 'prep' ? `提前迎战 +${RULES.earlyStartBonus}` : '战斗进行中';
  }

  setSelectedTool(kind: 'crop' | 'tower' | null, id?: CropId | TowerId) {
    this.currentTool = kind && id ? { kind, id } : null;
    for (const card of this.contextCards) {
      const selected = !!id && (card.dataset.crop === id || card.dataset.tower === id);
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    const canvas = document.getElementById('scene');
    canvas?.classList.toggle('is-planting', kind === 'crop');
    if (kind === 'crop' && id) {
      const crop = CROPS[id as CropId];
      this.setContextHint(`${crop.name}：点击空地播种（${crop.cost} 金币），鼠标拖动可连播；点击成熟作物收获`);
    } else if (kind === 'tower' && id) {
      const tower = TOWERS[id as TowerId];
      const starText = tower.starCost > 0 ? `${tower.starCost} 星辉 + ` : '';
      this.setContextHint(`${tower.name}：点击发光的石台建造（${starText}${tower.cost} 金币）；点击已建塔可升级`);
    } else {
      this.setContextHint('选择作物后点击农田播种；选择防御塔后点击石台建造；点击已有塔可升级');
    }
  }

  setContextHint(text: string, timeout = 0) {
    this.hintEl.textContent = text;
    if (this.hintTimeout) window.clearTimeout(this.hintTimeout);
    if (timeout > 0) {
      this.hintTimeout = window.setTimeout(() => {
        this.hintEl.textContent = this.defaultHint();
      }, timeout);
    }
  }

  defaultHint() {
    if (this.currentTool) {
      if (this.currentTool.kind === 'crop') return '点击空地播种，拖动可连续播种；点击成熟作物收获';
      return '点击发光石台建造；点击已有塔可升级';
    }
    return '选择作物后点击农田播种；选择防御塔后点击石台建造；点击已有塔可升级';
  }

  setSpeedLabel(speed: number) {
    this.speedBtn.textContent = `${speed}×`;
    this.speedBtn.classList.toggle('is-active', speed > 1);
  }

  setMuted(muted: boolean) {
    this.soundBtn.textContent = muted ? '🔇' : '♪';
    this.soundBtn.classList.toggle('is-muted', muted);
    this.soundBtn.setAttribute('aria-label', muted ? '开启音效' : '静音');
  }

  showBanner(kicker: string, title: string, sub: string, danger = false, duration = 2600) {
    this.bannerEl.replaceChildren();
    const k = document.createElement('div');
    k.className = 'banner-kicker';
    k.textContent = kicker;
    const t = document.createElement('div');
    t.className = 'banner-title';
    t.textContent = title;
    const s = document.createElement('div');
    s.className = 'banner-sub';
    s.textContent = sub;
    this.bannerEl.append(k, t, s);
    this.bannerEl.classList.toggle('is-danger', danger);
    this.bannerEl.classList.add('is-showing');
    if (this.bannerTimeout) window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => this.bannerEl.classList.remove('is-showing'), duration);
  }

  toast(text: string, kind: 'default' | 'gold' | 'warn' | 'star' = 'default') {
    const node = document.createElement('div');
    node.className = `toast${kind === 'default' ? '' : ` is-${kind}`}`;
    node.textContent = text;
    this.toastLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 3000);
    while (this.toastLayer.children.length > 3) {
      this.toastLayer.firstElementChild?.remove();
    }
  }

  showTooltip(html: string, x: number, y: number) {
    this.tooltip.innerHTML = html;
    this.tooltip.hidden = false;
    const pad = 12;
    const rect = this.tooltip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - pad, x + 16);
    const top = Math.min(window.innerHeight - rect.height - pad, y + 16);
    this.tooltip.style.left = `${Math.max(pad, left)}px`;
    this.tooltip.style.top = `${Math.max(pad, top)}px`;
    this.tooltip.style.transform = 'none';
  }

  hideTooltip() {
    this.tooltip.hidden = true;
  }

  showInspector(data: InspectorData) {
    el('inspect-icon').textContent = data.icon;
    el('inspect-name').textContent = data.name;
    el('inspect-sub').textContent = data.sub;
    const stats = el('inspect-stats');
    stats.replaceChildren();
    for (const stat of data.stats) {
      const node = document.createElement('div');
      node.className = 'inspect-stat';
      const label = document.createElement('span');
      label.textContent = stat.label;
      const value = document.createElement('b');
      value.textContent = stat.value;
      node.append(label, value);
      stats.appendChild(node);
    }
    el('inspect-note').textContent = data.note;
    const upgrade = el<HTMLButtonElement>('btn-upgrade');
    upgrade.textContent = data.upgradeLabel;
    upgrade.disabled = !data.upgradeEnabled;
    upgrade.hidden = data.upgradeLabel.length === 0;
    const sell = el<HTMLButtonElement>('btn-sell');
    sell.textContent = data.sellLabel;
    sell.disabled = !data.sellEnabled;
    this.inspector.hidden = false;
  }

  hideInspector() {
    this.inspector.hidden = true;
  }

  showPause() {
    this.pause.hidden = false;
  }

  hidePause() {
    this.pause.hidden = true;
  }

  showHelp() {
    this.help.hidden = false;
  }

  hideHelp() {
    this.help.hidden = true;
    this.onHelpClosed?.();
  }

  showEnd(data: EndData) {
    this.end.hidden = false;
    el('end-glyph').textContent = data.victory ? '🌾' : '🥀';
    el('end-kicker').textContent = data.victory ? 'THE FIELD HOLDS' : 'THE FIELD FALLS';
    el('end-title').textContent = data.victory ? '守望成功' : '田野失守';
    el('end-lead').textContent = data.victory
      ? '最后一波野兽退去，风又吹过麦浪。你用六波坚守证明了：最好的防御，是从土地里长出来的。'
      : '守望之种的光芒熄灭了。别灰心——下一季，先把麦田种满，再让箭塔覆盖石径。';
    const stats = el('end-stats');
    stats.replaceChildren();
    const entries: Array<[string, string]> = [
      ['到达波次', `${Math.min(data.wave, data.total)} / ${data.total}`],
      ['击杀野兽', String(data.kills)],
      ['种田收获', `${data.harvestedGold} 金币`],
      ['建成塔台', String(data.towersBuilt)],
      ['坚守时长', formatDuration(data.seconds)],
      ['结果', data.victory ? '守成' : '失守'],
    ];
    for (const [label, value] of entries) {
      const node = document.createElement('div');
      node.className = 'end-stat';
      const l = document.createElement('span');
      l.textContent = label;
      const v = document.createElement('b');
      v.textContent = value;
      node.append(l, v);
      stats.appendChild(node);
    }
    el('end-record').textContent = data.record;
  }

  hideEnd() {
    this.end.hidden = true;
  }

  setNextWaveVisible(visible: boolean) {
    this.nextWaveBtn.style.visibility = visible ? 'visible' : 'hidden';
  }

  tickFps(dt: number) {
    this.fpsAccum += dt;
    this.fpsCount++;
    if (this.fpsAccum >= 0.5) {
      const fps = this.fpsCount / this.fpsAccum;
      this.lastFpsValue = fps;
      this.fpsBadge.textContent = `${Math.round(fps)} FPS`;
      this.fpsBadge.style.color = fps < 45 ? '#ef8056' : fps < 56 ? '#f3c455' : 'rgba(246, 237, 218, 0.6)';
      this.fpsAccum = 0;
      this.fpsCount = 0;
    }
  }

  get fps() {
    return this.lastFpsValue;
  }

  flashDamage() {
    const flash = el('screen-flash');
    flash.classList.add('is-active');
    window.setTimeout(() => flash.classList.remove('is-active'), 140);
    const shell = document.getElementById('scene-shell');
    shell?.classList.remove('is-shaking');
    void shell?.offsetWidth;
    shell?.classList.add('is-shaking');
    window.setTimeout(() => shell?.classList.remove('is-shaking'), 360);
  }

  showRotateHint(show: boolean) {
    el('rotate-hint').hidden = !show;
  }
}

function enemyGlyph(id: string) {
  switch (id) {
    case 'fox':
      return '🦊';
    case 'wolf':
      return '🐺';
    case 'bull':
      return '🐂';
    case 'stag':
      return '🦌';
    default:
      return '•';
  }
}
