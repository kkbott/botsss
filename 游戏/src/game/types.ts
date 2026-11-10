export type CropId = 'wheat' | 'pumpkin' | 'flower';
export type TowerId = 'arrow' | 'cannon' | 'star';
export type EnemyId = 'fox' | 'wolf' | 'bull' | 'stag';
export type GamePhase = 'loading' | 'menu' | 'playing' | 'paused' | 'victory' | 'defeat';
export type WavePhase = 'prep' | 'active' | 'cleared';
export type Quality = 'high' | 'low';
/** First-person is the default; the old orbit camera survives as a switchable overview. */
export type CameraMode = 'first' | 'overview';
/** A plot is either untouched wild land, cleared farmland, or the base of a tower. */
export type PlotState = 'wild' | 'farmland' | 'tower';
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

export interface GameStats {
  kills: number;
  harvestedGold: number;
  harvestedStar: number;
  planted: number;
  towersBuilt: number;
  leaks: number;
  playSeconds: number;
  reclaimed: number;
}

export interface SaveData {
  bestWave: number;
  victories: number;
  muted: boolean;
}
