import type {
  CropDef,
  CropId,
  EnemyDef,
  EnemyId,
  PlotSpec,
  TowerDef,
  TowerId,
  WaveDef,
} from './types';

/**
 * Fixed world layout. Units are roughly metres; the island is ~54 × 42.
 *
 * The farm is a 6 × 4 grid wrapped on the north, west and south by the beast
 * path. Perimeter plots are close enough to the path for a level-1 tower to
 * cover it; the inner 2 × 4 plots are safe, high-value farmland. That is the
 * core placement puzzle: every perimeter plot you use for a tower is a plot
 * you cannot farm, and every plot you clear for farming gets more expensive.
 */
export const WORLD = {
  island: { rx: 27.0, rz: 21.0 },
  farm: {
    cols: 6,
    rows: 4,
    spacing: 2.7,
    startX: -8.4,
    startZ: -6.0,
    plotSize: 2.2,
    cropScale: 1.16,
    repairCost: 14,
  },
  pathWidth: 2.4,
  pathY: 0.045,
  spawn: { x: 15.5, z: -14.5 },
  core: { x: 11.0, z: 5.8 },
  player: {
    start: { x: 7.8, z: 2.2 },
    startYaw: 1.15,
    startPitch: -0.05,
    eyeHeight: 1.64,
    radius: 0.34,
    walkSpeed: 3.25,
    runSpeed: 4.55,
    jumpSpeed: 4.3,
    gravity: 13.5,
    interactRange: 2.95,
  },
  camera: {
    overview: {
      position: { x: 24.5, y: 21.5, z: 27.5 },
      target: { x: 0.2, y: 0.3, z: 0.8 },
      minDistance: 12,
      maxDistance: 58,
      minPolar: 0.4,
      maxPolar: 1.28,
    },
    menu: {
      position: { x: 26.5, y: 25.0, z: 34.5 },
      target: { x: 0.0, y: 0.9, z: 1.0 },
    },
    firstFov: 72,
    overviewFov: 46,
  },
  decorations: {
    farmhouse: { x: -19.0, z: 4.2, rotation: 0.55 },
    windmill: { x: -22.0, z: -3.4, rotation: -0.35 },
    market: { x: -17.6, z: -11.6, rotation: 0.25 },
    well: { x: -11.7, z: -2.3, rotation: 0.2 },
    hay: { x: -18.7, z: 10.6, rotation: 0.9 },
    crates: { x: -17.3, z: 9.3, rotation: 0.3 },
    pond: { x: 3.6, z: -14.6, radius: 2.6 },
    tent: { x: 8.4, z: -1.2, rotation: -0.7 },
    statue: { x: 14.2, z: 1.6, rotation: 0.2 },
    obelisk: { x: 13.6, z: -4.0, rotation: -0.4 },
    campfire: { x: 10.8, z: 0.3, rotation: 0.4 },
  },
} as const;

export const PATH_POINTS: ReadonlyArray<readonly [number, number]> = [
  [15.5, -14.5],
  [13.0, -11.8],
  [9.5, -10.8],
  [4.5, -10.8],
  [-1.5, -10.9],
  [-7.5, -11.0],
  [-12.0, -9.6],
  [-14.0, -6.2],
  [-14.2, -2.0],
  [-13.4, 1.9],
  [-11.0, 5.2],
  [-7.0, 6.5],
  [-2.0, 6.6],
  [3.0, 6.6],
  [7.5, 6.6],
  [11.0, 5.8],
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
    matureHeight: 1.5,
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
    matureHeight: 1.25,
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
    matureHeight: 1.5,
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
    cost: 42,
    starCost: 0,
    description: '快速单点攻击，前期最可靠的守卫。',
    levels: [
      { damage: 15, range: 6.4, cooldown: 0.72, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 22, range: 6.9, cooldown: 0.64, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 31, range: 7.5, cooldown: 0.55, splash: 0, slow: 0, slowDuration: 0 },
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
    cost: 88,
    starCost: 0,
    description: '范围爆炸，对密集虫群非常有效。',
    levels: [
      { damage: 38, range: 5.6, cooldown: 1.9, splash: 1.8, slow: 0, slowDuration: 0 },
      { damage: 60, range: 6.1, cooldown: 1.7, splash: 2.0, slow: 0, slowDuration: 0 },
      { damage: 88, range: 6.7, cooldown: 1.5, splash: 2.2, slow: 0, slowDuration: 0 },
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
    cost: 118,
    starCost: 2,
    description: '星辉解锁。光矛减速敌人，适合长路段压制。',
    levels: [
      { damage: 14, range: 6.8, cooldown: 1.05, splash: 0, slow: 0.35, slowDuration: 2 },
      { damage: 23, range: 7.4, cooldown: 0.95, splash: 0, slow: 0.4, slowDuration: 2.2 },
      { damage: 36, range: 8.0, cooldown: 0.85, splash: 0, slow: 0.45, slowDuration: 2.5 },
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
    hp: 38,
    speed: 2.55,
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
    hp: 72,
    speed: 2.0,
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
    hp: 195,
    speed: 1.35,
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
    hp: 1950,
    speed: 1.08,
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
    groups: [{ enemy: 'wolf', count: 5, interval: 1.15, startAt: 0 }],
  },
  {
    name: '狐影试探',
    groups: [
      { enemy: 'fox', count: 9, interval: 0.65, startAt: 0 },
      { enemy: 'wolf', count: 4, interval: 1.2, startAt: 3.5 },
    ],
  },
  {
    name: '蛮牛冲阵',
    groups: [
      { enemy: 'fox', count: 7, interval: 0.7, startAt: 0 },
      { enemy: 'bull', count: 4, interval: 1.7, startAt: 1.5 },
    ],
  },
  {
    name: '兽潮涌动',
    groups: [
      { enemy: 'wolf', count: 9, interval: 0.95, startAt: 0 },
      { enemy: 'fox', count: 11, interval: 0.55, startAt: 2 },
      { enemy: 'bull', count: 4, interval: 1.5, startAt: 3 },
    ],
  },
  {
    name: '荒角围城',
    groups: [
      { enemy: 'bull', count: 8, interval: 1.25, startAt: 0 },
      { enemy: 'fox', count: 13, interval: 0.52, startAt: 1.5 },
      { enemy: 'wolf', count: 7, interval: 0.9, startAt: 4 },
    ],
  },
  {
    name: '鹿王降临',
    groups: [
      { enemy: 'stag', count: 1, interval: 1, startAt: 0 },
      { enemy: 'wolf', count: 11, interval: 0.75, startAt: 1.5 },
      { enemy: 'fox', count: 13, interval: 0.48, startAt: 3 },
      { enemy: 'bull', count: 8, interval: 1.15, startAt: 4 },
    ],
  },
];

export const RULES = {
  startingGold: 150,
  startingLives: 20,
  totalWaves: WAVES.length,
  firstPrep: 32,
  prepBetweenWaves: 18,
  earlyStartBonus: 6,
  waveClearGold: (wave: number) => 25 + wave * 8,
  waveClearStar: (wave: number) => (wave === 3 || wave === 5 ? 1 : 0),
  sellRefund: 0.6,
  bossStarDrop: 3,
  simStep: 1 / 60,
  maxStepsPerFrame: 10,
  maxEnemies: 48,
  reclaimBaseCost: 14,
  reclaimStep: 5,
  reclaimMaxCost: 85,
  reclaimDuration: 1.6,
} as const;

export const STORAGE_KEY = 'harvest-hold-save-v1';
