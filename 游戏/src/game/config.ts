import type {
  BlessingDef,
  BlessingId,
  CropDef,
  CropId,
  EnemyDef,
  EnemyId,
  GuardianDef,
  GuardianId,
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
    name: '金穗稻',
    en: 'Golden Rice',
    icon: '🌾',
    cost: 6,
    growTime: 9,
    yieldGold: 16,
    yieldStar: 0,
    matureHeight: 1.5,
    color: 0xe8c45c,
    accent: 0x9fc35a,
    description: '9 秒成熟，稳定回本。水田里的基础现金流。',
    modelKey: 'whitebox/crop_rice',
  },
  pumpkin: {
    id: 'pumpkin',
    name: '暖阳瓜',
    en: 'Sun Gourd',
    icon: '🎃',
    cost: 18,
    growTime: 22,
    yieldGold: 54,
    yieldStar: 0,
    matureHeight: 1.25,
    color: 0xee8a3b,
    accent: 0x7ba85a,
    description: '22 秒成熟，收益更高。适合攒钱起炮台。',
    modelKey: 'whitebox/crop_pumpkin',
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
    modelKey: 'whitebox/crop_starflower',
  },
};

export const TOWERS: Record<TowerId, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: '竹风望楼',
    en: 'Bamboo Watch',
    icon: '🏹',
    cost: 42,
    starCost: 0,
    description: '竹楼上的快弓，前期最可靠的守卫。',
    levels: [
      { damage: 15, range: 6.4, cooldown: 0.72, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 22, range: 6.9, cooldown: 0.64, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 31, range: 7.5, cooldown: 0.55, splash: 0, slow: 0, slowDuration: 0 },
    ],
    upgradeGold: [55, 95],
    upgradeStar: [1, 2],
    modelKeys: [
      'whitebox/tower_bamboo_1',
      'whitebox/tower_bamboo_2',
      'whitebox/tower_bamboo_3',
    ],
    projectileColor: 0xffe0a0,
    accent: 0x7fc7a0,
  },
  cannon: {
    id: 'cannon',
    name: '石臼炮台',
    en: 'Stone Mortar',
    icon: '💥',
    cost: 88,
    starCost: 0,
    description: '稻壳与碎石装填的石臼，范围爆炸对兽群非常有效。',
    levels: [
      { damage: 38, range: 5.6, cooldown: 1.9, splash: 1.8, slow: 0, slowDuration: 0 },
      { damage: 60, range: 6.1, cooldown: 1.7, splash: 2.0, slow: 0, slowDuration: 0 },
      { damage: 88, range: 6.7, cooldown: 1.5, splash: 2.2, slow: 0, slowDuration: 0 },
    ],
    upgradeGold: [95, 150],
    upgradeStar: [1, 2],
    modelKeys: [
      'whitebox/tower_mortar_1',
      'whitebox/tower_mortar_2',
      'whitebox/tower_mortar_3',
    ],
    projectileColor: 0xff8b52,
    accent: 0xf0a04a,
  },
  star: {
    id: 'star',
    name: '社火祭坛',
    en: 'Village Shrine',
    icon: '🏮',
    cost: 118,
    starCost: 2,
    description: '星辉点亮的社火，光矛减速野兽，适合长路段压制。',
    levels: [
      { damage: 14, range: 6.8, cooldown: 1.05, splash: 0, slow: 0.35, slowDuration: 2 },
      { damage: 23, range: 7.4, cooldown: 0.95, splash: 0, slow: 0.4, slowDuration: 2.2 },
      { damage: 36, range: 8.0, cooldown: 0.85, splash: 0, slow: 0.45, slowDuration: 2.5 },
    ],
    upgradeGold: [110, 170],
    upgradeStar: [2, 3],
    modelKeys: [
      'whitebox/tower_shrine_1',
      'whitebox/tower_shrine_2',
      'whitebox/tower_shrine_3',
    ],
    projectileColor: 0x9de9ff,
    accent: 0x9d7bff,
  },
};

/**
 * 乡勇 / countryside guards — the random-recruit layer modelled on
 * 《赵云与阿斗》's "征兵". A recruit batch draws three random cards; each card
 * must be placed on an empty plot, and two adjacent same-type, same-rank
 * guards merge into the next rank. Auras only reach orthogonally adjacent
 * plots, so *where* a guard stands is the real placement decision.
 */
export const GUARDIANS: Record<GuardianId, GuardianDef> = {
  bowman: {
    id: 'bowman',
    name: '竹弓手',
    en: 'Bamboo Archer',
    icon: '🏹',
    rarity: 'common',
    role: '远程单体',
    description: '站在竹篱后放箭的猎户。射程长，单体输出稳定，适合守住石径外圈。',
    aura: null,
    levels: [
      { damage: 10, range: 5.2, cooldown: 0.85, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 17, range: 5.6, cooldown: 0.78, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 27, range: 6.0, cooldown: 0.7, splash: 0, slow: 0, slowDuration: 0 },
    ],
    modelKey: 'whitebox/guard_bowman',
    accent: 0x8fa58b,
    projectileColor: 0xd9c083,
  },
  hoeman: {
    id: 'hoeman',
    name: '锄禾客',
    en: 'Hoe Guard',
    icon: '⚒️',
    rarity: 'common',
    role: '近战范围',
    description: '把锄头当兵器的庄稼汉。范围小、伤害高，适合贴身堵在拐角。',
    aura: null,
    levels: [
      { damage: 22, range: 2.2, cooldown: 1.15, splash: 1.0, slow: 0, slowDuration: 0 },
      { damage: 36, range: 2.45, cooldown: 1.05, splash: 1.1, slow: 0, slowDuration: 0 },
      { damage: 56, range: 2.7, cooldown: 0.95, splash: 1.25, slow: 0, slowDuration: 0 },
    ],
    modelKey: 'whitebox/guard_hoeman',
    accent: 0xb08a5c,
    projectileColor: 0xd8c6a3,
  },
  fieldhand: {
    id: 'fieldhand',
    name: '田倌',
    en: 'Field Keeper',
    icon: '🌱',
    rarity: 'common',
    role: '农事光环',
    description: '替你看水看苗的老农。不攻击，但能让相邻农田生长更快。',
    aura: {
      kind: 'farmGrowth',
      value: 0.18,
      label: '相邻农田生长速度 +18%',
      icon: '🌱',
    },
    levels: [
      { damage: 0, range: 0, cooldown: 1, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 0, range: 0, cooldown: 1, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 0, range: 0, cooldown: 1, splash: 0, slow: 0, slowDuration: 0 },
    ],
    modelKey: 'whitebox/guard_fieldhand',
    accent: 0x9aad7f,
    projectileColor: 0x9aad7f,
  },
  herbalist: {
    id: 'herbalist',
    name: '采药人',
    en: 'Herbalist',
    icon: '🌿',
    rarity: 'rare',
    role: '减速 · 塔射程',
    description: '背着药篓的山民。药烟能拖慢野兽，也能让相邻防御塔望得更远。',
    aura: {
      kind: 'towerRange',
      value: 0.06,
      label: '相邻防御塔射程 +6%',
      icon: '👁',
    },
    levels: [
      { damage: 7, range: 4.4, cooldown: 1.3, splash: 0, slow: 0.3, slowDuration: 1.6 },
      { damage: 12, range: 4.7, cooldown: 1.2, splash: 0, slow: 0.35, slowDuration: 1.8 },
      { damage: 19, range: 5.0, cooldown: 1.1, splash: 0, slow: 0.4, slowDuration: 2.0 },
    ],
    modelKey: 'whitebox/guard_herbalist',
    accent: 0x86a08a,
    projectileColor: 0x9fc5b0,
  },
  mason: {
    id: 'mason',
    name: '石匠',
    en: 'Stone Mason',
    icon: '🪨',
    rarity: 'rare',
    role: '塔增伤 · 近战',
    description: '修桥补墙的石匠。随身锤凿能敲碎兽骨，也替相邻的塔磨利箭镞。',
    aura: {
      kind: 'towerDamage',
      value: 0.12,
      label: '相邻防御塔伤害 +12%',
      icon: '⚒',
    },
    levels: [
      { damage: 9, range: 3.4, cooldown: 1.1, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 15, range: 3.7, cooldown: 1.0, splash: 0, slow: 0, slowDuration: 0 },
      { damage: 24, range: 4.0, cooldown: 0.9, splash: 0, slow: 0, slowDuration: 0 },
    ],
    modelKey: 'whitebox/guard_mason',
    accent: 0x9a9588,
    projectileColor: 0xc9c0a9,
  },
  ricespirit: {
    id: 'ricespirit',
    name: '稻灵',
    en: 'Rice Spirit',
    icon: '🌾',
    rarity: 'epic',
    role: '范围减速 · 乡勇增伤',
    description: '稻穗成熟时偶尔现身的精灵。能拖住整片兽群，也让相邻乡勇打得更狠。',
    aura: {
      kind: 'guardDamage',
      value: 0.15,
      label: '相邻乡勇伤害 +15%',
      icon: '🌾',
    },
    levels: [
      { damage: 12, range: 4.6, cooldown: 0.9, splash: 0, slow: 0.2, slowDuration: 1.2 },
      { damage: 20, range: 5.0, cooldown: 0.82, splash: 0, slow: 0.25, slowDuration: 1.4 },
      { damage: 32, range: 5.4, cooldown: 0.74, splash: 0, slow: 0.3, slowDuration: 1.6 },
    ],
    modelKey: 'whitebox/guard_ricespirit',
    accent: 0xc9b37a,
    projectileColor: 0xead9a4,
  },
};

/** Recruit = spend gold once, draw a three-card batch, then place all three. */
export const RECRUIT_RULES = {
  baseCost: 12,
  costStep: 4,
  maxCost: 44,
  drawSize: 3,
  benchSize: 3,
  /** A batch never contains more than two copies of one guard type. */
  duplicateLimit: 2,
  weights: {
    bowman: 30,
    hoeman: 23,
    fieldhand: 19,
    herbalist: 12,
    mason: 10,
    ricespirit: 6,
  } as Record<GuardianId, number>,
  /** Dismissing an unplaced card or a placed guard refunds nothing (no arbitrage). */
  refundRate: 0,
} as const;

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  fox: {
    id: 'fox',
    name: '赤狐',
    en: 'Ember Fox',
    hp: 38,
    speed: 2.55,
    reward: 5,
    coreDamage: 1,
    height: 0.7,
    modelKey: 'whitebox/enemy_fox',
    tint: 0xd86a4a,
    barColor: '#e88c62',
    boss: false,
  },
  wolf: {
    id: 'wolf',
    name: '灰狼',
    en: 'Grey Wolf',
    hp: 72,
    speed: 2.0,
    reward: 8,
    coreDamage: 2,
    height: 0.95,
    modelKey: 'whitebox/enemy_wolf',
    tint: 0x7e9b73,
    barColor: '#9bc17d',
    boss: false,
  },
  bull: {
    id: 'bull',
    name: '荒角野猪',
    en: 'Wild Boar',
    hp: 195,
    speed: 1.35,
    reward: 15,
    coreDamage: 3,
    height: 1.35,
    modelKey: 'whitebox/enemy_boar',
    tint: 0x9a7656,
    barColor: '#d2a35a',
    boss: false,
  },
  stag: {
    id: 'stag',
    name: '白鹿王',
    en: 'White Stag',
    hp: 1950,
    speed: 1.08,
    reward: 120,
    coreDamage: 8,
    height: 2.15,
    modelKey: 'whitebox/enemy_stag',
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
    description: '合成防御塔时，返还被合并塔 50% 的建造金币；乡勇合成不返还。',
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
