import type {
  BlessingDef,
  BlessingId,
  CropDef,
  CropId,
  EnemyDef,
  EnemyId,
  PlotSpec,
  ShopItemDef,
  ShopItemId,
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

/**
 * The versus season starts from the same readable six-wave curve, then adds two
 * "long night" waves. HP/reward multipliers keep the extra waves tense without
 * introducing a second roster of enemies for the prototype.
 */
export const VERSUS_WAVES: WaveDef[] = [
  ...WAVES,
  {
    name: '长夜追猎',
    hpMul: 1.3,
    rewardMul: 1.2,
    groups: [
      { enemy: 'stag', count: 1, interval: 1, startAt: 0 },
      { enemy: 'wolf', count: 13, interval: 0.72, startAt: 1.4 },
      { enemy: 'fox', count: 16, interval: 0.48, startAt: 2.6 },
      { enemy: 'bull', count: 9, interval: 1.15, startAt: 4.2 },
    ],
  },
  {
    name: '双王临门',
    hpMul: 1.35,
    rewardMul: 1.4,
    groups: [
      { enemy: 'stag', count: 2, interval: 5.2, startAt: 0 },
      { enemy: 'wolf', count: 15, interval: 0.7, startAt: 1.4 },
      { enemy: 'fox', count: 18, interval: 0.46, startAt: 2.6 },
      { enemy: 'bull', count: 10, interval: 1.1, startAt: 4.4 },
    ],
  },
];

/** Per-stack values are documented in docs/design-v2.md §季令. */
export const BLESSINGS: Record<BlessingId, BlessingDef> = {
  harvest: {
    id: 'harvest',
    name: '丰饶之季',
    icon: '🌾',
    rarity: 'common',
    maxStacks: 5,
    description: '每层：作物收获金币 +15%。',
  },
  gale: {
    id: 'gale',
    name: '穿林疾风',
    icon: '🍃',
    rarity: 'common',
    maxStacks: 5,
    description: '每层：防御塔攻击间隔 -7%（最多 -35%）。',
  },
  soil: {
    id: 'soil',
    name: '沃土之诺',
    icon: '🟫',
    rarity: 'common',
    maxStacks: 3,
    description: '每层：开垦荒地费用 -10%。',
  },
  rain: {
    id: 'rain',
    name: '知时好雨',
    icon: '💧',
    rarity: 'common',
    maxStacks: 3,
    description: '每层：作物生长时间 -8%。',
  },
  hawk: {
    id: 'hawk',
    name: '鹰眼守望',
    icon: '👁',
    rarity: 'rare',
    maxStacks: 3,
    description: '每层：防御塔射程 +8%。',
  },
  workshop: {
    id: 'workshop',
    name: '匠人夜话',
    icon: '🔨',
    rarity: 'rare',
    maxStacks: 2,
    description: '每层：防御塔升级金币费用 -15%。',
  },
  starlight: {
    id: 'starlight',
    name: '星辉共振',
    icon: '✦',
    rarity: 'rare',
    maxStacks: 2,
    description: '每层：收获星辉花时额外 +1 星辉。',
  },
  bulwark: {
    id: 'bulwark',
    name: '坚壁清野',
    icon: '🛡',
    rarity: 'rare',
    maxStacks: 2,
    description: '每层：生命上限 +2，并立即回复 2 点生命。',
  },
  bargain: {
    id: 'bargain',
    name: '行商旧识',
    icon: '🪙',
    rarity: 'rare',
    maxStacks: 2,
    description: '每层：行商商品价格 -15%。',
  },
  spoils: {
    id: 'spoils',
    name: '战利品',
    icon: '🎖',
    rarity: 'epic',
    maxStacks: 1,
    description: '每波清除奖励金币 +40%。',
  },
  thorns: {
    id: 'thorns',
    name: '荆棘篱墙',
    icon: '🌵',
    rarity: 'epic',
    maxStacks: 1,
    description: '每次漏怪的核心伤害 -1（最低 1 点）。',
  },
  seed: {
    id: 'seed',
    name: '双生麦穗',
    icon: '🌱',
    rarity: 'epic',
    maxStacks: 2,
    description: '每层：收获时有 20% 概率获得双倍金币。',
  },
  confluence: {
    id: 'confluence',
    name: '合流之术',
    icon: '🔀',
    rarity: 'epic',
    maxStacks: 1,
    description: '合成防御塔时，返还被合并塔 50% 的建造金币。',
  },
  merchant: {
    id: 'merchant',
    name: '季前囤货',
    icon: '📦',
    rarity: 'epic',
    maxStacks: 1,
    description: '每次行商多展示 1 件商品。',
  },
};

export const SHOP_ITEMS: Record<ShopItemId, ShopItemDef> = {
  starVial: {
    id: 'starVial',
    name: '星辉瓶',
    icon: '✦',
    basePrice: 55,
    description: '立刻获得 2 星辉。',
  },
  lifeCharm: {
    id: 'lifeCharm',
    name: '护田符',
    icon: '❤',
    basePrice: 75,
    description: '生命上限 +2，并立即回复 2 点生命。',
  },
  deed: {
    id: 'deed',
    name: '地契',
    icon: '📜',
    basePrice: 50,
    description: '下一次开垦荒地免费。',
  },
  iron: {
    id: 'iron',
    name: '精铁',
    icon: '🔧',
    basePrice: 65,
    description: '下一次防御塔升级的金币费用减半。',
  },
  seedPouch: {
    id: 'seedPouch',
    name: '种子袋',
    icon: '🌾',
    basePrice: 45,
    description: '下一次作物收获获得双倍金币。',
  },
};

export const VERSUS_RULES = {
  startingGold: 165,
  startingLives: 12,
  firstPrep: 24,
  prepBetweenWaves: 16,
  /** Waves after which the merchant visits (never after the final wave). */
  shopWaves: [2, 4, 6],
  shopRerollBase: 15,
  shopRerollStep: 10,
  /** Base leaks the AI rival takes on each of the eight waves. */
  rivalLeaks: [0, 1, 1, 1, 2, 2, 2, 2],
  rivalStartLives: 12,
  /** Cosmetic rival identities; the run picks one deterministically. */
  rivalNames: ['北坡·老秦', '溪口·阿禾', '石桥·小满', '南坳·十七', '河东·麦生', '西岭·秋娘'],
  rivalTitles: ['守田人', '季风客', '观星者', '老农'],
} as const;

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
