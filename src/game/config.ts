import type {
  CropDef,
  CropId,
  EnemyDef,
  EnemyId,
  PadSpec,
  PlotSpec,
  TowerDef,
  TowerId,
  WaveDef,
} from './types';

/** Fixed world layout. Units are roughly metres; the island is ~34 × 28. */
export const WORLD = {
  island: { rx: 17.2, rz: 14.0 },
  farm: {
    cols: 4,
    rows: 3,
    spacing: 1.7,
    startX: -9.0,
    startZ: -2.6,
    plotSize: 1.5,
    initialUnlocked: 6,
    unlockCosts: [25, 35, 50, 65, 85, 110],
    repairCost: 14,
  },
  pathWidth: 2.15,
  pathY: 0.045,
  spawn: { x: 9.2, z: -9.0 },
  core: { x: 5.0, z: 7.8 },
  camera: {
    position: { x: 16.2, z: 26.5, y: 22.5 },
    target: { x: -0.1, z: 1.4, y: 0.3 },
    minDistance: 16,
    maxDistance: 43,
    minPolar: 0.58,
    maxPolar: 1.3,
  },
  decorations: {
    farmhouse: { x: -11.0, z: -6.4, rotation: 0.55 },
    windmill: { x: -13.2, z: -1.2, rotation: -0.35 },
    market: { x: -2.8, z: -5.6, rotation: 0.25 },
    well: { x: -8.4, z: 3.5, rotation: 0.2 },
    hay: { x: -12.2, z: 3.2, rotation: 0.9 },
    crates: { x: -11.4, z: 2.0, rotation: 0.3 },
    pond: { x: -2.0, z: -8.7, radius: 2.4 },
  },
} as const;

export const PATH_POINTS: ReadonlyArray<readonly [number, number]> = [
  [9.2, -9.0],
  [7.6, -5.4],
  [6.4, -1.2],
  [3.2, 0.9],
  [1.5, 4.2],
  [2.4, 7.1],
  [5.0, 7.8],
];

export function makePlots(): PlotSpec[] {
  const plots: PlotSpec[] = [];
  let index = 0;
  for (let row = 0; row < WORLD.farm.rows; row++) {
    for (let col = 0; col < WORLD.farm.cols; col++) {
      plots.push({
        index,
        col,
        row,
        x: WORLD.farm.startX + col * WORLD.farm.spacing,
        z: WORLD.farm.startZ + row * WORLD.farm.spacing,
      });
      index++;
    }
  }
  return plots;
}

export const PLOTS: PlotSpec[] = makePlots();

export const TOWER_PADS: PadSpec[] = [
  { index: 0, x: 8.4, z: -6.1, rotation: 0.2 },
  { index: 1, x: 4.9, z: -3.7, rotation: -0.3 },
  { index: 2, x: 4.6, z: 1.5, rotation: 0.15 },
  { index: 3, x: 1.0, z: -0.9, rotation: -0.2 },
  { index: 4, x: -0.6, z: 3.8, rotation: 0.35 },
  { index: 5, x: 4.2, z: 4.8, rotation: -0.25 },
  { index: 6, x: 8.8, z: 5.9, rotation: 0.1 },
];

export const CROPS: Record<CropId, CropDef> = {
  wheat: {
    id: 'wheat',
    name: '金穗麦',
    en: 'Golden Wheat',
    icon: '🌾',
    cost: 6,
    growTime: 9,
    yieldGold: 16,
    yieldStar: 0,
    matureHeight: 0.78,
    color: 0xe8c45c,
    accent: 0x9fc35a,
    description: '9 秒成熟，稳定回本。农田的基础现金流。',
    modelKey: 'quaternius/crops/Wheat',
  },
  pumpkin: {
    id: 'pumpkin',
    name: '暖阳南瓜',
    en: 'Sun Pumpkin',
    icon: '🎃',
    cost: 18,
    growTime: 22,
    yieldGold: 54,
    yieldStar: 0,
    matureHeight: 1.0,
    color: 0xee8a3b,
    accent: 0x7ba85a,
    description: '22 秒成熟，收益更高。适合攒钱起炮台。',
    modelKey: 'quaternius/crops/Pumpkin',
  },
  flower: {
    id: 'flower',
    name: '星辉花',
    en: 'Starlight Bloom',
    icon: '✨',
    cost: 26,
    growTime: 30,
    yieldGold: 12,
    yieldStar: 2,
    matureHeight: 1.05,
    color: 0x9d7bff,
    accent: 0x74e3d8,
    description: '30 秒成熟，产出星辉。建造与升级高阶塔的必需品。',
    modelKey: 'quaternius/crops/Flower',
  },
};

export const TOWERS: Record<TowerId, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: '风语箭塔',
    en: 'Windwatch',
    icon: '🏹',
    cost: 45,
    starCost: 0,
    description: '快速单点攻击，前期最可靠的守卫。',
    levels: [
      { damage: 13, range: 5.8, cooldown: 0.75, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 19, range: 6.3, cooldown: 0.66, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 27, range: 6.9, cooldown: 0.56, splash: 0, slow: 0, slowDuration: 0 },
    ],
    upgradeGold: [55, 95],
    upgradeStar: [1, 2],
    modelKeys: [
      'quaternius/environment/WatchTower_FirstAge_Level1',
      'quaternius/environment/WatchTower_FirstAge_Level2',
      'quaternius/environment/WatchTower_FirstAge_Level3',
    ],
    projectileColor: 0xffe0a0,
    accent: 0x7fc7a0,
  },
  cannon: {
    id: 'cannon',
    name: '南瓜炮台',
    en: 'Pumpkin Mortar',
    icon: '💥',
    cost: 90,
    starCost: 0,
    description: '范围爆炸，对密集虫群非常有效。',
    levels: [
      { damage: 36, range: 5.1, cooldown: 1.9, splash: 1.7, slow: 0, slowDuration: 0 },
      { damage: 58, range: 5.6, cooldown: 1.7, splash: 1.9, slow: 0, slowDuration: 0 },
      { damage: 86, range: 6.2, cooldown: 1.5, splash: 2.1, slow: 0, slowDuration: 0 },
    ],
    upgradeGold: [95, 150],
    upgradeStar: [1, 2],
    modelKeys: [
      'quaternius/environment/WatchTower_SecondAge_Level1',
      'quaternius/environment/WatchTower_SecondAge_Level2',
      'quaternius/environment/WatchTower_SecondAge_Level3',
    ],
    projectileColor: 0xff8b52,
    accent: 0xf0a04a,
  },
  star: {
    id: 'star',
    name: '星辉圣坛',
    en: 'Starlight Spire',
    icon: '🔮',
    cost: 120,
    starCost: 2,
    description: '星辉解锁。光矛减速敌人，适合长路段压制。',
    levels: [
      { damage: 12, range: 6.2, cooldown: 1.1, splash: 0, slow: 0.35, slowDuration: 2 },
      { damage: 20, range: 6.8, cooldown: 1.0, splash: 0, slow: 0.4, slowDuration: 2.2 },
      { damage: 32, range: 7.4, cooldown: 0.9, splash: 0, slow: 0.45, slowDuration: 2.5 },
    ],
    upgradeGold: [110, 170],
    upgradeStar: [2, 3],
    modelKeys: [
      'quaternius/environment/Temple_SecondAge_Level1',
      'quaternius/environment/Temple_SecondAge_Level2',
      'quaternius/environment/Temple_SecondAge_Level3',
    ],
    projectileColor: 0x9de9ff,
    accent: 0x9d7bff,
  },
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  fox: {
    id: 'fox',
    name: '赤影狐',
    en: 'Ember Fox',
    hp: 34,
    speed: 2.15,
    reward: 5,
    coreDamage: 1,
    height: 0.7,
    modelKey: 'quaternius/animals/Fox',
    tint: 0xd86a4a,
    barColor: '#e88c62',
    boss: false,
  },
  wolf: {
    id: 'wolf',
    name: '苔原狼',
    en: 'Moss Wolf',
    hp: 62,
    speed: 1.65,
    reward: 8,
    coreDamage: 2,
    height: 0.95,
    modelKey: 'quaternius/animals/Wolf',
    tint: 0x7e9b73,
    barColor: '#9bc17d',
    boss: false,
  },
  bull: {
    id: 'bull',
    name: '荒角蛮牛',
    en: 'Wildhorn',
    hp: 170,
    speed: 1.1,
    reward: 15,
    coreDamage: 3,
    height: 1.35,
    modelKey: 'quaternius/animals/Bull',
    tint: 0x9a7656,
    barColor: '#d2a35a',
    boss: false,
  },
  stag: {
    id: 'stag',
    name: '幽林鹿王',
    en: 'Elder Stag',
    hp: 1750,
    speed: 0.95,
    reward: 120,
    coreDamage: 8,
    height: 2.15,
    modelKey: 'quaternius/animals/Stag',
    tint: 0x7152b8,
    barColor: '#c49bff',
    boss: true,
  },
};

export const WAVES: WaveDef[] = [
  {
    name: '初来乍到',
    groups: [{ enemy: 'wolf', count: 6, interval: 1.1, startAt: 0 }],
  },
  {
    name: '狐影试探',
    groups: [
      { enemy: 'fox', count: 8, interval: 0.65, startAt: 0 },
      { enemy: 'wolf', count: 4, interval: 1.2, startAt: 3.5 },
    ],
  },
  {
    name: '蛮牛冲阵',
    groups: [
      { enemy: 'fox', count: 6, interval: 0.7, startAt: 0 },
      { enemy: 'bull', count: 4, interval: 1.7, startAt: 1.5 },
    ],
  },
  {
    name: '兽潮涌动',
    groups: [
      { enemy: 'wolf', count: 8, interval: 0.95, startAt: 0 },
      { enemy: 'fox', count: 10, interval: 0.55, startAt: 2 },
      { enemy: 'bull', count: 4, interval: 1.5, startAt: 3 },
    ],
  },
  {
    name: '荒角围城',
    groups: [
      { enemy: 'bull', count: 7, interval: 1.25, startAt: 0 },
      { enemy: 'fox', count: 12, interval: 0.52, startAt: 1.5 },
      { enemy: 'wolf', count: 6, interval: 0.9, startAt: 4 },
    ],
  },
  {
    name: '鹿王降临',
    groups: [
      { enemy: 'stag', count: 1, interval: 1, startAt: 0 },
      { enemy: 'wolf', count: 10, interval: 0.75, startAt: 1.5 },
      { enemy: 'fox', count: 12, interval: 0.48, startAt: 3 },
      { enemy: 'bull', count: 7, interval: 1.15, startAt: 4 },
    ],
  },
];

export const RULES = {
  startingGold: 90,
  startingLives: 20,
  totalWaves: WAVES.length,
  firstPrep: 25,
  prepBetweenWaves: 15,
  earlyStartBonus: 6,
  waveClearGold: (wave: number) => 25 + wave * 8,
  waveClearStar: (wave: number) => (wave === 3 || wave === 5 ? 1 : 0),
  sellRefund: 0.6,
  bossStarDrop: 3,
  simStep: 1 / 60,
  maxStepsPerFrame: 10,
  maxEnemies: 40,
} as const;

export const STORAGE_KEY = 'harvest-hold-save-v1';
