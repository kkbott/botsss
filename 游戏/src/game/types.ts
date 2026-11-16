export type CropId = 'wheat' | 'pumpkin' | 'flower';
export type TowerId = 'arrow' | 'cannon' | 'star';
export type EnemyId = 'fox' | 'wolf' | 'bull' | 'stag';
/**
 * Recruitable countryside guards. They are the 《赵云与阿斗》-style "征兵"
 * layer: gold buys a random draft, the player chooses where each one stands,
 * and two adjacent same-type guards merge into the next rank.
 */
export type GuardianId = 'bowman' | 'hoeman' | 'herbalist' | 'fieldhand' | 'mason' | 'ricespirit';
export type GuardianRarity = 'common' | 'rare' | 'epic';
export type GuardianAuraKind = 'farmGrowth' | 'towerDamage' | 'towerRange' | 'guardDamage';
/** Classic is the six-wave tutorial; versus is the 1v1 roguelike season. */
export type RunMode = 'classic' | 'versus';
export type GamePhase =
  | 'loading'
  | 'menu'
  | 'playing'
  | 'paused'
  /** Between-wave roguelike choice; the simulation is frozen. */
  | 'blessing'
  /** Between-wave merchant; the simulation is frozen. */
  | 'shop'
  | 'victory'
  | 'defeat';
export type BlessingRarity = 'common' | 'rare' | 'epic';
export type BlessingId =
  | 'harvest'
  | 'gale'
  | 'soil'
  | 'rain'
  | 'hawk'
  | 'workshop'
  | 'starlight'
  | 'bulwark'
  | 'bargain'
  | 'spoils'
  | 'thorns'
  | 'seed'
  | 'confluence'
  | 'merchant';
export type ShopItemId = 'starVial' | 'lifeCharm' | 'deed' | 'iron' | 'seedPouch';
export type WavePhase = 'prep' | 'active' | 'cleared';
export type Quality = 'high' | 'low';
/** First-person is the default; the old orbit camera survives as a switchable overview. */
export type CameraMode = 'first' | 'overview';
/** A plot is untouched wild land, cleared farmland, a tower base, or a guard post. */
export type PlotState = 'wild' | 'farmland' | 'tower' | 'guardian';
/** What a plot becomes when its tower is dismantled. */
export type LandState = 'wild' | 'farmland';

export interface CropDef {
  id: CropId;
  name: string;
  en: string;
  icon: string;
  cost: number;
  growTime: number;
  yieldGold: number;
  yieldStar: number;
  matureHeight: number;
  color: number;
  accent: number;
  description: string;
  modelKey: string;
}

export interface TowerLevel {
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  slow: number;
  slowDuration: number;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  en: string;
  icon: string;
  cost: number;
  starCost: number;
  description: string;
  levels: TowerLevel[];
  upgradeGold: [number, number];
  upgradeStar: [number, number];
  modelKeys: [string, string, string];
  projectileColor: number;
  accent: number;
}

export interface GuardianLevel {
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  slow: number;
  slowDuration: number;
}

export interface GuardianAura {
  kind: GuardianAuraKind;
  /** Per-adjacent-plot multiplier bonus, e.g. 0.18 = +18%. */
  value: number;
  /** Player-facing description of one source. */
  label: string;
  icon: string;
}

export interface GuardianDef {
  id: GuardianId;
  name: string;
  en: string;
  icon: string;
  rarity: GuardianRarity;
  role: string;
  description: string;
  /** Auras only affect orthogonally adjacent plots. */
  aura: GuardianAura | null;
  levels: [GuardianLevel, GuardianLevel, GuardianLevel];
  /** White-box placeholder model id, see docs/whitebox-blender-prompts.md. */
  modelKey: string;
  accent: number;
  projectileColor: number;
}

export interface GuardianDraftCard {
  uid: number;
  id: GuardianId;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  en: string;
  hp: number;
  speed: number;
  reward: number;
  coreDamage: number;
  height: number;
  modelKey: string;
  tint: number;
  barColor: string;
  boss: boolean;
}

export interface WaveGroup {
  enemy: EnemyId;
  count: number;
  interval: number;
  startAt: number;
}

export interface WaveDef {
  name: string;
  groups: WaveGroup[];
  /** Optional per-wave health multiplier used by the versus season. */
  hpMul?: number;
  /** Optional per-wave kill-reward multiplier used by the versus season. */
  rewardMul?: number;
}

export interface PlotSpec {
  index: number;
  col: number;
  row: number;
  x: number;
  z: number;
}

export type CropStage = 0 | 1 | 2 | 3;

export interface CropRuntime {
  type: CropId;
  elapsed: number;
  stage: CropStage;
  mature: boolean;
}

export interface ReclaimJob {
  elapsed: number;
  total: number;
}

export interface PlotRuntime {
  spec: PlotSpec;
  state: PlotState;
  /** Used to restore a plot after its tower is dismantled. */
  underlying: LandState;
  scorched: boolean;
  crop: CropRuntime | null;
  reclaim: ReclaimJob | null;
  group: import('three').Group;
}

export interface TowerRuntime {
  id: TowerId;
  plot: PlotSpec;
  level: 1 | 2 | 3;
  cooldown: number;
  group: import('three').Group;
  rangeRing: import('three').Mesh;
  range: number;
  damage: number;
  splash: number;
  slow: number;
  slowDuration: number;
  fireCooldown: number;
  investedGold: number;
  investedStar: number;
}

export interface GuardianRuntime {
  id: GuardianId;
  plot: PlotSpec;
  level: 1 | 2 | 3;
  cooldown: number;
  group: import('three').Group;
  range: number;
  damage: number;
  splash: number;
  slow: number;
  slowDuration: number;
  fireCooldown: number;
  /** Gold spent on the recruit batch that brought this guard in. */
  recruitedCost: number;
}

export interface EnemyRuntime {
  id: EnemyId;
  hp: number;
  maxHp: number;
  speed: number;
  progress: number;
  worldPos: import('three').Vector3;
  group: import('three').Group;
  mixer: import('three').AnimationMixer | null;
  slowFactor: number;
  slowTimer: number;
  barEl: HTMLDivElement;
  barFill: HTMLDivElement;
  barVisible: boolean;
  dead: boolean;
}

export interface FloatingText {
  el: HTMLDivElement;
  world: import('three').Vector3;
  life: number;
  maxLife: number;
  rise: number;
}

export interface BlessingDef {
  id: BlessingId;
  name: string;
  icon: string;
  rarity: BlessingRarity;
  maxStacks: number;
  /** Short, player-facing explanation of one stack. */
  description: string;
}

export interface BlessingChoice {
  def: BlessingDef;
  stacks: number;
}

export interface ShopItemDef {
  id: ShopItemId;
  name: string;
  icon: string;
  basePrice: number;
  description: string;
}

export interface ShopOffer {
  item: ShopItemDef;
  price: number;
  sold: boolean;
}

export interface RivalState {
  name: string;
  title: string;
  lives: number;
  maxLives: number;
  wave: number;
  harvest: number;
  skill: number;
  /** One deterministic mistake wave per some runs, for variety. */
  mistakeWave: number | null;
  alive: boolean;
}

export interface GameStats {
  kills: number;
  harvestedGold: number;
  harvestedStar: number;
  planted: number;
  towersBuilt: number;
  leaks: number;
  playSeconds: number;
  reclaimed: number;
  merges: number;
  blessings: number;
  recruits: number;
  guardsPlaced: number;
}

export interface SaveData {
  bestWave: number;
  victories: number;
  versusWins: number;
  versusBestWave: number;
  muted: boolean;
}
