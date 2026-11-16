import { CROPS, ENEMIES, GUARDIANS, RULES, TOWERS, WORLD } from './config';
import type {
  BlessingChoice,
  CameraMode,
  CropId,
  GuardianDraftCard,
  GuardianId,
  RivalState,
  RunMode,
  ShopOffer,
  TowerId,
} from './types';

export interface UIActions {
  start: () => void;
  startVersus: () => void;
  resume: () => void;
  restart: () => void;
  quitToMenu: () => void;
  selectCrop: (id: CropId) => void;
  selectTower: (id: TowerId) => void;
  interact: () => void;
  toggleCamera: () => void;
  nextWave: () => void;
  togglePause: () => void;
  toggleSpeed: () => void;
  toggleSound: () => void;
  showHelp: () => void;
  upgradeTower: () => void;
  mergeTower: () => void;
  sellTower: () => void;
  closeInspector: () => void;
  chooseBlessing: (id: string) => void;
  buyShopItem: (id: string) => void;
  rerollShop: () => void;
  closeShop: () => void;
  retry: () => void;
  recruit: () => void;
  selectGuardian: (uid: number) => void;
  dismissBench: (uid: number) => void;
}

export interface RecruitState {
  cost: number;
  gold: number;
  bench: GuardianDraftCard[];
  selected: number | null;
}

export interface InspectorData {
  icon: string;
  name: string;
  sub: string;
  stats: Array<{ label: string; value: string }>;
  note: string;
  upgradeLabel: string;
  upgradeEnabled: boolean;
  mergeLabel: string;
  mergeEnabled: boolean;
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
  mode: RunMode;
  reason: 'cleared' | 'lives' | 'rival' | 'compare';
  wave: number;
  total: number;
  kills: number;
  harvestedGold: number;
  towersBuilt: number;
  seconds: number;
  record: string;
  lives: number;
  maxLives: number;
  blessings: number;
  merges: number;
  recruits: number;
  guardsPlaced: number;
  rivalName?: string;
  rivalLives?: number;
}

export interface InteractPrompt {
  key: string;
  title: string;
  detail: string;
  tone: 'action' | 'info' | 'warn' | 'work';
  progress?: number;
  actionable: boolean;
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
  private readonly statFarm = el('stat-farm');
  private readonly fpsBadge = el('fps-badge');
  private readonly soundBtn = el('btn-sound');
  private readonly speedBtn = el('btn-speed');
  private readonly cameraBtn = el('btn-camera');
  private readonly menuBest = el('menu-best');
  private readonly menuVersusBest = el('menu-versus-best');
  private readonly duelPanel = el('duel-panel');
  private readonly duelYourLives = el('duel-your-lives');
  private readonly duelRivalLives = el('duel-rival-lives');
  private readonly duelRivalName = el('duel-rival-name');
  private readonly duelRivalWave = el('duel-rival-wave');
  private readonly blessingBar = el('blessing-bar');
  private readonly blessingScreen = el('blessing-screen');
  private readonly blessingCards = el('blessing-cards');
  private readonly blessingLead = el('blessing-lead');
  private readonly blessingProgress = el('blessing-progress');
  private readonly shopScreen = el('shop-screen');
  private readonly shopCards = el('shop-cards');
  private readonly shopLead = el('shop-lead');
  private readonly shopReroll = el<HTMLButtonElement>('btn-shop-reroll');
  private readonly shopClose = el<HTMLButtonElement>('btn-shop-close');
  private readonly recruitBar = el('recruit-bar');
  private readonly recruitBtn = el<HTMLButtonElement>('btn-recruit');
  private readonly recruitBench = el('recruit-bench');
  private readonly recruitHint = el('recruit-hint');
  private readonly crosshair = el('crosshair');
  private readonly interactPrompt = el('interact-prompt');
  private readonly interactKey = el('interact-key');
  private readonly interactTitle = el('interact-title');
  private readonly interactDetail = el('interact-detail');
  private readonly interactProgress = el<HTMLElement>('interact-progress');
  private readonly interactFill = el<HTMLElement>('interact-progress-fill');
  private readonly lockHint = el('lock-hint');
  private readonly touchControls = el('touch-controls');
  private readonly interactBtn = el<HTMLButtonElement>('btn-interact');
  private readonly contextCards: HTMLButtonElement[];
  private bannerTimeout = 0;
  private hintTimeout = 0;
  private fpsAccum = 0;
  private fpsCount = 0;
  private lastFpsValue = 0;
  private currentTool: { kind: 'crop' | 'tower' | 'guardian'; id: CropId | TowerId | GuardianId } | null = null;
  private lastRecruitKey = '';
  private lastPromptKey = '';
  private lastLockHintVisible: boolean | null = null;
  private lastTouchVisible: boolean | null = null;
  private lastCameraMode: CameraMode | null = null;
  private lastBlessingKey = '';
  onHelpClosed: (() => void) | null = null;

  constructor(actions: UIActions) {
    this.actions = actions;
    this.contextCards = Array.from(document.querySelectorAll<HTMLButtonElement>('.tool-card'));

    el('btn-start').addEventListener('click', () => this.actions.start());
    el('btn-versus').addEventListener('click', () => this.actions.startVersus());
    el('btn-howto').addEventListener('click', () => this.actions.showHelp());
    el('btn-help').addEventListener('click', () => this.actions.showHelp());
    el('btn-pause').addEventListener('click', () => this.actions.togglePause());
    el('btn-speed').addEventListener('click', () => this.actions.toggleSpeed());
    el('btn-sound').addEventListener('click', () => this.actions.toggleSound());
    el('btn-camera').addEventListener('click', () => this.actions.toggleCamera());
    el('btn-next-wave').addEventListener('click', () => this.actions.nextWave());
    el('btn-resume').addEventListener('click', () => this.actions.resume());
    el('btn-restart').addEventListener('click', () => this.actions.restart());
    el('btn-quit').addEventListener('click', () => this.actions.quitToMenu());
    el('btn-again').addEventListener('click', () => this.actions.retry());
    el('btn-back-menu').addEventListener('click', () => this.actions.quitToMenu());
    el('btn-inspector-close').addEventListener('click', () => this.actions.closeInspector());
    el('btn-upgrade').addEventListener('click', () => this.actions.upgradeTower());
    el('btn-merge').addEventListener('click', () => this.actions.mergeTower());
    el('btn-sell').addEventListener('click', () => this.actions.sellTower());
    this.shopReroll.addEventListener('click', () => this.actions.rerollShop());
    this.shopClose.addEventListener('click', () => this.actions.closeShop());
    this.recruitBtn.addEventListener('click', () => this.actions.recruit());
    this.recruitBench.addEventListener('click', (event) => {
      const dismiss = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-dismiss]');
      if (dismiss) {
        this.actions.dismissBench(Number(dismiss.dataset.dismiss));
        return;
      }
      const card = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-guardian-uid]');
      if (card) this.actions.selectGuardian(Number(card.dataset.guardianUid));
    });
    this.blessingCards.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-blessing]');
      if (!target || target.disabled) return;
      this.actions.chooseBlessing(target.dataset.blessing ?? '');
    });
    this.shopCards.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-shop]');
      if (!target || target.disabled) return;
      this.actions.buyShopItem(target.dataset.shop ?? '');
    });
    el('btn-interact').addEventListener('click', () => this.actions.interact());

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

  showMenu(bestWave: number, victories: number, versusWins = 0, versusBestWave = 0) {
    this.menu.hidden = false;
    this.hud.hidden = true;
    this.bottomBar.hidden = true;
    this.recruitBar.hidden = true;
    this.duelPanel.hidden = true;
    this.blessingBar.hidden = true;
    this.crosshair.hidden = true;
    this.interactPrompt.hidden = true;
    this.touchControls.hidden = true;
    if (bestWave > 0) {
      this.menuBest.textContent = `最佳纪录：第 ${bestWave} 波${victories > 0 ? ` · ${victories} 次守成` : ''}`;
    } else {
      this.menuBest.textContent = '最佳纪录：—';
    }
    this.menuVersusBest.textContent =
      versusBestWave > 0 || versusWins > 0
        ? `对垒纪录：第 ${versusBestWave} 波${versusWins > 0 ? ` · ${versusWins} 胜` : ''}`
        : '对垒纪录：—';
  }

  hideMenu() {
    this.menu.hidden = true;
  }

  setRival(rival: RivalState | null, playerLives = 0) {
    this.duelPanel.hidden = !rival;
    if (!rival) return;
    this.duelYourLives.textContent = String(Math.max(0, Math.ceil(playerLives)));
    this.duelRivalLives.textContent = String(Math.max(0, Math.ceil(rival.lives)));
    this.duelRivalName.textContent = rival.name;
    this.duelRivalWave.textContent = rival.alive
      ? `${rival.title} · 已守 ${rival.wave} 波`
      : `${rival.title} · 已失守`;
  }

  setBlessings(stacks: Array<{ icon: string; name: string; stacks: number }>) {
    const key = stacks.map((entry) => `${entry.name}:${entry.stacks}`).join('|');
    if (key === this.lastBlessingKey) return;
    this.lastBlessingKey = key;
    this.blessingBar.replaceChildren();
    this.blessingBar.hidden = stacks.length === 0;
    for (const entry of stacks) {
      const chip = document.createElement('span');
      chip.className = 'blessing-chip';
      chip.title = `${entry.name} ×${entry.stacks}`;
      const icon = document.createElement('span');
      icon.textContent = entry.icon;
      const name = document.createElement('b');
      name.textContent = entry.name;
      const count = document.createElement('em');
      count.textContent = `×${entry.stacks}`;
      chip.append(icon, name, count);
      this.blessingBar.appendChild(chip);
    }
  }

  showBlessings(choices: BlessingChoice[], wave: number, total: number, pickNumber: number) {
    this.blessingCards.replaceChildren();
    this.blessingLead.textContent = `第 ${wave} / ${total} 波守住了。从下面三项季令中选一项，整局有效。`;
    this.blessingProgress.textContent = `第 ${pickNumber} 次选择`;
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗' } as const;
    for (const choice of choices) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `blessing-card is-${choice.def.rarity}`;
      card.dataset.blessing = choice.def.id;
      const icon = document.createElement('span');
      icon.className = 'blessing-icon';
      icon.textContent = choice.def.icon;
      const name = document.createElement('span');
      name.className = 'blessing-name';
      name.textContent = choice.def.name;
      const desc = document.createElement('span');
      desc.className = 'blessing-desc';
      desc.textContent = choice.def.description;
      const meta = document.createElement('span');
      meta.className = 'blessing-meta';
      const rarity = document.createElement('span');
      rarity.className = 'blessing-rarity';
      rarity.textContent = rarityLabel[choice.def.rarity];
      const stacks = document.createElement('span');
      stacks.textContent = choice.stacks > 0 ? `已叠 ${choice.stacks} / ${choice.def.maxStacks}` : '首次选择';
      meta.append(rarity, stacks);
      card.append(icon, name, desc, meta);
      this.blessingCards.appendChild(card);
    }
    this.blessingScreen.hidden = false;
  }

  hideBlessings() {
    this.blessingScreen.hidden = true;
  }

  showShop(offers: ShopOffer[], wave: number, rerollCost: number, gold: number, purchases = 0) {
    this.shopCards.replaceChildren();
    this.shopLead.textContent = `第 ${wave} 波后，行商在田边歇脚。你有 ${Math.floor(gold)} 金币；每次限购 2 件（已购 ${purchases}/2）。`;
    for (const offer of offers) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `shop-card${offer.sold ? ' is-sold' : ''}`;
      card.dataset.shop = offer.item.id;
      card.disabled = offer.sold || gold < offer.price || purchases >= 2;
      const icon = document.createElement('span');
      icon.className = 'shop-icon';
      icon.textContent = offer.item.icon;
      const name = document.createElement('span');
      name.className = 'shop-name';
      name.textContent = offer.item.name;
      const desc = document.createElement('span');
      desc.className = 'shop-desc';
      desc.textContent = offer.item.description;
      const price = document.createElement('span');
      price.className = `shop-price${gold < offer.price && !offer.sold ? ' is-unaffordable' : ''}`;
      price.textContent = offer.sold ? '已售出' : `🪙 ${offer.price}`;
      card.append(icon, name, desc, price);
      this.shopCards.appendChild(card);
    }
    this.shopReroll.textContent = `刷新商品 · ${rerollCost} 金币`;
    this.shopReroll.disabled = gold < rerollCost;
    this.shopScreen.hidden = false;
  }

  hideShop() {
    this.shopScreen.hidden = true;
  }

  hideIntermission() {
    this.blessingScreen.hidden = true;
    this.shopScreen.hidden = true;
  }

  setRecruitState(state: RecruitState) {
    const key = JSON.stringify({
      cost: state.cost,
      gold: Math.floor(state.gold),
      bench: state.bench.map((card) => `${card.uid}:${card.id}`).join('|'),
      selected: state.selected,
    });
    if (key === this.lastRecruitKey) return;
    this.lastRecruitKey = key;
    const busy = state.bench.length > 0;
    const afford = state.gold >= state.cost;
    this.recruitBtn.textContent = `招募 · ${state.cost}`;
    this.recruitBtn.disabled = busy || !afford;
    this.recruitBtn.classList.toggle('is-unaffordable', !afford);
    this.recruitBtn.title = busy
      ? '待命席已满：先安置或劝返'
      : afford
        ? `花 ${state.cost} 金币随机招募三名乡勇 (R)`
        : `金币不足：需要 ${state.cost} 金币`;
    this.recruitHint.textContent = busy
      ? '选一位乡勇，走到空地按 E 安置 · 俯瞰也可点击地块'
      : `支付 ${state.cost} 金币，随机抽三人进入待命席`;
    this.recruitBench.replaceChildren();
    for (const card of state.bench) {
      const def = GUARDIANS[card.id];
      const slot = document.createElement('div');
      slot.className = `recruit-slot is-${def.rarity}${state.selected === card.uid ? ' is-selected' : ''}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recruit-card';
      button.dataset.guardianUid = String(card.uid);
      button.setAttribute('aria-pressed', state.selected === card.uid ? 'true' : 'false');
      const icon = document.createElement('span');
      icon.className = 'recruit-icon';
      icon.textContent = def.icon;
      const copy = document.createElement('span');
      copy.className = 'recruit-copy';
      const name = document.createElement('b');
      name.textContent = def.name;
      const role = document.createElement('small');
      role.textContent = `${def.role} · ${def.aura ? def.aura.label : '自动攻击'}`;
      copy.append(name, role);
      const rarity = document.createElement('em');
      rarity.className = 'recruit-rarity';
      rarity.textContent = def.rarity === 'common' ? '常见' : def.rarity === 'rare' ? '稀有' : '史诗';
      button.append(icon, copy, rarity);
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'recruit-dismiss';
      dismiss.dataset.dismiss = String(card.uid);
      dismiss.title = '劝返（不返还金币）';
      dismiss.setAttribute('aria-label', `劝返 ${def.name}`);
      dismiss.textContent = '×';
      slot.append(button, dismiss);
      this.recruitBench.appendChild(slot);
    }
  }

  hideRecruitBar() {
    this.recruitBar.hidden = true;
  }

  showGameHud() {
    this.hud.hidden = false;
    this.bottomBar.hidden = false;
    this.recruitBar.hidden = false;
  }

  hideGameHud() {
    this.hud.hidden = true;
    this.bottomBar.hidden = true;
    this.recruitBar.hidden = true;
    this.duelPanel.hidden = true;
    this.blessingBar.hidden = true;
    this.hideIntermission();
    this.crosshair.hidden = true;
    this.interactPrompt.hidden = true;
    this.touchControls.hidden = true;
    this.lockHint.hidden = true;
    this.hideInspector();
    this.hideTooltip();
  }

  setResources(gold: number, star: number, lives: number, maxLives: number, farmland = 0, totalPlots = 0) {
    this.statGold.textContent = String(Math.floor(gold));
    this.statStar.textContent = String(Math.floor(star));
    this.statLives.textContent = `${Math.max(0, Math.ceil(lives))}/${maxLives}`;
    this.statLives.closest('.chip')?.classList.toggle('is-danger', lives <= maxLives * 0.3);
    if (this.statFarm) this.statFarm.textContent = totalPlots > 0 ? `${farmland}/${totalPlots}` : String(farmland);
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

  setSelectedTool(kind: 'crop' | 'tower' | 'guardian' | null, id?: CropId | TowerId | GuardianId) {
    this.currentTool = kind && id ? { kind, id } : null;
    for (const card of this.contextCards) {
      const selected = !!id && kind !== 'guardian' && (card.dataset.crop === id || card.dataset.tower === id);
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    const canvas = document.getElementById('scene');
    canvas?.classList.toggle('is-planting', kind === 'crop');
    if (kind === 'crop' && id) {
      const crop = CROPS[id as CropId];
      this.setContextHint(`${crop.name}：走到农田旁按 E 播种（${crop.cost} 金币）`);
    } else if (kind === 'tower' && id) {
      const tower = TOWERS[id as TowerId];
      const starText = tower.starCost > 0 ? `${tower.starCost} 星辉 + ` : '';
      this.setContextHint(`${tower.name}：走到荒地或空农田旁按 E 建塔（${starText}${tower.cost} 金币）`);
    } else if (kind === 'guardian' && id) {
      const guardian = GUARDIANS[id as GuardianId];
      this.setContextHint(`${guardian.name}：走到空地按 E 安置 · ${guardian.aura ? guardian.aura.label : '自动攻击'}`);
    } else {
      this.setContextHint(this.defaultHint());
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
      if (this.currentTool.kind === 'crop') return '走到农田旁按 E 播种；成熟后按 E 收获';
      if (this.currentTool.kind === 'guardian') return '走到空地按 E 安置乡勇；相邻同阶乡勇可合成';
      return '走到荒地或空农田旁按 E 建塔；点击已有塔可升级';
    }
    return 'WASD 移动 · 鼠标看 · E 交互 · R 招募乡勇 · V 俯瞰视角';
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

  setCameraMode(mode: CameraMode) {
    if (this.lastCameraMode === mode) return;
    this.lastCameraMode = mode;
    this.cameraBtn.textContent = mode === 'first' ? '👁 俯瞰' : '👁 第一人称';
    this.cameraBtn.title = mode === 'first' ? '切换到俯瞰视角 (V)' : '切换到第一人称 (V)';
    this.cameraBtn.classList.toggle('is-active', mode === 'overview');
    this.cameraBtn.setAttribute('aria-pressed', mode === 'overview' ? 'true' : 'false');
    document.body.classList.toggle('is-overview', mode === 'overview');
  }

  setCrosshair(visible: boolean) {
    this.crosshair.hidden = !visible;
  }

  setInteractPrompt(prompt: InteractPrompt | null) {
    const key = prompt ? `${prompt.title}|${prompt.detail}|${prompt.tone}|${prompt.key}|${prompt.progress ?? ''}` : '';
    if (key !== this.lastPromptKey) {
      this.lastPromptKey = key;
      if (!prompt) {
        this.interactPrompt.hidden = true;
      } else {
        this.interactPrompt.hidden = false;
        this.interactPrompt.dataset.tone = prompt.tone;
        this.interactKey.textContent = prompt.key || '·';
        this.interactKey.hidden = prompt.key.length === 0;
        this.interactTitle.textContent = prompt.title;
        this.interactDetail.textContent = prompt.detail;
        this.interactProgress.hidden = prompt.progress === undefined;
        if (prompt.progress !== undefined) this.interactFill.style.transform = `scaleX(${Math.min(1, Math.max(0, prompt.progress))})`;
      }
    }
    this.interactBtn.disabled = !prompt?.actionable;
    this.interactBtn.classList.toggle('is-ready', !!prompt?.actionable);
  }

  setTouchInteractEnabled(enabled: boolean) {
    this.interactBtn.disabled = !enabled;
    this.interactBtn.classList.toggle('is-ready', enabled);
  }

  setLockHint(visible: boolean) {
    if (this.lastLockHintVisible === visible) return;
    this.lastLockHintVisible = visible;
    this.lockHint.hidden = !visible;
  }

  setTouchControlsVisible(visible: boolean) {
    if (this.lastTouchVisible === visible) return;
    this.lastTouchVisible = visible;
    this.touchControls.hidden = !visible;
    document.body.classList.toggle('is-touch-play', visible);
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
    const merge = el<HTMLButtonElement>('btn-merge');
    merge.textContent = data.mergeLabel;
    merge.disabled = !data.mergeEnabled;
    merge.hidden = data.mergeLabel.length === 0;
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
    this.recruitBar.hidden = true;
    this.end.hidden = false;
    el('end-glyph').textContent = data.victory ? '🌾' : '🥀';
    const isVersus = data.mode === 'versus';
    el('end-kicker').textContent = isVersus
      ? data.victory
        ? 'THE DUEL IS WON'
        : 'THE DUEL IS LOST'
      : data.victory
        ? 'THE FIELD HOLDS'
        : 'THE FIELD FALLS';
    el('end-title').textContent = isVersus
      ? data.victory
        ? '对垒胜利'
        : '对垒失守'
      : data.victory
        ? '守望成功'
        : '田野失守';
    const rivalName = data.rivalName ?? '对手';
    if (isVersus) {
      if (data.reason === 'rival') {
        el('end-lead').textContent = `${rivalName}的田先失守了。你守到第 ${Math.min(data.wave, data.total)} 波，赢下了这一季对垒。`;
      } else if (data.reason === 'compare') {
        el('end-lead').textContent = data.victory
          ? `八波结束，你以 ${data.lives} 命对 ${data.rivalLives ?? 0} 命赢下了这场对垒。`
          : `八波结束，你以 ${data.lives} 命对 ${data.rivalLives ?? 0} 命惜败。再调整一次开垦与塔位。`;
      } else if (data.reason === 'lives') {
        el('end-lead').textContent = `守望之种熄灭时，${rivalName}还有 ${data.rivalLives ?? 0} 命。调整塔位与季令，再来一季。`;
      } else {
        el('end-lead').textContent = `这一季的对垒结束了。你守到第 ${Math.min(data.wave, data.total)} 波。`;
      }
    } else {
      el('end-lead').textContent = data.victory
        ? '最后一波野兽退去，风又吹过稻浪。你用六波坚守证明了：最好的防御，是从土地里长出来的。'
        : '守望之种的光芒熄灭了。别灰心——下一季，先把荒地开成田，再让塔覆盖石径。';
    }
    const stats = el('end-stats');
    stats.replaceChildren();
    const entries: Array<[string, string]> = [
      ['模式', isVersus ? '对垒 · 8 波' : '守成 · 6 波'],
      ['到达波次', `${Math.min(data.wave, data.total)} / ${data.total}`],
      ['剩余生命', `${data.lives} / ${data.maxLives}`],
      ['击杀野兽', String(data.kills)],
      ['种田收获', `${data.harvestedGold} 金币`],
      ['建成塔台', String(data.towersBuilt)],
      ['招募批次 / 乡勇', `${data.recruits} / ${data.guardsPlaced}`],
    ];
    if (isVersus) {
      entries.push(['季令 / 合成', `${data.blessings} / ${data.merges}`], ['对手剩余', `${data.rivalLives ?? 0} 命`]);
    }
    entries.push(['坚守时长', formatDuration(data.seconds)], ['结果', data.victory ? (isVersus ? '胜' : '守成') : '失守']);
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

  get inspectorOpen() {
    return !this.inspector.hidden;
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
