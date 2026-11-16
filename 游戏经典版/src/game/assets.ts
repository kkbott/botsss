import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  Group,
  IcosahedronGeometry,
  LoopRepeat,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  TorusGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CROPS, ENEMIES, TOWERS } from './config';
import type { CropId, EnemyDef, EnemyId, TowerId } from './types';
import type { ArtProvider, CropArt, EnemyArt, TowerArt } from './art';
import { ProceduralArt } from './models';
import { collapseGroup } from './batch';

type SourceKind = 'quaternius' | 'kenney';

interface LoadedModel {
  scene: Group;
  animations: AnimationClip[];
  source: SourceKind;
}

const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

function assetPath(path: string) {
  return `${BASE}assets/${path}`;
}

/* ───────────────────────────── manifest ───────────────────────────── */

const CROP_FILES: Record<CropId, string[]> = {
  wheat: [1, 2, 3, 4].map((n) => `quaternius/crops/Wheat_${n}`),
  pumpkin: [1, 2, 3, 4].map((n) => `quaternius/crops/Pumpkin_${n}`),
  flower: [1, 2, 3, 4].map((n) => `quaternius/crops/Flower_${n}`),
};

const TOWER_FILES: Record<TowerId, string[]> = {
  arrow: TOWERS.arrow.modelKeys as unknown as string[],
  cannon: TOWERS.cannon.modelKeys as unknown as string[],
  star: TOWERS.star.modelKeys as unknown as string[],
};

const ANIMAL_FILES: Record<EnemyId, string> = {
  fox: ENEMIES.fox.modelKey,
  wolf: ENEMIES.wolf.modelKey,
  bull: ENEMIES.bull.modelKey,
  stag: ENEMIES.stag.modelKey,
};

export const ENVIRONMENT_FILES = {
  house: 'quaternius/environment/House_1',
  windmill: 'quaternius/environment/Windmill_FirstAge',
  market: 'quaternius/environment/MarketStand_1',
  well: 'quaternius/environment/Well',
  hay: 'quaternius/environment/Hay',
  crate: 'quaternius/environment/Crate',
  barrel: 'quaternius/environment/Barrel',
  fence: 'quaternius/environment/Fence',
  tree_common: 'quaternius/environment/CommonTree_1',
  tree_autumn: 'quaternius/environment/CommonTree_Autumn_2',
  tree_birch: 'quaternius/environment/BirchTree_1',
  bush: 'quaternius/environment/Bush_1',
  bush_berries: 'quaternius/environment/BushBerries_1',
  rock: 'quaternius/environment/Rock',
  rock_group: 'quaternius/environment/Rock_Group',
  pine_tall: 'kenney/tree_pineTallA',
  pine_round: 'kenney/tree_pineRoundA',
  oak: 'kenney/tree_oak',
  tree_small: 'kenney/tree_small',
  rock_a: 'kenney/rock_largeA',
  rock_c: 'kenney/rock_largeC',
  rock_tall: 'kenney/rock_tallA',
  flowers_purple: 'kenney/flower_purpleA',
  flowers_yellow: 'kenney/flower_yellowA',
  flowers_red: 'kenney/flower_redA',
  grass: 'kenney/grass',
  grass_large: 'kenney/grass_large',
  mushroom_red: 'kenney/mushroom_red',
  mushroom_tan: 'kenney/mushroom_tan',
  path_stone: 'kenney/path_stone',
  path_circle: 'kenney/path_stoneCircle',
  lily: 'kenney/lily_large',
  stump: 'kenney/stump_round',
  log: 'kenney/log',
  pot_large: 'kenney/pot_large',
  pot_small: 'kenney/pot_small',
  statue_column: 'kenney/statue_column',
  statue_obelisk: 'kenney/statue_obelisk',
  tent: 'kenney/tent_smallClosed',
  fence_simple: 'kenney/fence_simple',
  fence_gate: 'kenney/fence_gate',
  campfire: 'kenney/campfire_logs',
  plant_bush: 'kenney/plant_bush',
  plant_bush_detailed: 'kenney/plant_bushDetailed',
} as const;

const ENVIRONMENT_KEYS = Object.keys(ENVIRONMENT_FILES) as Array<keyof typeof ENVIRONMENT_FILES>;

function allAssetEntries(): Array<{ key: string; path: string }> {
  const entries: Array<{ key: string; path: string }> = [];
  for (const files of Object.values(CROP_FILES)) entries.push(...files.map((path) => ({ key: path, path })));
  for (const files of Object.values(TOWER_FILES)) entries.push(...files.map((path) => ({ key: path, path })));
  for (const path of Object.values(ANIMAL_FILES)) entries.push({ key: path, path });
  for (const path of Object.values(ENVIRONMENT_FILES)) entries.push({ key: path, path });
  return entries;
}

/* ───────────────────────────── colour harmonisation ───────────────────────────── */

const KENNEY_PALETTE: Record<string, number> = {
  leafsDark: 0x527b40,
  leafsGreen: 0x6f9d52,
  leafsFall: 0xd7a74b,
  grass: 0x709a4f,
  corn: 0xe0b552,
  woodBark: 0x7f5c39,
  woodBarkDark: 0x5d432b,
  wood: 0x96713f,
  woodDark: 0x6d4f31,
  woodInner: 0xb78e58,
  dirt: 0x7a5b3f,
  dirtDark: 0x5d4631,
  stone: 0x909183,
  stoneDark: 0x6d6f62,
  colorPurple: 0xa98cff,
  colorYellow: 0xf3c455,
  colorRed: 0xe17b58,
  colorRedDark: 0xb85d46,
  colorTan: 0xd6b47e,
};

function kenneyColor(name: string, key: string, fallback: Color) {
  if (name === '_defaultMat') {
    if (key.includes('mushroom_red')) return 0xcb6a4f;
    if (key.includes('mushroom_tan')) return 0xd8b77c;
    if (key.includes('path_stone') || key.includes('path_circle')) return 0x9b9584;
    if (key.includes('pot_')) return 0x9c7443;
    if (key.includes('statue')) return 0x9b9b8c;
    if (key.includes('lily')) return 0x619d56;
    return 0x8b8674;
  }
  return KENNEY_PALETTE[name] ?? fallback.getHex();
}

function convertMaterial(material: Material, source: SourceKind, key: string): Material {
  if (source === 'kenney') {
    const tinted = material as Material & { name?: string; color?: Color };
    const fallback = tinted.color ?? new Color(0xffffff);
    const color = new Color(kenneyColor(tinted.name ?? '', key, fallback));
    return new MeshStandardMaterial({
      color,
      roughness: 0.98,
      metalness: 0,
      flatShading: true,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side,
    });
  }
  if (material instanceof MeshStandardMaterial) {
    material.roughness = 0.95;
    material.metalness = 0;
    material.envMapIntensity = 0.4;
    // The medieval Quaternius pieces carry a teal roof; warm it up so the
    // farmstead and the procedural shrines read as one palette.
    if (material.name === 'RoofTiles' || material.name === 'RoofTiles_Red') {
      material.color.setHex(0x944b38);
    }
    return material;
  }
  if (material instanceof MeshPhongMaterial) {
    return new MeshStandardMaterial({
      color: material.color,
      map: material.map ?? null,
      vertexColors: material.vertexColors,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side,
    });
  }
  return material;
}

function prepareSource(scene: Group, source: SourceKind, key: string) {
  scene.traverse((object) => {
    const node = object as Mesh;
    if (!node.isMesh) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) => convertMaterial(material, source, key));
    } else if (node.material) {
      node.material = convertMaterial(node.material, source, key);
    }
    node.castShadow = true;
    node.receiveShadow = true;
    if ((node as SkinnedMesh).isSkinnedMesh) node.frustumCulled = false;
  });
}

/* ───────────────────────────── loader ───────────────────────────── */

export class AssetLibrary {
  private readonly models = new Map<string, LoadedModel>();
  readonly errors: string[] = [];

  get size() {
    return this.models.size;
  }

  get total() {
    return allAssetEntries().length;
  }

  has(key: string) {
    return this.models.has(key);
  }

  get(key: string): LoadedModel | undefined {
    return this.models.get(key);
  }

  async loadAll(onProgress?: (fraction: number, label: string) => void) {
    const entries = allAssetEntries();
    const loader = new GLTFLoader();
    let completed = 0;
    let cursor = 0;
    const total = entries.length;
    onProgress?.(0, '唤醒低多边形山野');
    const worker = async () => {
      for (;;) {
        const index = cursor++;
        if (index >= entries.length) return;
        const entry = entries[index];
        try {
          const gltf = await loader.loadAsync(assetPath(`${entry.path}.glb`));
          const source: SourceKind = entry.key.startsWith('kenney/') ? 'kenney' : 'quaternius';
          prepareSource(gltf.scene, source, entry.key);
          this.models.set(entry.key, { scene: gltf.scene, animations: gltf.animations, source });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.errors.push(`${entry.path}: ${message}`);
        } finally {
          completed += 1;
          onProgress?.(completed / total, '整理作物、野兽与石塔');
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, () => worker()));
  }
}

/* ───────────────────────────── helpers ───────────────────────────── */

function normalizeModel(
  source: Object3D,
  options: { height: number; maxWidth?: number; fixedScale?: number; ground?: boolean; center?: boolean },
): Group {
  const wrapper = new Group();
  wrapper.add(source);
  source.updateMatrixWorld(true);
  const box = new Box3().setFromObject(source);
  const size = box.getSize(new Vector3());
  let scale = options.fixedScale ?? options.height / Math.max(0.0001, size.y);
  if (options.maxWidth && options.maxWidth > 0) {
    const width = Math.max(size.x, size.z);
    scale = Math.min(scale, options.maxWidth / Math.max(0.0001, width));
  }
  source.scale.multiplyScalar(scale);
  source.updateMatrixWorld(true);
  const fitted = new Box3().setFromObject(source);
  if (options.center !== false) {
    source.position.x -= (fitted.min.x + fitted.max.x) / 2;
    source.position.z -= (fitted.min.z + fitted.max.z) / 2;
  }
  if (options.ground !== false) {
    source.position.y -= fitted.min.y;
  }
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

function cropScaleFor(def: (typeof CROPS)[CropId], model: Group) {
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const heightScale = def.matureHeight / Math.max(0.0001, size.y);
  const widthScale = 1.4 / Math.max(0.0001, Math.max(size.x, size.z));
  return Math.min(heightScale, widthScale);
}

function tintMaterials(root: Object3D, tint: number, strength: number, emissive: number) {
  const tintColor = new Color(tint);
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const converted = materials.map((material) => {
      if (!(material instanceof MeshStandardMaterial)) return material;
      const cloned = material.clone();
      cloned.color.lerp(tintColor, strength);
      if (emissive > 0) {
        cloned.emissive.copy(tintColor);
        cloned.emissiveIntensity = emissive;
      }
      return cloned;
    });
    mesh.material = Array.isArray(mesh.material) ? converted : converted[0];
  });
}

function addTowerGlow(group: Group, color: number, height: number) {
  const orb = new Mesh(
    new IcosahedronGeometry(0.12, 0),
    new MeshBasicMaterial({ color, transparent: true, opacity: 0.98 }),
  );
  orb.name = 'tower-orb';
  orb.position.set(0, height + 0.18, 0);
  orb.castShadow = false;
  orb.receiveShadow = false;
  group.add(orb);
  const spin = new Group();
  spin.name = 'tower-spin';
  spin.position.copy(orb.position);
  const halo = new Mesh(
    new TorusGeometry(0.32, 0.018, 4, 22),
    new MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
  );
  halo.rotation.x = Math.PI / 2;
  spin.add(halo);
  group.add(spin);
}

/* ───────────────────────────── asset-backed art ───────────────────────────── */

const TOWER_HEIGHTS: Record<TowerId, [number, number, number]> = {
  arrow: [3.4, 3.9, 4.5],
  cannon: [3.0, 3.4, 3.9],
  star: [3.3, 4.0, 4.7],
};

export class AssetArt implements ArtProvider {
  readonly kind = 'assets' as const;
  private readonly cropTemplates = new Map<CropId, Group[]>();
  private readonly towerTemplates = new Map<string, Group>();
  private readonly enemyTemplates = new Map<EnemyId, Group>();
  private readonly enemyClips = new Map<EnemyId, AnimationClip[]>();
  private fallback: ProceduralArt | null = null;

  constructor(private readonly library: AssetLibrary) {
    this.prepareCrops();
    this.prepareTowers();
    this.prepareEnemies();
  }

  private getFallback() {
    if (!this.fallback) this.fallback = new ProceduralArt();
    return this.fallback;
  }

  private prepareCrops() {
    for (const type of Object.keys(CROP_FILES) as CropId[]) {
      const def = CROPS[type];
      const keys = CROP_FILES[type];
      const sources = keys.map((key) => this.library.get(key));
      if (sources.some((entry) => !entry)) continue;
      const matureSource = sources[sources.length - 1]!.scene;
      const scale = cropScaleFor(def, matureSource);
      const stages: Group[] = [];
      for (const entry of sources) {
        const scene = entry!.scene.clone(true);
        const wrapper = normalizeModel(scene, { height: 1, fixedScale: scale, ground: true, center: true });
        collapseGroup(wrapper);
        stages.push(wrapper);
      }
      this.cropTemplates.set(type, stages);
    }
  }

  private prepareTowers() {
    for (const type of Object.keys(TOWER_FILES) as TowerId[]) {
      const keys = TOWER_FILES[type];
      for (let levelIndex = 0; levelIndex < keys.length; levelIndex++) {
        const loaded = this.library.get(keys[levelIndex]);
        if (!loaded) continue;
        const height = TOWER_HEIGHTS[type][levelIndex];
        const scene = loaded.scene.clone(true);
        const wrapper = normalizeModel(scene, { height, maxWidth: 2.3, center: true, ground: true });
        addTowerGlow(wrapper, TOWERS[type].projectileColor, height);
        const spin = wrapper.getObjectByName('tower-spin');
        const orb = wrapper.getObjectByName('tower-orb');
        collapseGroup(wrapper, { keep: spin && orb ? [spin, orb] : [] });
        this.towerTemplates.set(`${type}:${levelIndex + 1}`, wrapper);
      }
    }
  }

  private prepareEnemies() {
    for (const type of Object.keys(ANIMAL_FILES) as EnemyId[]) {
      const key = ANIMAL_FILES[type];
      const loaded = this.library.get(key);
      if (!loaded) continue;
      const def = ENEMIES[type];
      const scene = skeletonClone(loaded.scene) as Group;
      tintMaterials(scene, def.tint, def.boss ? 0.26 : 0.18, def.boss ? 0.1 : 0);
      const wrapper = normalizeModel(scene, { height: def.height, center: true, ground: true });
      // Quaternius animal rigs are authored head-toward +Z, which is the same
      // convention as the path tangent calculation in Game.updateEnemies().
      wrapper.rotation.y = 0;
      this.enemyTemplates.set(type, wrapper);
      this.enemyClips.set(type, loaded.animations);
    }
  }

  crop(type: CropId, stage: number, _mature = stage >= 3): CropArt {
    const stages = this.cropTemplates.get(type);
    if (!stages) return this.getFallback().crop(type, stage, _mature);
    const template = stages[Math.min(3, Math.max(0, stage))];
    const group = new Group();
    if (type === 'pumpkin') {
      group.add(template.clone(true));
      const small = template.clone(true);
      small.position.set(0.34, 0, 0.26);
      small.scale.setScalar(0.55);
      small.rotation.y = 1.7;
      group.add(small);
    } else {
      const offset = type === 'wheat' ? 0.24 : 0.2;
      const first = template.clone(true);
      first.position.set(-offset, 0, 0.08);
      first.rotation.y = -0.5;
      const second = template.clone(true);
      second.position.set(offset, 0, -0.12);
      second.rotation.y = 0.75;
      group.add(first, second);
      const third = template.clone(true);
      third.position.set(0.02, 0, 0.3);
      third.rotation.y = 2.1;
      third.scale.setScalar(0.86);
      group.add(third);
      if (type === 'wheat') {
        const fourth = template.clone(true);
        fourth.position.set(-0.05, 0, -0.3);
        fourth.rotation.y = 4.1;
        fourth.scale.setScalar(0.72);
        group.add(fourth);
      }
    }
    collapseGroup(group);
    return { group, sway: group };
  }

  tower(type: TowerId, level: 1 | 2 | 3): TowerArt {
    const template = this.towerTemplates.get(`${type}:${level}`);
    if (!template) return this.getFallback().tower(type, level);
    const group = template.clone(true);
    const spin = group.getObjectByName('tower-spin') ?? new Group();
    const orb = group.getObjectByName('tower-orb') as Mesh | undefined;
    if (!orb) {
      const placeholder = new Mesh(new IcosahedronGeometry(0.08, 0), new MeshBasicMaterial({ color: TOWERS[type].projectileColor }));
      placeholder.name = 'tower-orb';
      group.add(placeholder);
      return { group, spin, orb: placeholder };
    }
    return { group, spin, orb };
  }

  enemy(type: EnemyId): EnemyArt {
    const template = this.enemyTemplates.get(type);
    if (!template) return this.getFallback().enemy(type);
    const def: EnemyDef = ENEMIES[type];
    const visual = skeletonClone(template) as Group;
    const group = new Group();
    group.add(visual);
    const clips = this.enemyClips.get(type) ?? [];
    let mixer: AnimationMixer | null = null;
    const walk =
      clips.find((clip) => /walk/i.test(clip.name)) ??
      clips.find((clip) => /gallop/i.test(clip.name)) ??
      clips[0];
    if (walk) {
      mixer = new AnimationMixer(visual);
      const action = mixer.clipAction(walk);
      action.setLoop(LoopRepeat, Infinity);
      action.time = Math.random() * Math.max(0.1, walk.duration);
      action.play();
      mixer.update(0);
    }
    if (def.boss) {
      const aura = new Mesh(
        new TorusGeometry(0.62, 0.028, 4, 30),
        new MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.55 }),
      );
      aura.rotation.x = Math.PI / 2;
      aura.position.y = 0.06;
      aura.castShadow = false;
      group.add(aura);
    }
    group.userData.visual = visual;
    return {
      group,
      visual,
      legs: [],
      phase: Math.random() * Math.PI * 2,
      mixer,
      head: visual.getObjectByName('Head') ?? visual.getObjectByName('head') ?? undefined,
    };
  }
}

export class EnvironmentAssets {
  private readonly templates = new Map<string, { template: Group; widthRatio: number }>();

  constructor(private readonly library: AssetLibrary) {
    for (const key of ENVIRONMENT_KEYS) {
      const loaded = this.library.get(ENVIRONMENT_FILES[key]);
      if (!loaded) continue;
      const scene = loaded.scene.clone(true);
      const wrapper = new Group();
      wrapper.add(scene);
      const scale = normalizeModel(scene, { height: 1, center: true, ground: true });
      const box = new Box3().setFromObject(scale);
      const size = box.getSize(new Vector3());
      this.templates.set(key, { template: scale, widthRatio: Math.max(size.x, size.z) });
    }
  }

  has(key: keyof typeof ENVIRONMENT_FILES) {
    return this.templates.has(key);
  }

  instance(key: keyof typeof ENVIRONMENT_FILES, height: number, options: { maxWidth?: number; shadows?: boolean } = {}): Group | null {
    const entry = this.templates.get(key);
    if (!entry) return null;
    const group = entry.template.clone(true);
    let scale = height;
    if (options.maxWidth && entry.widthRatio > 0.0001) {
      scale = Math.min(scale, options.maxWidth / entry.widthRatio);
    }
    group.scale.setScalar(scale);
    group.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = options.shadows !== false;
      mesh.receiveShadow = options.shadows !== false;
    });
    return group;
  }

}

export function assetSummary(library: AssetLibrary) {
  return {
    loaded: library.size,
    errors: [...library.errors],
  };
}
