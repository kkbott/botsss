import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { CropId, EnemyId, TowerId } from './types';
import { collapseGroup } from './batch';
import type { ArtProvider, CropArt, EnemyArt, TowerArt } from './art';

const materials = new Map<string, MeshStandardMaterial>();

function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; emissiveIntensity?: number; flat?: boolean } = {}) {
  const key = `${color}-${opts.rough ?? 1}-${opts.metal ?? 0}-${opts.emissive ?? -1}-${opts.emissiveIntensity ?? 0}-${opts.flat ?? true}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.95,
      metalness: opts.metal ?? 0,
      flatShading: opts.flat ?? true,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? opts.emissiveIntensity ?? 1 : 0,
    });
    materials.set(key, material);
  }
  return material;
}

function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, opts?: Parameters<typeof mat>[1]) {
  return mesh(new BoxGeometry(w, h, d), mat(color, opts), x, y, z);
}

function cyl(rt: number, rb: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 7, opts?: Parameters<typeof mat>[1]) {
  return mesh(new CylinderGeometry(rt, rb, h, seg), mat(color, opts), x, y, z);
}

function cone(r: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 6, opts?: Parameters<typeof mat>[1]) {
  return mesh(new ConeGeometry(r, h, seg), mat(color, opts), x, y, z);
}

function sphere(r: number, color: number, x = 0, y = 0, z = 0, seg = 7, opts?: Parameters<typeof mat>[1]) {
  return mesh(new SphereGeometry(r, seg, Math.max(4, seg - 2)), mat(color, opts), x, y, z);
}

function ico(r: number, color: number, x = 0, y = 0, z = 0, detail = 0, opts?: Parameters<typeof mat>[1]) {
  return mesh(new IcosahedronGeometry(r, detail), mat(color, opts), x, y, z);
}

function ring(r: number, color: number, x = 0, y = 0.03, z = 0, width = 0.08, opts?: Parameters<typeof mat>[1]) {
  const m = mesh(new RingGeometry(r - width, r, 32), mat(color, { ...opts, flat: true }), x, y, z);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = false;
  return m;
}

function addLevelPips(group: Group, level: number) {
  for (let i = 0; i < level; i++) {
    const pip = sphere(0.085, 0xf3c455, 0, 0, 0, 5, { emissive: 0xf3c455, emissiveIntensity: 0.8 });
    pip.position.set((i - (level - 1) / 2) * 0.26, 0.08, 0.63);
    pip.castShadow = false;
    group.add(pip);
  }
}

/* ───────────────────────────── crops ───────────────────────────── */

function buildWheat(stage: number): Group {
  const g = new Group();
  const scale = [0.34, 0.58, 0.82, 1][stage];
  for (let i = 0; i < 3 + stage * 2; i++) {
    const a = (i / (3 + stage * 2)) * Math.PI * 2 + 0.35;
    const r = 0.14 + (i % 3) * 0.1;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = (0.45 + (i % 4) * 0.1) * scale;
    const stalk = cyl(0.018, 0.026, h, stage >= 2 ? 0xc7a74b : 0x7fa955, x, h / 2, z, 5);
    g.add(stalk);
    if (stage >= 2) {
      const head = cyl(0.035, 0.06, 0.18, 0xe8c45c, x, h + 0.06, z, 5, {
        emissive: 0x6b4f16,
        emissiveIntensity: 0.18,
      });
      g.add(head);
      const awn = cone(0.1, 0.16, 0xe0bb56, x, h + 0.19, z, 4);
      awn.rotation.y = i;
      g.add(awn);
    }
  }
  if (stage < 2) {
    for (let i = 0; i < 4 + stage * 2; i++) {
      const leaf = cone(0.06, 0.24, 0x76a752, (i % 3 - 1) * 0.12, 0.1, ((i * 7) % 5 - 2) * 0.06, 4);
      leaf.rotation.z = (i % 2 ? 1 : -1) * 0.7;
      g.add(leaf);
    }
  }
  return g;
}

function buildPumpkin(stage: number): Group {
  const g = new Group();
  const scale = [0.36, 0.62, 0.84, 1][stage];
  const vine = cyl(0.025, 0.04, 0.7 * scale, 0x5f8c42, 0, 0.35 * scale, 0, 5);
  g.add(vine);
  for (let i = 0; i < 4; i++) {
    const leaf = sphere(0.13 + (i % 2) * 0.04, 0x74a94f, Math.cos(i * 1.8) * 0.28, 0.16, Math.sin(i * 1.8) * 0.28, 5);
    leaf.scale.set(1.5, 0.32, 1.1);
    g.add(leaf);
  }
  if (stage >= 2) {
    const count = stage === 2 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const size = (stage === 2 ? 0.2 : 0.26) * (i === 1 ? 0.8 : 1);
      const pumpkin = sphere(size, 0xe8873c, (i === 0 ? -0.16 : 0.2), size * 0.74, i === 0 ? 0.12 : -0.16, 9, {
        emissive: 0x4a2108,
        emissiveIntensity: 0.2,
      });
      pumpkin.scale.y = 0.78;
      g.add(pumpkin);
      const stem = cyl(0.035, 0.05, 0.13, 0x4c6a31, pumpkin.position.x, size * 1.42, pumpkin.position.z, 5);
      g.add(stem);
    }
  }
  if (stage === 3) {
    const flower = ico(0.08, 0xf3c455, 0.34, 0.4, -0.18, 0, { emissive: 0xf3c455, emissiveIntensity: 0.25 });
    g.add(flower);
  }
  return g;
}

function buildFlower(stage: number): Group {
  const g = new Group();
  const scale = [0.32, 0.58, 0.84, 1][stage];
  const stem = cyl(0.022, 0.035, 0.85 * scale, 0x6fa457, 0, 0.43 * scale, 0, 5);
  g.add(stem);
  for (let i = 0; i < 3; i++) {
    const leaf = cone(0.09, 0.26, 0x7fb45d, Math.cos(i * 2.1) * 0.13, 0.28 * scale, Math.sin(i * 2.1) * 0.13, 4);
    leaf.rotation.z = 0.8 - i * 0.2;
    leaf.rotation.y = i * 2.1;
    g.add(leaf);
  }
  if (stage >= 1) {
    const petals = stage >= 3 ? 7 : 5;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      const petal = cone(0.09, 0.3, stage >= 2 ? 0x9d7bff : 0xbca7ff, Math.cos(a) * 0.16, 0.88 * scale, Math.sin(a) * 0.16, 4, {
        emissive: stage >= 2 ? 0x5d3fb8 : 0x3d2c78,
        emissiveIntensity: stage === 3 ? 0.7 : 0.25,
      });
      petal.rotation.z = Math.cos(a) * 0.9;
      petal.rotation.x = -Math.sin(a) * 0.9;
      g.add(petal);
    }
    const core = ico(0.12, 0x8deee0, 0, 0.88 * scale, 0, 0, {
      emissive: 0x74e3d8,
      emissiveIntensity: stage === 3 ? 1.1 : 0.3,
    });
    g.add(core);
  }
  if (stage === 3) {
    const halo = mesh(
      new RingGeometry(0.23, 0.29, 20),
      new MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.8, side: DoubleSide }),
      0,
      1.14,
      0,
    );
    halo.rotation.x = -Math.PI / 2;
    halo.castShadow = false;
    g.add(halo);
  }
  return g;
}

/* ───────────────────────────── towers ───────────────────────────── */

function buildArrowTower(level: number): TowerArt {
  const g = new Group();
  const scale = 1 + (level - 1) * 0.12;
  g.add(cyl(1.0, 1.18, 0.24 * scale, 0x817f6c, 0, 0.12, 0, 8));
  g.add(cyl(0.76, 0.9, 0.14 * scale, 0x9a9a82, 0, 0.29, 0, 8));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.52;
    const z = Math.sin(a) * 0.52;
    const leg = box(0.13 * scale, 2.1 * scale, 0.13 * scale, 0x8c6137, x, 1.35, z);
    leg.rotation.z = x * 0.06;
    g.add(leg);
  }
  g.add(box(1.25 * scale, 0.18 * scale, 1.25 * scale, 0x9b7142, 0, 2.45 * scale, 0));
  g.add(cyl(0.24 * scale, 0.3 * scale, 0.72 * scale, 0x74502f, 0, 2.9 * scale, 0, 6));
  const roof = cone(1.08 * scale, 0.85 * scale, 0x527b48, 0, 3.55 * scale, 0, 7);
  g.add(roof);
  g.add(cone(0.11, 0.5, 0xe8c45c, 0, 4.02 * scale, 0, 4));
  const banner = new Group();
  banner.position.set(0.85 * scale, 2.82 * scale, 0.2);
  banner.add(box(0.05, 0.6, 0.05, 0x5b4329, 0, 0, 0));
  const cloth = new Mesh(new PlaneGeometry(0.43, 0.3), new MeshStandardMaterial({ color: 0xe0b34c, side: DoubleSide, roughness: 1 }));
  cloth.position.set(0.21, 0.14, 0);
  cloth.castShadow = true;
  banner.add(cloth);
  g.add(banner);
  const spin = new Group();
  spin.name = 'tower-spin';
  spin.position.set(0, 3.05 * scale, 0.28);
  const vane = new Mesh(new PlaneGeometry(0.36, 0.16), new MeshStandardMaterial({ color: 0xd9c689, side: DoubleSide, roughness: 0.9 }));
  vane.position.x = 0.16;
  spin.add(vane);
  g.add(spin);
  const orb = ico(0.12, 0xf3c455, 0, 3.42 * scale, 0.3, 0, { emissive: 0xf3c455, emissiveIntensity: 1.1 });
  orb.name = 'tower-orb';
  orb.castShadow = false;
  g.add(orb);
  addLevelPips(g, level);
  return { group: g, spin, orb };
}

function buildCannonTower(level: number): TowerArt {
  const g = new Group();
  const scale = 1 + (level - 1) * 0.1;
  g.add(cyl(1.1, 1.32, 0.32 * scale, 0x8b8775, 0, 0.16, 0, 8));
  g.add(cyl(0.92, 1.04, 0.2 * scale, 0x6d6b5c, 0, 0.38, 0, 8));
  g.add(box(1.32 * scale, 1.12, 1.32 * scale, 0x8f6a3f, 0, 1.08 * scale, 0));
  g.add(box(1.42 * scale, 0.16, 1.42 * scale, 0x6f4e2d, 0, 1.7 * scale, 0));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const stone = ico(0.25, 0x75766a, Math.cos(a) * 0.94, 0.42, Math.sin(a) * 0.94, 0);
    stone.scale.y = 0.7;
    g.add(stone);
  }
  const barrel = new Group();
  barrel.position.set(0, 1.98 * scale, 0.08);
  const tube = cyl(0.17, 0.26, 1.05, 0x3f423c, 0, 0.2, 0.34, 7);
  tube.rotation.x = Math.PI / 2 - 0.18;
  barrel.add(tube);
  barrel.add(cyl(0.3, 0.35, 0.26, 0x34362f, 0, 0.1, -0.08, 7));
  const pumpkin = sphere(0.38, 0xe8873c, 0, 0.18, -0.05, 8, { emissive: 0x4a2108, emissiveIntensity: 0.3 });
  pumpkin.scale.set(1, 0.8, 0.8);
  barrel.add(pumpkin);
  const fuse = ico(0.06, 0xf3c455, 0.24, 0.4, -0.04, 0, { emissive: 0xf3c455, emissiveIntensity: 1.5 });
  barrel.add(fuse);
  g.add(barrel);
  const roof = cone(0.48, 0.52, 0x5b7e4c, 1.05, 2.24, -0.8, 5);
  g.add(roof);
  const spin = new Group();
  spin.name = 'tower-spin';
  spin.position.set(0, 2.2, 0.55);
  const flag = new Mesh(new PlaneGeometry(0.42, 0.24), new MeshStandardMaterial({ color: 0xef8056, side: DoubleSide, roughness: 1 }));
  flag.position.set(0.24, 0.18, 0);
  spin.add(flag);
  g.add(spin);
  const orb = ico(0.13, 0xff9b5a, 0.45, 2.32, 0.2, 0, { emissive: 0xff7a3a, emissiveIntensity: 1.2 });
  orb.name = 'tower-orb';
  orb.castShadow = false;
  g.add(orb);
  addLevelPips(g, level);
  return { group: g, spin, orb };
}

function buildStarTower(level: number): TowerArt {
  const g = new Group();
  const scale = 1 + (level - 1) * 0.11;
  g.add(cyl(1.06, 1.3, 0.3 * scale, 0x7a7d73, 0, 0.15, 0, 10));
  g.add(ring(0.92, 0x9d7bff, 0, 0.32, 0, 0.07, { emissive: 0x6a4cda, emissiveIntensity: 0.8 }));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const pillar = cyl(0.09, 0.13, 1.9 * scale, 0x9ba28e, Math.cos(a) * 0.62, 1.06, Math.sin(a) * 0.62, 5);
    g.add(pillar);
    const cap = ico(0.12, 0xb9a5ff, Math.cos(a) * 0.62, 2.06 * scale, Math.sin(a) * 0.62, 0, {
      emissive: 0x7a5ecf,
      emissiveIntensity: 0.9,
    });
    cap.castShadow = false;
    g.add(cap);
  }
  g.add(box(0.56 * scale, 2.0 * scale, 0.56 * scale, 0x7f8780, 0, 1.3, 0));
  const obelisk = box(0.4 * scale, 0.7 * scale, 0.4 * scale, 0x9aa594, 0, 2.4 * scale, 0);
  obelisk.rotation.y = Math.PI / 4;
  g.add(obelisk);
  const crystal = mesh(new ConeGeometry(0.2, 0.55, 4), mat(0x9d7bff, { emissive: 0x6b4dd2, emissiveIntensity: 1.2, rough: 0.25 }), 0, 3.15 * scale, 0);
  crystal.rotation.y = Math.PI / 4;
  crystal.castShadow = false;
  g.add(crystal);
  const halo = new Group();
  halo.name = 'tower-spin';
  halo.position.y = 3.12 * scale;
  const h1 = mesh(new TorusGeometry(0.46, 0.028, 4, 28), mat(0x8deee0, { emissive: 0x74e3d8, emissiveIntensity: 1.4, rough: 0.2 }), 0, 0, 0);
  h1.rotation.x = Math.PI / 2;
  const h2 = mesh(new TorusGeometry(0.58, 0.02, 4, 28), mat(0x9d7bff, { emissive: 0x7a5ecf, emissiveIntensity: 1.2, rough: 0.2 }), 0, 0, 0);
  h2.rotation.set(Math.PI / 2.4, 0.4, 0);
  h1.castShadow = h2.castShadow = false;
  halo.add(h1, h2);
  g.add(halo);
  const orb = ico(0.16, 0x8deee0, 0, 3.68 * scale, 0, 0, { emissive: 0x74e3d8, emissiveIntensity: 1.4 });
  orb.name = 'tower-orb';
  orb.castShadow = false;
  g.add(orb);
  addLevelPips(g, level);
  const spin = halo;
  return { group: g, spin, orb };
}

/* ───────────────────────────── enemies ───────────────────────────── */

interface QuadrupedOptions {
  body: number;
  belly?: number;
  head: number;
  legs: number;
  accent: number;
  eye?: number;
  size: number;
  boss?: boolean;
  tail?: boolean;
  horns?: boolean;
  antlers?: boolean;
}

function buildQuadruped(opts: QuadrupedOptions): EnemyArt {
  const group = new Group();
  const visual = new Group();
  visual.name = 'enemy-visual';
  group.add(visual);
  const s = opts.size;
  const body = sphere(0.34 * s, opts.body, 0, 0.48 * s, 0, 7);
  body.scale.set(1.05, 0.88, 1.72);
  body.castShadow = true;
  visual.add(body);
  const chest = sphere(0.27 * s, opts.head, 0, 0.5 * s, 0.46 * s, 6);
  chest.scale.set(1.05, 1.05, 1);
  visual.add(chest);
  const head = new Group();
  head.position.set(0, 0.62 * s, 0.65 * s);
  const skull = sphere(0.25 * s, opts.head, 0, 0, 0, 6);
  skull.scale.set(0.95, 1, 1.05);
  head.add(skull);
  const snout = sphere(0.13 * s, opts.accent, 0, -0.05 * s, 0.22 * s, 5);
  snout.scale.set(0.9, 0.72, 1.15);
  head.add(snout);
  for (const side of [-1, 1]) {
    const ear = cone(0.1 * s, 0.3 * s, opts.body, side * 0.16 * s, 0.24 * s, -0.04 * s, 4);
    ear.rotation.z = side * 0.28;
    head.add(ear);
    if (opts.eye !== undefined) {
      const eye = sphere(0.039 * s, opts.eye, side * 0.1 * s, 0.06 * s, 0.2 * s, 4, {
        emissive: opts.eye,
        emissiveIntensity: 1.2,
      });
      eye.castShadow = false;
      head.add(eye);
    }
    if (opts.horns) {
      const horn = cone(0.055 * s, 0.36 * s, 0xd8c8a3, side * 0.2 * s, 0.22 * s, 0.04 * s, 4);
      horn.rotation.z = side * 0.9;
      horn.rotation.x = -0.3;
      head.add(horn);
    }
    if (opts.antlers) {
      const antler = new Group();
      antler.position.set(side * 0.13 * s, 0.24 * s, 0.02 * s);
      const stem = cone(0.035 * s, 0.55 * s, 0x4b376d, 0, 0.22 * s, 0, 4);
      stem.rotation.z = side * 0.35;
      antler.add(stem);
      for (let b = 0; b < 3; b++) {
        const branch = cone(0.022 * s, 0.26 * s, 0x5b4483, side * (0.06 + b * 0.05) * s, (0.36 + b * 0.11) * s, 0, 4);
        branch.rotation.z = side * (0.8 + b * 0.2);
        antler.add(branch);
      }
      head.add(antler);
    }
  }
  visual.add(head);
  const legs: Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const front = i < 2;
    const side = i % 2 === 0 ? -1 : 1;
    const leg = new Group();
    leg.userData.isLeg = true;
    leg.position.set(side * 0.21 * s, 0.4 * s, (front ? 0.36 : -0.38) * s);
    const upper = cyl(0.055 * s, 0.075 * s, 0.42 * s, opts.legs, 0, -0.18 * s, 0, 5);
    leg.add(upper);
    const hoof = box(0.1 * s, 0.09 * s, 0.15 * s, opts.accent, 0, -0.4 * s, 0.02 * s);
    leg.add(hoof);
    visual.add(leg);
    legs.push(leg);
  }
  if (opts.tail !== false) {
    const tail = new Group();
    tail.position.set(0, 0.52 * s, -0.57 * s);
    const t = cone(0.12 * s, 0.6 * s, opts.body, 0, -0.03 * s, -0.24 * s, 5);
    t.rotation.x = -1.15;
    tail.add(t);
    if (opts.boss) {
      const tip = sphere(0.11 * s, opts.accent, 0, 0.05 * s, -0.5 * s, 5, { emissive: opts.accent, emissiveIntensity: 0.6 });
      tail.add(tip);
    }
    visual.add(tail);
  }
  if (opts.boss) {
    const aura = mesh(
      new RingGeometry(0.5 * s, 0.65 * s, 24),
      new MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.55, side: DoubleSide }),
      0,
      0.04,
      0,
    );
    aura.rotation.x = -Math.PI / 2;
    aura.castShadow = false;
    group.add(aura);
  }
  return { group, visual, legs, phase: Math.random() * Math.PI * 2, mixer: null };
}

/* ───────────────────────────── public art factory ───────────────────────────── */

export class ProceduralArt implements ArtProvider {
  readonly kind = 'procedural' as const;
  private cropTemplates: Record<CropId, Group[]> = { wheat: [], pumpkin: [], flower: [] };
  private towerTemplates: Record<TowerId, TowerArt[]> = { arrow: [], cannon: [], star: [] };
  private enemyTemplates: Record<EnemyId, EnemyArt> = {} as Record<EnemyId, EnemyArt>;

  constructor() {
    this.cropTemplates.wheat = [0, 1, 2, 3].map((s) => buildWheat(s));
    this.cropTemplates.pumpkin = [0, 1, 2, 3].map((s) => buildPumpkin(s));
    this.cropTemplates.flower = [0, 1, 2, 3].map((s) => buildFlower(s));
    for (const stages of Object.values(this.cropTemplates)) {
      for (const stage of stages) collapseGroup(stage);
    }
    this.towerTemplates.arrow = [1, 2, 3].map((l) => buildArrowTower(l));
    this.towerTemplates.cannon = [1, 2, 3].map((l) => buildCannonTower(l));
    this.towerTemplates.star = [1, 2, 3].map((l) => buildStarTower(l));
    for (const levels of Object.values(this.towerTemplates)) {
      for (const art of levels) collapseGroup(art.group, { keep: [art.spin, art.orb] });
    }
    this.enemyTemplates.fox = buildQuadruped({
      body: 0xd66b4a,
      head: 0xe07a55,
      legs: 0x9c4a35,
      accent: 0xf2d2ba,
      eye: 0xffd27a,
      size: 1.0,
      tail: true,
    });
    this.enemyTemplates.wolf = buildQuadruped({
      body: 0x7f9470,
      head: 0x8da57c,
      legs: 0x5e7154,
      accent: 0xc7d3b1,
      eye: 0xa8ff9a,
      size: 1.2,
      tail: true,
    });
    this.enemyTemplates.bull = buildQuadruped({
      body: 0x9a7656,
      head: 0x896b50,
      legs: 0x6a513b,
      accent: 0xd8c8a3,
      eye: 0xffb46b,
      size: 1.5,
      tail: true,
      horns: true,
    });
    this.enemyTemplates.stag = buildQuadruped({
      body: 0x68508f,
      head: 0x7a60a8,
      legs: 0x4b376d,
      accent: 0xc9b6e8,
      eye: 0x9de9ff,
      size: 1.8,
      boss: true,
      tail: true,
      antlers: true,
    });
    for (const art of Object.values(this.enemyTemplates)) {
      collapseGroup(art.visual);
    }
  }

  crop(type: CropId, stage: number, mature: boolean): CropArt {
    const index = mature ? 3 : Math.min(2, Math.max(0, stage));
    const group = this.cropTemplates[type][index].clone(true);
    group.userData.cropType = type;
    const sway = new Group();
    sway.add(group);
    return { group: sway, sway };
  }

  tower(type: TowerId, level: 1 | 2 | 3): TowerArt {
    const template = this.towerTemplates[type][level - 1];
    const group = template.group.clone(true);
    const spin = group.getObjectByName('tower-spin') as Object3D;
    const orb = group.getObjectByName('tower-orb') as Mesh;
    return { group, spin, orb };
  }

  enemy(type: EnemyId): EnemyArt {
    const template = this.enemyTemplates[type];
    const group = template.group.clone(true);
    const visual = group.getObjectByName('enemy-visual') as Group;
    const legs: Object3D[] = [];
    visual.traverse((child) => {
      if (child.userData.isLeg) legs.push(child);
    });
    return {
      group,
      visual,
      legs,
      phase: Math.random() * Math.PI * 2,
      mixer: null,
    };
  }
}

export const ART = new ProceduralArt();

/* Shared procedural environment templates live here so the world can stay lean. */
export function makePineTree(height: number, colorShift = 0): Group {
  const g = new Group();
  const trunk = cyl(0.16, 0.24, height * 0.38, 0x745332, 0, height * 0.19, 0, 6);
  g.add(trunk);
  const tones = [0x4f7b47, 0x5b8b50, 0x679b58];
  for (let i = 0; i < 3; i++) {
    const c = tones[(i + colorShift) % tones.length];
    const layer = cone(1.15 - i * 0.24, height * 0.38, c, 0, height * (0.38 + i * 0.21), 0, 6);
    g.add(layer);
  }
  return g;
}

export function makeRoundTree(height: number, colorShift = 0): Group {
  const g = new Group();
  const trunk = cyl(0.15, 0.26, height * 0.5, 0x7b5838, 0, height * 0.25, 0, 6);
  g.add(trunk);
  const tones = [0x6b9c53, 0x7cae5e, 0x5c8a4b];
  const crown = ico(height * 0.3, tones[colorShift % tones.length], 0, height * 0.62, 0, 1);
  crown.scale.set(1, 0.82, 1);
  g.add(crown);
  const crown2 = ico(height * 0.21, tones[(colorShift + 1) % tones.length], height * 0.17, height * 0.74, -height * 0.08, 0);
  crown2.scale.set(1, 0.85, 1);
  g.add(crown2);
  return g;
}

export function makeRock(size: number, color = 0x8a897a): Mesh {
  const rock = ico(size, color, 0, size * 0.52, 0, 0);
  rock.scale.set(1.1, 0.72, 0.9);
  rock.rotation.set(0.2, Math.random() * Math.PI, 0.1);
  return rock;
}

export function makeGrassTuft(size: number, color = 0x7cac5f): Group {
  const g = new Group();
  for (let i = 0; i < 4; i++) {
    const blade = cone(size * 0.06, size * (0.5 + Math.random() * 0.5), color, (Math.random() - 0.5) * size * 0.4, size * 0.3, (Math.random() - 0.5) * size * 0.4, 3);
    blade.rotation.z = (Math.random() - 0.5) * 0.5;
    g.add(blade);
  }
  return g;
}

export function makeFlower(size: number, color: number): Group {
  const g = new Group();
  g.add(cyl(0.012, 0.02, size * 0.9, 0x6d9a53, 0, size * 0.45, 0, 4));
  const bloom = ico(size * 0.13, color, 0, size * 0.9, 0, 0, { emissive: color, emissiveIntensity: 0.12 });
  g.add(bloom);
  return g;
}

export function makeFenceSegment(length: number): Group {
  const g = new Group();
  for (const x of [-length / 2, length / 2]) {
    g.add(box(0.12, 0.95, 0.12, 0x8b6034, x, 0.48, 0));
  }
  for (const y of [0.34, 0.68]) {
    g.add(box(length, 0.1, 0.08, 0xa47a49, 0, y, 0));
  }
  return g;
}

export function makePathStone(size: number): Mesh {
  const stone = cyl(size * 0.5, size * 0.55, 0.06, 0xa89b82, 0, 0.03, 0, 6);
  stone.receiveShadow = true;
  return stone;
}

export function makeHouse(): Group {
  const g = new Group();
  g.add(box(2.6, 1.6, 2.1, 0xe8d2ad, 0, 0.8, 0));
  g.add(box(2.9, 0.18, 2.4, 0x8b6034, 0, 0.1, 0));
  const roof = cone(2.2, 1.3, 0xa34c3a, 0, 2.15, 0, 4);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.8);
  g.add(roof);
  g.add(box(0.55, 0.9, 0.1, 0x5e432b, 0, 0.45, 1.06));
  g.add(box(0.5, 0.45, 0.1, 0x87b8c4, 1.0, 1.15, 1.06));
  g.add(box(0.5, 0.45, 0.1, 0x87b8c4, -1.0, 1.15, 1.06));
  g.add(box(0.35, 0.8, 0.35, 0x726456, 0.8, 2.1, -0.4));
  return g;
}

export function makeWindmill(): { group: Group; blades: Group } {
  const g = new Group();
  g.add(cyl(0.85, 1.25, 3.4, 0xe5d3b0, 0, 1.7, 0, 8));
  g.add(cyl(1.32, 1.38, 0.25, 0x8b6d4a, 0, 0.12, 0, 8));
  const roof = cone(1.05, 1.1, 0x9a4e3b, 0, 3.85, 0, 8);
  g.add(roof);
  const blades = new Group();
  blades.position.set(0, 3.2, 1.05);
  blades.add(cyl(0.1, 0.1, 0.25, 0x5f432a, 0, 0, 0, 6));
  for (let i = 0; i < 4; i++) {
    const arm = new Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(box(0.18, 1.7, 0.05, 0xc8b18b, 0, 0.95, 0));
    arm.add(box(0.42, 1.15, 0.03, 0xefe1c4, 0, 1.1, 0.03));
    blades.add(arm);
  }
  g.add(blades);
  g.add(box(0.5, 0.95, 0.06, 0x5e432b, 0, 0.48, 1.18));
  return { group: g, blades };
}

export function makeHaystack(): Group {
  const g = new Group();
  g.add(cyl(0.6, 0.7, 0.9, 0xd9b56d, 0, 0.45, 0, 8));
  const top = cone(0.62, 0.55, 0xe2c27e, 0, 1.15, 0, 8);
  g.add(top);
  return g;
}

export function makeCrate(): Group {
  const g = new Group();
  g.add(box(0.75, 0.7, 0.75, 0x9c7443, 0, 0.35, 0));
  g.add(box(0.8, 0.08, 0.8, 0x6f4f2e, 0, 0.66, 0));
  g.add(box(0.8, 0.08, 0.8, 0x6f4f2e, 0, 0.06, 0));
  return g;
}

export function makeBarrel(): Group {
  const g = new Group();
  g.add(cyl(0.38, 0.42, 0.85, 0x8b643c, 0, 0.43, 0, 8));
  g.add(cyl(0.44, 0.44, 0.06, 0x5e432b, 0, 0.2, 0, 8));
  g.add(cyl(0.44, 0.44, 0.06, 0x5e432b, 0, 0.67, 0, 8));
  return g;
}

export function makeWell(): Group {
  const g = new Group();
  g.add(cyl(0.7, 0.8, 0.85, 0x9a9a86, 0, 0.42, 0, 9));
  g.add(cyl(0.52, 0.52, 0.1, 0x6b6b5c, 0, 0.88, 0, 9));
  for (const x of [-0.52, 0.52]) {
    g.add(box(0.12, 1.15, 0.12, 0x8b6034, x, 1.35, 0));
  }
  g.add(box(1.25, 0.12, 0.1, 0x8b6034, 0, 1.9, 0));
  const roof = cone(0.9, 0.55, 0x8a4b3b, 0, 2.05, 0, 4);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return g;
}

export function makeMarket(): Group {
  const g = new Group();
  g.add(box(1.9, 0.75, 1.05, 0x9c7443, 0, 0.38, 0));
  for (const x of [-0.8, 0.8]) {
    g.add(box(0.1, 1.9, 0.1, 0x76532f, x, 0.95, -0.4));
    g.add(box(0.1, 1.9, 0.1, 0x76532f, x, 0.95, 0.4));
  }
  const awning = new Mesh(new PlaneGeometry(2.2, 1.5), new MeshStandardMaterial({ color: 0xe6c271, side: DoubleSide, roughness: 1 }));
  awning.position.set(0, 1.95, 0);
  awning.rotation.x = -Math.PI / 2.35;
  awning.castShadow = true;
  g.add(awning);
  for (let i = 0; i < 4; i++) {
    const produce = sphere(0.13, i % 2 ? 0xe8873c : 0xf3c455, -0.55 + i * 0.35, 0.85, 0.12, 5);
    g.add(produce);
  }
  return g;
}

export function makeTent(): Group {
  const g = new Group();
  const tent = cone(1.2, 1.6, 0xb58a5d, 0, 0.8, 0, 4);
  tent.rotation.y = Math.PI / 4;
  g.add(tent);
  g.add(box(0.45, 0.7, 0.04, 0x5e432b, 0, 0.35, 0.85));
  return g;
}

export function makeStatue(): Group {
  const g = new Group();
  g.add(cyl(0.55, 0.65, 0.22, 0x8b8b7c, 0, 0.11, 0, 8));
  g.add(box(0.36, 1.25, 0.36, 0xa7a695, 0, 0.82, 0));
  g.add(sphere(0.22, 0xa7a695, 0, 1.58, 0, 5));
  g.add(box(0.09, 0.5, 0.09, 0x8b8b7c, 0, 2.0, 0));
  const halo = mesh(
    new RingGeometry(0.35, 0.38, 24),
    new MeshBasicMaterial({ color: 0xd9c58a, transparent: true, opacity: 0.55, side: DoubleSide }),
    0,
    1.7,
    0,
  );
  g.add(halo);
  return g;
}

export function makeCrystal(size: number, color: number, emissive = 0x74e3d8): Group {
  const g = new Group();
  const crystal = mesh(
    new ConeGeometry(size, size * 2.3, 4),
    mat(color, { emissive, emissiveIntensity: 1.15, rough: 0.2, metal: 0.05 }),
    0,
    size * 1.2,
    0,
  );
  crystal.rotation.y = Math.PI / 4;
  crystal.castShadow = false;
  g.add(crystal);
  const base = ico(size * 0.45, color, 0, 0.1, 0, 0, { emissive, emissiveIntensity: 0.9 });
  base.castShadow = false;
  g.add(base);
  return g;
}

export function makePortal(): { group: Group; swirl: Group } {
  const g = new Group();
  g.add(cyl(1.5, 1.85, 0.22, 0x5f6456, 0, 0.11, 0, 9));
  for (const side of [-1, 1]) {
    const stone = ico(0.55, 0x6b6d5e, side * 0.9, 0.9, 0, 0);
    stone.scale.set(0.6, 1.8, 0.7);
    stone.rotation.z = side * 0.16;
    g.add(stone);
  }
  const swirl = new Group();
  swirl.position.set(0, 1.4, 0);
  for (let i = 0; i < 3; i++) {
    const torus = mesh(
      new TorusGeometry(0.7 + i * 0.12, 0.035, 4, 28),
      new MeshBasicMaterial({ color: i === 1 ? 0xb9a5ff : 0x7a5ecf, transparent: true, opacity: 0.85 - i * 0.18 }),
      0,
      0,
      0,
    );
    torus.rotation.set(0.2 + i * 0.4, i * 0.7, 0.4);
    torus.castShadow = false;
    swirl.add(torus);
  }
  g.add(swirl);
  const dark = new Mesh(new PlaneGeometry(1.2, 1.2), new MeshBasicMaterial({ color: 0x170d2b, transparent: true, opacity: 0.78 }));
  dark.position.set(0, 1.4, -0.02);
  g.add(dark);
  g.add(box(0.16, 1.8, 0.16, 0x6e5c8c, -1.05, 1.1, 0));
  g.add(box(0.16, 1.8, 0.16, 0x6e5c8c, 1.05, 1.1, 0));
  return { group: g, swirl };
}

export function makeShrineCore(): { group: Group; crystal: Group; halo: Group; ring1: Mesh; ring2: Mesh } {
  const g = new Group();
  g.add(cyl(2.0, 2.35, 0.32, 0x7f8174, 0, 0.16, 0, 12));
  g.add(cyl(1.6, 1.85, 0.28, 0x939686, 0, 0.43, 0, 12));
  g.add(ring(1.55, 0xd8c58a, 0, 0.59, 0, 0.07, { emissive: 0x7d6a35, emissiveIntensity: 0.45 }));
  const runeMat = new MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.45, side: DoubleSide });
  const ring1 = mesh(new TorusGeometry(1.2, 0.035, 4, 30), runeMat, 0, 0.62, 0);
  ring1.rotation.x = Math.PI / 2;
  ring1.castShadow = false;
  g.add(ring1);
  const ring2 = mesh(new TorusGeometry(0.9, 0.02, 4, 30), runeMat.clone(), 0, 0.62, 0);
  ring2.rotation.x = Math.PI / 2;
  ring2.castShadow = false;
  g.add(ring2);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const stone = box(0.3, 1.35, 0.3, 0x8b8d7e, Math.cos(a) * 1.35, 0.95, Math.sin(a) * 1.35);
    stone.rotation.y = a;
    g.add(stone);
    const tip = ico(0.12, 0x9d7bff, Math.cos(a) * 1.35, 1.68, Math.sin(a) * 1.35, 0, {
      emissive: 0x7a5ecf,
      emissiveIntensity: 1,
    });
    tip.castShadow = false;
    g.add(tip);
  }
  const crystal = makeCrystal(0.42, 0x8deee0, 0x74e3d8);
  crystal.position.y = 1.05;
  g.add(crystal);
  const halo = new Group();
  halo.position.y = 1.5;
  const h1 = mesh(
    new TorusGeometry(0.78, 0.03, 4, 36),
    new MeshBasicMaterial({ color: 0x8deee0, transparent: true, opacity: 0.65 }),
    0,
    0,
    0,
  );
  h1.rotation.x = Math.PI / 2.15;
  const h2 = mesh(
    new TorusGeometry(0.96, 0.022, 4, 36),
    new MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.45 }),
    0,
    0,
    0,
  );
  h2.rotation.set(Math.PI / 2.45, 0.4, 0.2);
  h1.castShadow = h2.castShadow = false;
  halo.add(h1, h2);
  g.add(halo);
  return { group: g, crystal, halo, ring1, ring2 };
}

export function makeLily(size: number): Group {
  const g = new Group();
  const pad = new Mesh(new RingGeometry(0.18 * size, 0.32 * size, 10, 1, 0.4), new MeshStandardMaterial({ color: 0x5f9b54, side: DoubleSide, roughness: 1 }));
  pad.rotation.x = -Math.PI / 2;
  g.add(pad);
  return g;
}

/* ───────────────────────────── player ───────────────────────────── */

export interface FarmerRig {
  group: Group;
  legs: [Group, Group];
  arms: [Group, Group];
  torso: Group;
  head: Group;
}

/**
 * Low-poly farmer used by the first-person character controller. The model
 * faces -Z so `rotation.y = yaw` matches the camera forward vector.
 */
export function makeFarmer(): FarmerRig {
  const group = new Group();
  const skin = 0xd9a878;
  const shirt = 0xe8ddc2;
  const overalls = 0x466b8c;
  const boots = 0x5a4632;
  const straw = 0xd9b45e;

  const legs: [Group, Group] = [new Group(), new Group()];
  for (let i = 0; i < 2; i++) {
    const hip = legs[i];
    hip.position.set(i === 0 ? -0.145 : 0.145, 0.86, 0);
    hip.add(box(0.2, 0.8, 0.22, overalls, 0, -0.4, 0));
    hip.add(box(0.22, 0.15, 0.3, boots, 0, -0.79, -0.03));
    group.add(hip);
  }

  const torso = new Group();
  torso.position.y = 0;
  group.add(torso);
  torso.add(box(0.5, 0.56, 0.32, overalls, 0, 1.16, 0));
  torso.add(box(0.54, 0.24, 0.34, shirt, 0, 1.5, 0));
  torso.add(box(0.12, 0.36, 0.02, shirt, -0.16, 1.34, -0.17));
  torso.add(box(0.12, 0.36, 0.02, shirt, 0.16, 1.34, -0.17));
  torso.add(box(0.5, 0.08, 0.36, 0x7a5c3c, 0, 0.9, 0));

  const arms: [Group, Group] = [new Group(), new Group()];
  for (let i = 0; i < 2; i++) {
    const shoulder = arms[i];
    shoulder.position.set(i === 0 ? -0.33 : 0.33, 1.46, 0);
    shoulder.add(box(0.14, 0.34, 0.18, shirt, 0, -0.17, 0));
    shoulder.add(box(0.12, 0.28, 0.16, skin, 0, -0.46, 0));
    torso.add(shoulder);
  }

  const head = new Group();
  head.position.y = 1.66;
  torso.add(head);
  head.add(sphere(0.18, skin, 0, 0, 0, 7));
  head.add(box(0.28, 0.14, 0.04, 0x5a3f2a, 0, 0.08, 0.14));
  // Eyes sit on the -Z face, the same direction the character walks.
  head.add(box(0.045, 0.05, 0.03, 0x2c231c, -0.07, 0.03, -0.17));
  head.add(box(0.045, 0.05, 0.03, 0x2c231c, 0.07, 0.03, -0.17));
  head.add(box(0.07, 0.06, 0.05, 0xc98e64, 0, -0.04, -0.18));
  head.add(cyl(0.38, 0.42, 0.055, straw, 0, 0.19, 0, 9));
  head.add(cyl(0.19, 0.23, 0.22, straw, 0, 0.3, 0, 9));
  head.add(cyl(0.205, 0.235, 0.06, 0x6d8b4f, 0, 0.22, 0, 9));

  return { group, legs, arms, torso, head };
}

/** A first-person farming hoe, held at the lower-right of the view. */
export function makeHeldHoe(): Group {
  const g = new Group();
  g.add(cyl(0.028, 0.034, 0.92, 0x8a6138, 0, 0.46, 0, 5));
  g.add(cyl(0.036, 0.036, 0.07, 0x5e432b, 0, 0.04, 0, 5));
  const blade = box(0.26, 0.045, 0.16, 0x9aa3a8, 0, 0.01, -0.08);
  blade.rotation.x = 0.24;
  g.add(blade);
  // A gloved hand gripping the shaft, so the tool reads as held.
  g.add(sphere(0.07, 0x8a5a3c, 0.01, 0.5, 0.02, 5));
  g.add(box(0.1, 0.16, 0.11, 0x8a5a3c, 0, 0.44, 0.02));
  g.traverse((child) => {
    child.castShadow = false;
    child.receiveShadow = false;
  });
  return g;
}
