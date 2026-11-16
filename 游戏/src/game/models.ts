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
import type { CropId, EnemyId, GuardianId, TowerId } from './types';
import { CROPS, GUARDIANS, TOWERS } from './config';
import { collapseGroup } from './batch';
import type { ArtProvider, CropArt, EnemyArt, GuardianArt, TowerArt } from './art';

/**
 * 《穗守》v3 art direction — Chinese pastoral white-box.
 *
 * Everything here is flat-shaded, untextured geometry with a deliberately tiny
 * palette: rice-paper white for the placeholder massing, ink grey for roofs and
 * timber, warm earth for soil and straw, pale jade for vegetation and a single
 * vermilion accent for gameplay-critical markings. No external GLB is needed.
 * Each distinct placeholder is documented with a Blender MCP prompt in
 * `docs/whitebox-blender-prompts.md` and listed in `whitebox-assets.json`.
 */
const C = {
  paper: 0xf2efe6,
  paperShade: 0xe4ddd0,
  paperDeep: 0xd4cbbb,
  ink: 0x4b514c,
  inkSoft: 0x767d75,
  inkPale: 0x9aa096,
  earth: 0xb09571,
  earthDark: 0x8d7557,
  straw: 0xcbb283,
  strawDark: 0xa99060,
  jade: 0x8d9f87,
  jadeDark: 0x6f806c,
  water: 0xa3b6ad,
  vermilion: 0xa84b38,
  glow: 0xe6d6a4,
  moon: 0xd9e0da,
} as const;

const materials = new Map<string, MeshStandardMaterial>();

function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; emissiveIntensity?: number; flat?: boolean } = {}) {
  const key = `${color}-${opts.rough ?? 1}-${opts.metal ?? 0}-${opts.emissive ?? -1}-${opts.emissiveIntensity ?? 0}-${opts.flat ?? true}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.96,
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

/** A tiled Chinese gable roof, ridge running along X. */
function gableRoof(width: number, depth: number, rise: number, color: number, y = 0, x = 0, z = 0): Group {
  const roof = new Group();
  roof.position.set(x, y, z);
  const slope = Math.hypot(depth / 2, rise);
  const angle = Math.atan2(rise, depth / 2);
  for (const side of [-1, 1]) {
    const panel = box(width, 0.1, slope, color, 0, rise / 2, (side * depth) / 4);
    panel.rotation.x = side * angle;
    roof.add(panel);
    // Upturned eave tips read as Chinese tile roofs even in white-box.
    for (const sign of [-1, 1]) {
      const tip = box(0.16, 0.28, 0.16, color, (sign * width) / 2 - sign * 0.12, 0.2, (side * depth) / 2);
      tip.rotation.z = sign * 0.4;
      tip.rotation.x = -side * 0.2;
      roof.add(tip);
    }
  }
  roof.add(box(width + 0.12, 0.16, 0.18, C.inkSoft, 0, rise + 0.06, 0));
  return roof;
}

/** Low whitewashed courtyard wall with an ink tile cap. */
function courtyardWall(length: number, height: number, alongX = true): Group {
  const g = new Group();
  const w = alongX ? length : 0.2;
  const d = alongX ? 0.2 : length;
  g.add(box(w, height, d, C.paper, 0, height / 2, 0));
  g.add(box(w + 0.12, 0.1, d + 0.12, C.inkSoft, 0, height + 0.04, 0));
  for (let i = 0; i < Math.floor(length / 0.8); i++) {
    const offset = -length / 2 + 0.4 + i * 0.8;
    const post = box(0.08, height, 0.08, C.inkPale, alongX ? offset : 0, height / 2, alongX ? 0 : offset);
    g.add(post);
  }
  return g;
}

function addLevelPips(group: Group, level: number, color = C.glow) {
  for (let i = 0; i < level; i++) {
    const pip = sphere(0.075, color, (i - (level - 1) / 2) * 0.24, 0.07, 0.55, 5, {
      emissive: color,
      emissiveIntensity: 0.35,
    });
    pip.castShadow = false;
    group.add(pip);
  }
}

/* ───────────────────────────── crops ─────────────────────────────
 * One placeholder per crop (mature silhouette). The game scales the same
 * model through the four growth stages, so the prompt document has exactly one
 * row per crop instead of twelve stage variants. */

function buildRice(): Group {
  const g = new Group();
  const stalkCount = 11;
  for (let i = 0; i < stalkCount; i++) {
    const a = (i / stalkCount) * Math.PI * 2 + 0.4;
    const radius = 0.1 + (i % 3) * 0.08;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const h = 0.72 + (i % 4) * 0.09;
    const stalk = cyl(0.012, 0.018, h, C.jade, x, h / 2, z, 4);
    g.add(stalk);
    const head = cone(0.055, 0.3, C.straw, x, h + 0.1, z, 5);
    head.rotation.x = Math.cos(a) * 0.28;
    head.rotation.z = -Math.sin(a) * 0.28;
    g.add(head);
    const awn = box(0.018, 0.13, 0.018, C.strawDark, x, h + 0.3, z);
    awn.rotation.x = Math.cos(a) * 0.3;
    g.add(awn);
    const leaf = cone(0.05, 0.34, C.jadeDark, x * 1.2, h * 0.55, z * 1.2, 4);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = -Math.sin(a) * 0.5;
    g.add(leaf);
  }
  g.add(cyl(0.24, 0.3, 0.08, C.earthDark, 0, 0.04, 0, 8));
  return g;
}

function buildGourd(): Group {
  const g = new Group();
  const vine = cyl(0.02, 0.03, 0.72, C.jade, 0, 0.36, 0, 5);
  g.add(vine);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = sphere(0.16, C.jadeDark, Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3, 5);
    leaf.scale.set(1.45, 0.28, 1.1);
    leaf.rotation.y = a;
    g.add(leaf);
  }
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -0.2 : 0.22;
    const z = i === 0 ? 0.14 : -0.16;
    const size = i === 0 ? 0.27 : 0.21;
    const fruit = sphere(size, C.paperShade, x, size * 0.78, z, 9);
    fruit.scale.y = 0.82;
    g.add(fruit);
    for (let rib = 0; rib < 5; rib++) {
      const angle = (rib / 5) * Math.PI * 2;
      const ridge = box(0.018, size * 1.55, 0.018, C.inkPale, x + Math.cos(angle) * size * 0.5, size * 0.78, z + Math.sin(angle) * size * 0.5);
      ridge.rotation.y = -angle;
      g.add(ridge);
    }
    g.add(cyl(0.035, 0.05, 0.16, C.jadeDark, x, size * 1.5, z, 5));
  }
  g.add(cone(0.07, 0.16, C.glow, 0.34, 0.5, -0.22, 5, { emissive: C.glow, emissiveIntensity: 0.2 }));
  return g;
}

function buildStarflower(): Group {
  const g = new Group();
  const scale = 1;
  g.add(cyl(0.022, 0.032, 0.86 * scale, C.jade, 0, 0.43 * scale, 0, 5));
  for (let i = 0; i < 4; i++) {
    const leaf = cone(0.07, 0.34, C.jadeDark, Math.cos(i * 1.9) * 0.14, 0.3 * scale, Math.sin(i * 1.9) * 0.14, 4);
    leaf.rotation.z = 0.8 - i * 0.18;
    leaf.rotation.y = i * 1.9;
    g.add(leaf);
  }
  const petals = 7;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const petal = cone(0.075, 0.34, C.paper, Math.cos(a) * 0.15, 0.95 * scale, Math.sin(a) * 0.15, 4);
    petal.rotation.z = Math.cos(a) * 0.95;
    petal.rotation.x = -Math.sin(a) * 0.95;
    g.add(petal);
  }
  g.add(ico(0.11, C.glow, 0, 0.95 * scale, 0, 0, { emissive: C.glow, emissiveIntensity: 0.75 }));
  const halo = new Mesh(
    new RingGeometry(0.2, 0.25, 20),
    new MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.6, side: DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 1.22;
  g.add(halo);
  return g;
}

function cropModel(type: CropId): Group {
  const group = type === 'wheat' ? buildRice() : type === 'pumpkin' ? buildGourd() : buildStarflower();
  group.name = `crop_${type}`;
  return group;
}

/* ───────────────────────────── towers ───────────────────────────── */

function buildBambooTower(level: number): TowerArt {
  const g = new Group();
  const scale = 1 + (level - 1) * 0.1;
  g.add(cyl(1.0, 1.16, 0.22, C.paperDeep, 0, 0.11, 0, 8));
  g.add(cyl(0.74, 0.9, 0.13, C.paperShade, 0, 0.28, 0, 8));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.54;
    const z = Math.sin(a) * 0.54;
    const leg = cyl(0.075, 0.095, 2.1 * scale, C.jadeDark, x, 1.3, z, 5);
    leg.rotation.z = x * 0.05;
    leg.rotation.x = -z * 0.05;
    g.add(leg);
  }
  g.add(box(1.36 * scale, 0.16, 1.36 * scale, C.earth, 0, 2.36 * scale, 0));
  for (const [x, z] of [
    [0, 0.68],
    [0, -0.68],
    [0.68, 0],
    [-0.68, 0],
  ]) {
    g.add(box(x === 0 ? 1.36 : 0.08, 0.4, z === 0 ? 1.36 : 0.08, C.jadeDark, x, 2.62 * scale, z));
  }
  g.add(box(0.82, 0.75, 0.78, C.paper, 0, 2.92 * scale, 0));
  g.add(box(0.9, 0.1, 0.86, C.inkSoft, 0, 3.32 * scale, 0));
  const roof = gableRoof(1.5, 1.2, 0.55, C.ink, 3.4 * scale, 0, 0);
  roof.scale.setScalar(scale);
  g.add(roof);
  const banner = new Group();
  banner.position.set(0.7 * scale, 2.84 * scale, 0.2);
  banner.add(box(0.05, 0.72, 0.05, C.ink, 0, 0, 0));
  const cloth = new Mesh(new PlaneGeometry(0.34, 0.26), new MeshStandardMaterial({ color: C.vermilion, side: DoubleSide, roughness: 1 }));
  cloth.position.set(0.17, 0.18, 0);
  cloth.castShadow = true;
  banner.add(cloth);
  g.add(banner);
  const spin = new Group();
  spin.name = 'tower-spin';
  spin.position.set(0, 3.45 * scale, 0.34);
  const vane = new Mesh(new PlaneGeometry(0.32, 0.14), new MeshStandardMaterial({ color: C.paperDeep, side: DoubleSide, roughness: 1 }));
  vane.position.x = 0.14;
  spin.add(vane);
  g.add(spin);
  const orb = ico(0.1, C.glow, 0, 3.6 * scale, 0.3, 0, { emissive: C.glow, emissiveIntensity: 0.75 });
  orb.name = 'tower-orb';
  orb.castShadow = false;
  g.add(orb);
  addLevelPips(g, level);
  return { group: g, spin, orb };
}

function buildStoneMortar(level: number): TowerArt {
  const g = new Group();
  const scale = 1 + (level - 1) * 0.08;
  g.add(cyl(1.08, 1.28, 0.28, C.paperDeep, 0, 0.14, 0, 8));
  g.add(cyl(0.86, 0.98, 0.16, C.paperShade, 0, 0.34, 0, 8));
  g.add(box(1.24 * scale, 1.05, 1.24 * scale, C.paper, 0, 0.98 * scale, 0));
  g.add(box(1.32 * scale, 0.14, 1.32 * scale, C.inkSoft, 0, 1.54 * scale, 0));
  for (const [x, z] of [
    [0, 0.62],
    [0, -0.62],
    [0.62, 0],
    [-0.62, 0],
  ]) {
    g.add(box(x === 0 ? 1.3 : 0.07, 1.1, z === 0 ? 1.3 : 0.07, C.earthDark, x, 0.9, z));
  }
  const mortar = new Group();
  mortar.position.set(0, 1.66 * scale, 0.06);
  mortar.add(cyl(0.46, 0.34, 0.4, C.paperDeep, 0, 0.18, 0, 9));
  mortar.add(cyl(0.34, 0.34, 0.06, C.inkPale, 0, 0.4, 0, 9));
  const tube = cyl(0.16, 0.24, 0.95, C.inkSoft, 0, 0.32, 0.38, 7);
  tube.rotation.x = Math.PI / 2 - 0.22;
  mortar.add(tube);
  mortar.add(sphere(0.15, C.glow, 0, 0.32, 0.84, 6, { emissive: C.glow, emissiveIntensity: 0.7 }));
  g.add(mortar);
  const roof = gableRoof(1.38, 1.3, 0.6, C.ink, 2.0 * scale, 0, -0.1);
  roof.scale.setScalar(scale);
  g.add(roof);
  g.add(cone(0.1, 0.34, C.strawDark, 0.9 * scale, 2.42 * scale, -0.6, 5));
  const spin = new Group();
  spin.name = 'tower-spin';
  spin.position.set(0, 2.02 * scale, 0.55);
  const flag = new Mesh(new PlaneGeometry(0.34, 0.2), new MeshStandardMaterial({ color: C.vermilion, side: DoubleSide, roughness: 1 }));
  flag.position.set(0.18, 0.14, 0);
  spin.add(flag);
  g.add(spin);
  const orb = ico(0.11, C.glow, -0.48, 1.95 * scale, 0.28, 0, { emissive: C.glow, emissiveIntensity: 0.6 });
  orb.name = 'tower-orb';
  orb.castShadow = false;
  g.add(orb);
  addLevelPips(g, level);
  return { group: g, spin, orb };
}

function buildVillageShrine(level: number): TowerArt {
  const g = new Group();
  const scale = 1 + (level - 1) * 0.09;
  g.add(cyl(1.04, 1.26, 0.24, C.paperDeep, 0, 0.12, 0, 10));
  g.add(cyl(0.9, 1.04, 0.18, C.paper, 0, 0.33, 0, 10));
  g.add(ring(0.88, C.glow, 0, 0.44, 0, 0.05, { emissive: C.glow, emissiveIntensity: 0.25 }));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const pillar = cyl(0.085, 0.11, 1.7 * scale, C.paper, Math.cos(a) * 0.6, 1.12, Math.sin(a) * 0.6, 5);
    g.add(pillar);
    const cap = ico(0.1, C.jade, Math.cos(a) * 0.6, 1.98 * scale, Math.sin(a) * 0.6, 0, { emissive: C.jadeDark, emissiveIntensity: 0.2 });
    cap.castShadow = false;
    g.add(cap);
  }
  g.add(box(0.5 * scale, 1.7 * scale, 0.5 * scale, C.paperShade, 0, 1.15, 0));
  g.add(box(0.62 * scale, 0.16, 0.62 * scale, C.inkSoft, 0, 2.04 * scale, 0));
  g.add(box(0.42 * scale, 0.5 * scale, 0.42 * scale, C.paper, 0, 2.4 * scale, 0));
  const roof = gableRoof(1.48, 1.22, 0.5, C.ink, 2.62 * scale, 0, 0);
  roof.scale.setScalar(scale);
  g.add(roof);
  const grain = new Group();
  grain.name = 'shrine-grain';
  grain.position.set(0, 2.62 * scale, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const stalk = cyl(0.012, 0.016, 0.55, C.jade, Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.14, 4);
    grain.add(stalk);
    const head = cone(0.045, 0.22, C.straw, Math.cos(a) * 0.14, 0.58, Math.sin(a) * 0.14, 4);
    grain.add(head);
  }
  grain.add(ico(0.12, C.glow, 0, 0.2, 0, 0, { emissive: C.glow, emissiveIntensity: 0.6 }));
  g.add(grain);
  const halo = new Group();
  halo.name = 'tower-spin';
  halo.position.y = 2.78 * scale;
  const h1 = mesh(new TorusGeometry(0.52, 0.022, 4, 30), mat(C.glow, { emissive: C.glow, emissiveIntensity: 0.55, rough: 0.3 }), 0, 0, 0);
  h1.rotation.x = Math.PI / 2;
  const h2 = mesh(new TorusGeometry(0.66, 0.016, 4, 30), mat(C.paper, { emissive: C.paper, emissiveIntensity: 0.3, rough: 0.3 }), 0, 0, 0);
  h2.rotation.set(Math.PI / 2.3, 0.4, 0);
  h1.castShadow = h2.castShadow = false;
  halo.add(h1, h2);
  g.add(halo);
  const orb = ico(0.14, C.glow, 0, 3.18 * scale, 0, 0, { emissive: C.glow, emissiveIntensity: 0.95 });
  orb.name = 'tower-orb';
  orb.castShadow = false;
  g.add(orb);
  addLevelPips(g, level);
  return { group: g, spin: halo, orb };
}

function buildTowerModel(type: TowerId, level: number): TowerArt {
  const art = type === 'arrow' ? buildBambooTower(level) : type === 'cannon' ? buildStoneMortar(level) : buildVillageShrine(level);
  art.group.name = `tower_${type}_${level}`;
  return art;
}

/* ───────────────────────────── guardians ───────────────────────────── */

function farmerBody(opts: { robe?: number; hat?: boolean; scale?: number } = {}): Group {
  const g = new Group();
  const s = opts.scale ?? 1;
  const robe = opts.robe ?? C.paper;
  for (const side of [-1, 1]) {
    g.add(box(0.13 * s, 0.55 * s, 0.16 * s, C.inkSoft, side * 0.13 * s, 0.3 * s, 0));
    g.add(box(0.16 * s, 0.1 * s, 0.24 * s, C.ink, side * 0.13 * s, 0.05 * s, 0.03 * s));
  }
  g.add(cyl(0.2 * s, 0.3 * s, 0.72 * s, robe, 0, 0.85 * s, 0, 7));
  g.add(box(0.36 * s, 0.1 * s, 0.26 * s, C.inkSoft, 0, 1.18 * s, 0));
  for (const side of [-1, 1]) {
    const arm = new Group();
    arm.position.set(side * 0.25 * s, 1.16 * s, 0);
    arm.add(box(0.1 * s, 0.42 * s, 0.12 * s, robe, 0, -0.2 * s, 0));
    arm.add(sphere(0.065 * s, C.earth, 0, -0.44 * s, 0, 5));
    arm.rotation.z = side * 0.12;
    g.add(arm);
  }
  const head = new Group();
  head.position.y = 1.42 * s;
  head.add(sphere(0.17 * s, C.earth, 0, 0, 0, 7));
  head.add(box(0.04 * s, 0.04 * s, 0.03 * s, C.ink, -0.06 * s, 0.02 * s, 0.16 * s));
  head.add(box(0.04 * s, 0.04 * s, 0.03 * s, C.ink, 0.06 * s, 0.02 * s, 0.16 * s));
  if (opts.hat !== false) {
    head.add(cyl(0.34 * s, 0.38 * s, 0.05 * s, C.straw, 0, 0.16 * s, 0, 9));
    head.add(cyl(0.15 * s, 0.2 * s, 0.17 * s, C.straw, 0, 0.27 * s, 0, 9));
  }
  g.add(head);
  return g;
}

function buildBowman(): Group {
  const g = farmerBody();
  const bow = mesh(new TorusGeometry(0.42, 0.024, 4, 14, Math.PI * 1.15), mat(C.earthDark), 0.38, 0.92, 0.12);
  bow.rotation.z = Math.PI / 2;
  bow.rotation.y = 0.2;
  g.add(bow);
  g.add(box(0.02, 0.82, 0.02, C.ink, 0.38, 0.92, 0.12));
  for (let i = 0; i < 3; i++) {
    const arrow = cyl(0.01, 0.01, 0.5, C.paperDeep, 0.25 - i * 0.08, 1.0, -0.22, 3);
    arrow.rotation.z = 0.55;
    g.add(arrow);
  }
  return g;
}

function buildHoeman(): Group {
  const g = farmerBody({ robe: C.paperShade });
  const shaft = cyl(0.026, 0.03, 0.92, C.earthDark, 0.3, 0.88, 0.08, 5);
  shaft.rotation.z = 0.55;
  g.add(shaft);
  const blade = box(0.3, 0.06, 0.11, C.inkPale, 0.55, 0.47, 0.08);
  blade.rotation.z = 0.55;
  g.add(blade);
  return g;
}

function buildFieldhand(): Group {
  const g = farmerBody({ robe: C.paperShade });
  const rake = cyl(0.024, 0.028, 0.9, C.earthDark, 0.3, 0.9, 0.06, 5);
  rake.rotation.z = 0.5;
  g.add(rake);
  const head = box(0.34, 0.05, 0.08, C.inkSoft, 0.52, 0.5, 0.06);
  head.rotation.z = 0.5;
  g.add(head);
  for (let i = 0; i < 4; i++) {
    const tooth = box(0.03, 0.17, 0.03, C.inkSoft, 0.4 + i * 0.08, 0.42, 0.06);
    tooth.rotation.z = 0.5;
    g.add(tooth);
  }
  g.add(sphere(0.02, C.jade, -0.2, 1.1, 0.18, 4));
  g.add(cyl(0.16, 0.13, 0.2, C.straw, -0.3, 0.75, -0.2, 7));
  for (let i = 0; i < 4; i++) {
    const seedling = cone(0.03, 0.28, C.jade, -0.38 + i * 0.04, 0.95, -0.24 + (i % 2) * 0.05, 4);
    seedling.rotation.z = 0.2 - i * 0.1;
    g.add(seedling);
  }
  return g;
}

function buildHerbalist(): Group {
  const g = farmerBody({ robe: C.paper });
  const basket = cyl(0.16, 0.2, 0.26, C.straw, -0.34, 0.82, -0.2, 7);
  g.add(basket);
  g.add(box(0.04, 0.72, 0.04, C.earthDark, -0.3, 1.12, -0.24));
  for (let i = 0; i < 5; i++) {
    const herb = cone(0.04, 0.34, i % 2 ? C.jade : C.jadeDark, -0.36 + i * 0.03, 1.24, -0.22, 4);
    herb.rotation.z = (i - 2) * 0.14;
    g.add(herb);
  }
  g.add(sphere(0.09, C.paperDeep, 0.3, 0.82, 0.18, 6));
  g.add(cyl(0.035, 0.05, 0.1, C.strawDark, 0.3, 0.94, 0.18, 5));
  return g;
}

function buildMason(): Group {
  const g = farmerBody({ robe: C.paperShade });
  const mallet = new Group();
  mallet.position.set(0.36, 0.9, 0.08);
  mallet.add(cyl(0.025, 0.03, 0.5, C.earthDark, 0, 0, 0, 5));
  mallet.add(box(0.26, 0.13, 0.13, C.inkSoft, 0, 0.28, 0));
  g.add(mallet);
  const chisel = cyl(0.018, 0.012, 0.22, C.inkPale, -0.34, 0.86, 0.12, 4);
  chisel.rotation.z = -0.4;
  g.add(chisel);
  g.add(box(0.24, 0.18, 0.24, C.paperDeep, 0.05, 0.11, 0.32));
  g.add(box(0.16, 0.12, 0.16, C.paper, 0.05, 0.26, 0.32));
  return g;
}

function buildRicespirit(): Group {
  const g = new Group();
  g.add(cyl(0.22, 0.34, 0.82, C.paper, 0, 0.62, 0, 7));
  const skirt = cone(0.46, 0.55, C.paperShade, 0, 0.28, 0, 8);
  skirt.scale.y = 0.7;
  g.add(skirt);
  for (const side of [-1, 1]) {
    const sleeve = cyl(0.06, 0.1, 0.5, C.paper, side * 0.28, 0.78, 0, 5);
    sleeve.rotation.z = side * 0.5;
    g.add(sleeve);
  }
  const head = new Group();
  head.position.y = 1.18;
  head.add(sphere(0.15, C.paper, 0, 0, 0, 7));
  head.add(box(0.035, 0.035, 0.03, C.ink, -0.05, 0.02, 0.14));
  head.add(box(0.035, 0.035, 0.03, C.ink, 0.05, 0.02, 0.14));
  g.add(head);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const stalk = cyl(0.01, 0.014, 0.48, C.jade, Math.cos(a) * 0.18, 1.38, Math.sin(a) * 0.18, 4);
    g.add(stalk);
    const headGrain = cone(0.04, 0.2, C.straw, Math.cos(a) * 0.18, 1.66, Math.sin(a) * 0.18, 4);
    g.add(headGrain);
  }
  const halo = new Group();
  halo.position.y = 1.1;
  const h = mesh(new TorusGeometry(0.46, 0.018, 4, 30), mat(C.glow, { emissive: C.glow, emissiveIntensity: 0.5, rough: 0.3 }), 0, 0, 0);
  h.rotation.x = Math.PI / 2;
  h.castShadow = false;
  halo.add(h);
  g.add(halo);
  g.userData.float = true;
  return g;
}

function buildGuardianModel(type: GuardianId, level: number): GuardianArt {
  const base = type === 'bowman' ? buildBowman() : type === 'hoeman' ? buildHoeman() : type === 'fieldhand' ? buildFieldhand() : type === 'herbalist' ? buildHerbalist() : type === 'mason' ? buildMason() : buildRicespirit();
  const group = new Group();
  group.add(base);
  const scale = 1 + (level - 1) * 0.1;
  group.scale.setScalar(scale);
  const spin = new Group();
  spin.name = 'guard-spin';
  if (type === 'ricespirit') {
    const charm = mesh(new TorusGeometry(0.18, 0.012, 4, 18), mat(C.glow, { emissive: C.glow, emissiveIntensity: 0.6, rough: 0.3 }), 0, 1.55, 0.18);
    charm.rotation.x = Math.PI / 2;
    charm.castShadow = false;
    spin.add(charm);
    base.add(spin);
  }
  addLevelPips(group, level);
  group.name = `guard_${type}_${level}`;
  return { group, spin };
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
  tail?: 'bushy' | 'thin' | 'none';
  horns?: boolean;
  tusks?: boolean;
  antlers?: boolean;
  hump?: boolean;
}

function buildQuadruped(opts: QuadrupedOptions): EnemyArt {
  const group = new Group();
  const visual = new Group();
  visual.name = 'enemy-visual';
  group.add(visual);
  const s = opts.size;
  const body = sphere(0.34 * s, opts.body, 0, 0.48 * s, 0, 7);
  body.scale.set(1.05, 0.88, 1.72);
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
    const ear = cone(0.1 * s, opts.horns ? 0.24 * s : 0.34 * s, opts.body, side * 0.16 * s, 0.24 * s, -0.04 * s, 4);
    ear.rotation.z = side * 0.28;
    head.add(ear);
    if (opts.eye !== undefined) {
      const eye = sphere(0.038 * s, opts.eye, side * 0.1 * s, 0.06 * s, 0.2 * s, 4, {
        emissive: opts.eye,
        emissiveIntensity: 0.8,
      });
      eye.castShadow = false;
      head.add(eye);
    }
    if (opts.horns) {
      const horn = cone(0.055 * s, 0.36 * s, C.paperShade, side * 0.2 * s, 0.22 * s, 0.04 * s, 4);
      horn.rotation.z = side * 0.9;
      horn.rotation.x = -0.3;
      head.add(horn);
    }
    if (opts.tusks) {
      const tusk = cone(0.04 * s, 0.3 * s, C.paper, side * 0.13 * s, -0.14 * s, 0.32 * s, 4);
      tusk.rotation.x = -0.9;
      tusk.rotation.z = side * 0.2;
      head.add(tusk);
    }
    if (opts.antlers) {
      const antler = new Group();
      antler.position.set(side * 0.13 * s, 0.24 * s, 0.02 * s);
      const stem = cone(0.032 * s, 0.55 * s, C.paperDeep, 0, 0.22 * s, 0, 4);
      stem.rotation.z = side * 0.35;
      antler.add(stem);
      for (let b = 0; b < 3; b++) {
        const branch = cone(0.02 * s, 0.26 * s, C.paper, side * (0.06 + b * 0.05) * s, (0.36 + b * 0.11) * s, 0, 4);
        branch.rotation.z = side * (0.8 + b * 0.2);
        antler.add(branch);
      }
      head.add(antler);
    }
  }
  visual.add(head);
  if (opts.hump) {
    const hump = sphere(0.3 * s, opts.body, 0, 0.74 * s, -0.08 * s, 6);
    hump.scale.set(1.1, 0.7, 1.35);
    visual.add(hump);
  }
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
  if (opts.tail && opts.tail !== 'none') {
    const tail = new Group();
    tail.position.set(0, 0.52 * s, -0.57 * s);
    if (opts.tail === 'bushy') {
      const tuft = sphere(0.17 * s, opts.body, 0, -0.02 * s, -0.22 * s, 6);
      tuft.scale.set(0.8, 0.8, 1.45);
      tail.add(tuft);
      const tip = sphere(0.11 * s, opts.accent, 0, 0.01 * s, -0.42 * s, 5);
      tail.add(tip);
    } else {
      const t = cone(0.09 * s, 0.55 * s, opts.body, 0, -0.03 * s, -0.24 * s, 5);
      t.rotation.x = -1.15;
      tail.add(t);
    }
    visual.add(tail);
  }
  if (opts.boss) {
    const aura = mesh(
      new RingGeometry(0.5 * s, 0.65 * s, 24),
      new MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.55, side: DoubleSide }),
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

function enemyModel(type: EnemyId): EnemyArt {
  const art =
    type === 'fox'
      ? buildQuadruped({ body: C.paperShade, head: C.paper, legs: C.inkSoft, accent: C.straw, eye: C.vermilion, size: 1.0, tail: 'bushy' })
      : type === 'wolf'
        ? buildQuadruped({ body: C.inkPale, head: C.inkSoft, legs: C.ink, accent: C.paperShade, eye: C.glow, size: 1.2, tail: 'thin' })
        : type === 'bull'
          ? buildQuadruped({ body: C.inkSoft, head: C.ink, legs: C.ink, accent: C.paperDeep, eye: C.vermilion, size: 1.5, tail: 'thin', tusks: true, hump: true })
          : buildQuadruped({ body: C.paper, head: C.moon, legs: C.paperDeep, accent: C.glow, eye: C.glow, size: 1.8, boss: true, tail: 'thin', antlers: true });
  art.group.name = `enemy_${type}`;
  return art;
}

/* ───────────────────────────── public art provider ───────────────────────────── */

export class ProceduralArt implements ArtProvider {
  readonly kind = 'procedural' as const;
  private readonly cropTemplates = new Map<CropId, Group>();
  private readonly towerTemplates = new Map<string, TowerArt>();
  private readonly guardianTemplates = new Map<string, GuardianArt>();
  private readonly enemyTemplates = new Map<EnemyId, EnemyArt>();

  constructor() {
    for (const type of Object.keys(CROPS) as CropId[]) {
      const template = cropModel(type);
      collapseGroup(template);
      this.cropTemplates.set(type, template);
    }
    for (const type of Object.keys(TOWERS) as TowerId[]) {
      for (const level of [1, 2, 3] as const) {
        const art = buildTowerModel(type, level);
        collapseGroup(art.group, { keep: [art.spin, art.orb] });
        this.towerTemplates.set(`${type}:${level}`, art);
      }
    }
    for (const type of Object.keys(GUARDIANS) as GuardianId[]) {
      for (const level of [1, 2, 3] as const) {
        const art = buildGuardianModel(type, level);
        collapseGroup(art.group, { keep: [art.spin] });
        this.guardianTemplates.set(`${type}:${level}`, art);
      }
    }
    for (const type of ['fox', 'wolf', 'bull', 'stag'] as EnemyId[]) {
      const art = enemyModel(type);
      collapseGroup(art.visual);
      this.enemyTemplates.set(type, art);
    }
  }

  crop(type: CropId, stage: number, mature: boolean): CropArt {
    const template = this.cropTemplates.get(type);
    const group = new Group();
    if (template) group.add(template.clone(true));
    const scale = mature ? 1 : [0.28, 0.55, 0.8][Math.min(2, Math.max(0, stage))];
    group.scale.setScalar(scale);
    group.userData.cropType = type;
    const sway = new Group();
    sway.add(group);
    return { group: sway, sway };
  }

  tower(type: TowerId, level: 1 | 2 | 3): TowerArt {
    const template = this.towerTemplates.get(`${type}:${level}`)!;
    const group = template.group.clone(true);
    const spin = (group.getObjectByName('tower-spin') as Object3D | undefined) ?? new Group();
    const orb = (group.getObjectByName('tower-orb') as Mesh | undefined) ?? new Mesh(new IcosahedronGeometry(0.08, 0), mat(TOWERS[type].projectileColor));
    return { group, spin, orb };
  }

  guardian(type: GuardianId, level: 1 | 2 | 3): GuardianArt {
    const template = this.guardianTemplates.get(`${type}:${level}`)!;
    const group = template.group.clone(true);
    const spin = (group.getObjectByName('guard-spin') as Object3D | undefined) ?? new Group();
    return { group, spin };
  }

  enemy(type: EnemyId): EnemyArt {
    const template = this.enemyTemplates.get(type)!;
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

/* ───────────────────────────── environment ───────────────────────────── */

export function makePineTree(height: number, colorShift = 0): Group {
  const g = new Group();
  const trunk = cyl(0.14, 0.22, height * 0.42, C.earthDark, 0, height * 0.21, 0, 6);
  g.add(trunk);
  const tones = [C.jadeDark, C.jade, C.inkSoft];
  for (let i = 0; i < 4; i++) {
    const layer = cone(1.18 - i * 0.2, height * 0.3, tones[(i + colorShift) % tones.length], 0, height * (0.4 + i * 0.16), 0, 6);
    layer.rotation.y = i * 0.4;
    g.add(layer);
  }
  return g;
}

export function makeBambooGrove(height: number, count = 7): Group {
  const g = new Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 2) * 0.3;
    const r = 0.25 + (i % 3) * 0.18;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = height * (0.72 + (i % 4) * 0.09);
    const stalk = cyl(0.045, 0.06, h, C.jade, x, h / 2, z, 5);
    stalk.rotation.z = (i % 2 ? 1 : -1) * 0.035;
    g.add(stalk);
    for (let n = 1; n < 4; n++) {
      const node = cyl(0.055, 0.055, 0.035, C.jadeDark, x, (h * n) / 4, z, 5);
      g.add(node);
    }
    for (let leaf = 0; leaf < 4; leaf++) {
      const blade = cone(0.06, 0.36, leaf % 2 ? C.jadeDark : C.jade, x + Math.cos(a + leaf) * 0.2, h * (0.62 + leaf * 0.09), z + Math.sin(a + leaf) * 0.2, 3);
      blade.rotation.z = Math.cos(a + leaf) * 0.8;
      blade.rotation.x = -Math.sin(a + leaf) * 0.8;
      g.add(blade);
    }
  }
  return g;
}

export function makeRoundTree(height: number, colorShift = 0): Group {
  const g = new Group();
  g.add(cyl(0.14, 0.24, height * 0.52, C.earthDark, 0, height * 0.26, 0, 6));
  const tones = [C.jade, C.paperShade, C.jadeDark];
  const crown = ico(height * 0.3, tones[colorShift % tones.length], 0, height * 0.64, 0, 1);
  crown.scale.set(1, 0.82, 1);
  g.add(crown);
  const crown2 = ico(height * 0.2, tones[(colorShift + 1) % tones.length], height * 0.17, height * 0.76, -height * 0.08, 0);
  crown2.scale.set(1, 0.85, 1);
  g.add(crown2);
  return g;
}

export function makeRock(size: number, color: number = C.paperDeep): Mesh {
  const rock = ico(size, color, 0, size * 0.52, 0, 0);
  rock.scale.set(1.1, 0.72, 0.9);
  rock.rotation.set(0.2, Math.random() * Math.PI, 0.1);
  return rock;
}

export function makeGrassTuft(size: number, color: number = C.jade): Group {
  const g = new Group();
  for (let i = 0; i < 5; i++) {
    const blade = cone(size * 0.05, size * (0.5 + Math.random() * 0.5), color, (Math.random() - 0.5) * size * 0.4, size * 0.3, (Math.random() - 0.5) * size * 0.4, 3);
    blade.rotation.z = (Math.random() - 0.5) * 0.5;
    g.add(blade);
  }
  return g;
}

export function makeFlower(size: number, color: number = C.paper): Group {
  const g = new Group();
  g.add(cyl(0.012, 0.02, size * 0.9, C.jadeDark, 0, size * 0.45, 0, 4));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = cone(0.06, 0.22, color, Math.cos(a) * 0.06, size * 0.9, Math.sin(a) * 0.06, 4);
    petal.rotation.z = Math.cos(a) * 0.9;
    petal.rotation.x = -Math.sin(a) * 0.9;
    g.add(petal);
  }
  g.add(ico(size * 0.07, C.glow, 0, size * 0.92, 0, 0, { emissive: C.glow, emissiveIntensity: 0.3 }));
  return g;
}

/** Bamboo fence: the signature 竹篱 of the new art direction. */
export function makeFenceSegment(length: number): Group {
  const g = new Group();
  const posts = Math.max(2, Math.round(length / 0.9) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (i / (posts - 1)) * length;
    const post = cyl(0.05, 0.065, 1.02, C.jadeDark, x, 0.51, 0, 5);
    post.rotation.z = (i % 2 ? 1 : -1) * 0.02;
    g.add(post);
    const cap = cone(0.065, 0.1, C.jade, x, 1.06, 0, 5);
    g.add(cap);
  }
  for (const y of [0.34, 0.72]) {
    const rail = cyl(0.035, 0.035, length, C.strawDark, 0, y, 0.03, 5);
    rail.rotation.z = Math.PI / 2;
    g.add(rail);
  }
  for (let i = 0; i < posts - 1; i++) {
    const x = -length / 2 + ((i + 0.5) / (posts - 1)) * length;
    const tie = box(0.04, 0.4, 0.04, C.strawDark, x, 0.53, -0.02);
    tie.rotation.z = i % 2 ? 0.75 : -0.75;
    g.add(tie);
  }
  return g;
}

export function makePathStone(size: number): Mesh {
  const stone = cyl(size * 0.5, size * 0.56, 0.055, C.paperDeep, 0, 0.028, 0, 6);
  stone.receiveShadow = true;
  return stone;
}

/** 青瓦白墙民居: whitewashed hall + side wing + courtyard wall. */
export function makeHouse(): Group {
  const g = new Group();
  g.add(box(5.2, 0.18, 3.9, C.paperDeep, 0, 0.09, 0));
  g.add(box(4.3, 2.35, 3.1, C.paper, 0, 1.36, 0));
  for (const x of [-2.1, 0, 2.1]) {
    g.add(box(0.11, 2.35, 3.16, C.inkPale, x, 1.36, 0));
  }
  g.add(box(4.5, 0.16, 3.3, C.inkSoft, 0, 2.58, 0));
  g.add(gableRoof(5.0, 3.75, 1.0, C.ink, 2.56, 0, 0));
  g.add(box(0.9, 1.55, 0.08, C.ink, 0, 0.86, 1.58));
  for (const x of [-1.45, 1.45]) {
    g.add(box(0.86, 0.78, 0.08, C.paperShade, x, 1.62, 1.57));
    for (let i = 0; i < 3; i++) {
      g.add(box(0.04, 0.78, 0.06, C.inkPale, x - 0.3 + i * 0.3, 1.62, 1.6));
    }
    g.add(box(0.86, 0.04, 0.06, C.inkPale, x, 1.62, 1.6));
  }
  // Side wing.
  g.add(box(2.0, 1.8, 2.4, C.paper, -3.35, 1.0, 0.2));
  g.add(gableRoof(2.5, 2.75, 0.7, C.ink, 1.9, -3.35, 0.2));
  g.add(box(0.62, 1.15, 0.06, C.ink, -3.1, 0.66, 1.42));
  // Courtyard wall + gate.
  g.add(courtyardWall(5.0, 1.25, true).translateX(0).translateZ(2.8));
  const gate = makeFenceSegment(1.5);
  gate.position.set(1.6, 0, 3.0);
  g.add(gate);
  g.add(box(2.2, 0.16, 0.16, C.inkSoft, 1.6, 1.18, 2.95));
  // A little chimney and stacked firewood.
  g.add(box(0.42, 0.9, 0.42, C.inkSoft, 1.2, 3.35, -0.7));
  for (let i = 0; i < 3; i++) {
    const log = cyl(0.08, 0.08, 0.62, C.earthDark, -1.9 + i * 0.12, 0.2 + i * 0.13, 3.15, 5);
    log.rotation.z = Math.PI / 2;
    g.add(log);
  }
  return g;
}

/** 竹木水车: a working waterwheel with a bamboo flume. */
export function makeWindmill(): { group: Group; blades: Group } {
  const g = new Group();
  g.add(box(3.2, 0.2, 2.0, C.paperDeep, 0, 0.1, 0));
  for (const [x, z] of [
    [-1.2, -0.58],
    [-1.2, 0.58],
    [1.2, -0.58],
    [1.2, 0.58],
  ]) {
    g.add(box(0.12, 2.4, 0.12, C.earthDark, x, 1.3, z));
  }
  g.add(box(2.9, 0.16, 1.5, C.earth, 0, 2.52, 0));
  g.add(gableRoof(3.3, 2.2, 0.7, C.ink, 2.6, 0, 0));
  const blades = new Group();
  blades.name = 'waterwheel';
  blades.position.set(0.1, 1.45, 0.92);
  blades.rotation.y = Math.PI / 2;
  blades.add(cyl(0.09, 0.09, 0.24, C.earthDark, 0, 0, 0, 6));
  const wheel = new Group();
  for (const z of [-0.12, 0.12]) {
    const rim = mesh(new TorusGeometry(1.05, 0.045, 4, 24), mat(C.jadeDark), 0, 0, z);
    wheel.add(rim);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = box(0.06, 2.1, 0.06, C.earth, 0, 0, 0);
    spoke.rotation.z = a;
    wheel.add(spoke);
    const paddle = box(0.5, 0.14, 0.34, C.paperDeep, Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0);
    paddle.rotation.z = a;
    wheel.add(paddle);
  }
  blades.add(wheel);
  g.add(blades);
  const trough = box(0.5, 0.12, 2.4, C.strawDark, 0.1, 0.5, 0.9);
  trough.rotation.x = 0.22;
  g.add(trough);
  g.add(cyl(0.35, 0.42, 0.5, C.water, -1.55, 0.25, 0.9, 8));
  return { group: g, blades };
}

export function makeHaystack(): Group {
  const g = new Group();
  g.add(cyl(0.58, 0.72, 0.9, C.straw, 0, 0.45, 0, 8));
  g.add(cone(0.7, 0.6, C.strawDark, 0, 1.2, 0, 8));
  g.add(cyl(0.02, 0.03, 1.9, C.earthDark, 0, 1.0, 0, 4));
  for (const y of [0.35, 0.62, 0.88]) {
    const band = cyl(0.68 - y * 0.08, 0.7 - y * 0.08, 0.05, C.earthDark, 0, y, 0, 8);
    g.add(band);
  }
  return g;
}

/** 竹筐 */
export function makeCrate(): Group {
  const g = new Group();
  g.add(cyl(0.42, 0.32, 0.6, C.straw, 0, 0.3, 0, 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.03, 0.58, 0.03, C.strawDark, Math.cos(a) * 0.38, 0.3, Math.sin(a) * 0.38));
  }
  g.add(cyl(0.45, 0.45, 0.06, C.strawDark, 0, 0.58, 0, 8));
  g.add(cyl(0.45, 0.38, 0.08, C.strawDark, 0, 0.02, 0, 8));
  return g;
}

/** 陶瓮 */
export function makeBarrel(): Group {
  const g = new Group();
  const jar = sphere(0.4, C.paperDeep, 0, 0.42, 0, 8);
  jar.scale.set(1, 1.15, 1);
  g.add(jar);
  g.add(cyl(0.24, 0.28, 0.12, C.paperShade, 0, 0.86, 0, 8));
  g.add(cyl(0.26, 0.26, 0.05, C.inkPale, 0, 0.93, 0, 8));
  return g;
}

/** 青石井 */
export function makeWell(): Group {
  const g = new Group();
  g.add(cyl(0.72, 0.8, 0.85, C.paperDeep, 0, 0.42, 0, 9));
  g.add(cyl(0.54, 0.54, 0.1, C.inkPale, 0, 0.88, 0, 9));
  for (const x of [-0.52, 0.52]) {
    g.add(box(0.11, 1.15, 0.11, C.earthDark, x, 1.35, 0));
  }
  g.add(box(1.28, 0.1, 0.1, C.earthDark, 0, 1.92, 0));
  g.add(gableRoof(1.5, 1.3, 0.42, C.ink, 1.92, 0, 0));
  g.add(cyl(0.12, 0.15, 0.28, C.paperShade, 0, 1.45, 0.1, 6));
  const rope = cyl(0.015, 0.015, 0.5, C.ink, 0, 1.7, 0.1, 3);
  g.add(rope);
  return g;
}

/** 乡集茶棚 */
export function makeMarket(): Group {
  const g = new Group();
  g.add(box(2.1, 0.16, 1.3, C.earth, 0, 0.08, 0));
  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.5, 0.5]) {
      g.add(cyl(0.05, 0.07, 1.8, C.jadeDark, x, 0.9, z, 5));
    }
  }
  const awning = cone(2.2, 1.0, C.straw, 0, 2.1, 0, 4);
  awning.rotation.y = Math.PI / 4;
  awning.scale.set(1, 1, 0.75);
  g.add(awning);
  for (let i = 0; i < 3; i++) {
    g.add(cyl(0.12, 0.16, 0.28, C.paperDeep, -0.55 + i * 0.45, 0.36, 0.28, 7));
    g.add(cyl(0.14, 0.14, 0.05, C.strawDark, -0.55 + i * 0.45, 0.5, 0.28, 7));
  }
  g.add(box(0.06, 1.2, 0.06, C.earthDark, -0.85, 1.5, 0.55));
  const cloth = new Mesh(new PlaneGeometry(0.36, 0.5), new MeshStandardMaterial({ color: C.vermilion, side: DoubleSide, roughness: 1 }));
  cloth.position.set(-0.66, 1.62, 0.55);
  g.add(cloth);
  return g;
}

/** 田棚: a small straw lean-to. */
export function makeTent(): Group {
  const g = new Group();
  for (const [x, z] of [
    [-0.7, -0.6],
    [0.7, -0.6],
  ]) {
    g.add(cyl(0.05, 0.07, 1.6, C.earthDark, x, 0.8, z, 5));
  }
  const roof = box(1.8, 0.1, 2.0, C.straw, 0, 1.45, 0.15);
  roof.rotation.x = -0.32;
  g.add(roof);
  const back = box(1.7, 1.1, 0.08, C.paperShade, 0, 0.6, -0.85);
  g.add(back);
  g.add(box(0.55, 0.08, 0.55, C.earth, 0.25, 0.45, 0.15));
  g.add(box(0.08, 0.4, 0.08, C.earthDark, 0.25, 0.2, 0.15));
  g.add(box(0.4, 0.42, 0.4, C.straw, -0.45, 0.2, 0.25));
  return g;
}

/** 土地庙 / 石灯, used for both the statue and obelisk slots. */
export function makeStatue(): Group {
  const g = new Group();
  g.add(cyl(0.5, 0.62, 0.22, C.paperDeep, 0, 0.11, 0, 8));
  g.add(box(0.3, 1.1, 0.3, C.paper, 0, 0.77, 0));
  g.add(box(0.46, 0.36, 0.46, C.paperShade, 0, 1.48, 0));
  g.add(box(0.52, 0.08, 0.52, C.inkSoft, 0, 1.7, 0));
  g.add(cone(0.5, 0.38, C.ink, 0, 1.93, 0, 4));
  g.add(ico(0.09, C.glow, 0, 1.44, 0.25, 0, { emissive: C.glow, emissiveIntensity: 0.35 }));
  return g;
}

/** 兽径柴门: the beast path starts under a bamboo gate hung with charms. */
export function makePortal(): { group: Group; swirl: Group } {
  const g = new Group();
  g.add(cyl(1.5, 1.85, 0.22, C.paperDeep, 0, 0.11, 0, 9));
  for (const side of [-1, 1]) {
    const post = cyl(0.1, 0.14, 2.7, C.earthDark, side * 0.95, 1.35, 0, 5);
    g.add(post);
    g.add(cyl(0.16, 0.2, 0.16, C.paper, side * 0.95, 2.74, 0, 5));
  }
  g.add(box(2.35, 0.16, 0.16, C.earthDark, 0, 2.62, 0));
  g.add(box(2.55, 0.12, 0.2, C.inkSoft, 0, 2.78, 0));
  const swirl = new Group();
  swirl.position.set(0, 1.55, 0.05);
  for (let i = 0; i < 5; i++) {
    const strip = new Mesh(new PlaneGeometry(0.14, 0.5 + (i % 3) * 0.16), new MeshStandardMaterial({ color: i % 2 ? C.paper : C.vermilion, side: DoubleSide, roughness: 1 }));
    strip.position.set(-0.72 + i * 0.36, 0, 0);
    strip.castShadow = true;
    swirl.add(strip);
  }
  g.add(swirl);
  const dark = new Mesh(new PlaneGeometry(1.3, 1.55), new MeshBasicMaterial({ color: 0x2b302b, transparent: true, opacity: 0.55 }));
  dark.position.set(0, 1.35, -0.02);
  g.add(dark);
  return { group: g, swirl };
}

/** 社稷坛: the core shrine. */
export function makeShrineCore(): { group: Group; crystal: Group; halo: Group; ring1: Mesh; ring2: Mesh } {
  const g = new Group();
  g.add(cyl(2.0, 2.3, 0.3, C.paperDeep, 0, 0.15, 0, 12));
  g.add(cyl(1.62, 1.82, 0.26, C.paper, 0, 0.42, 0, 12));
  g.add(ring(1.55, C.inkSoft, 0, 0.57, 0, 0.06));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const stone = box(0.28, 1.2, 0.28, C.paperShade, Math.cos(a) * 1.25, 0.88, Math.sin(a) * 1.25);
    stone.rotation.y = a;
    g.add(stone);
    const sheaf = new Group();
    sheaf.position.set(Math.cos(a) * 1.25, 1.55, Math.sin(a) * 1.25);
    for (let k = 0; k < 4; k++) {
      const stalk = cyl(0.012, 0.016, 0.6, C.straw, (k - 1.5) * 0.045, 0.05, 0, 4);
      sheaf.add(stalk);
      const head = cone(0.04, 0.2, C.strawDark, (k - 1.5) * 0.045, 0.44, 0, 4);
      sheaf.add(head);
    }
    g.add(sheaf);
  }
  const crystal = new Group();
  crystal.position.y = 1.05;
  const grain = new Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const stalk = cyl(0.02, 0.025, 0.62, C.glow, Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12, 4, { emissive: C.glow, emissiveIntensity: 0.25 });
    grain.add(stalk);
    const head = cone(0.055, 0.26, C.glow, Math.cos(a) * 0.12, 0.68, Math.sin(a) * 0.12, 4, { emissive: C.glow, emissiveIntensity: 0.3 });
    grain.add(head);
  }
  grain.add(ico(0.16, C.paper, 0, 0.2, 0, 0, { emissive: C.glow, emissiveIntensity: 0.35 }));
  crystal.add(grain);
  g.add(crystal);
  const halo = new Group();
  halo.position.y = 1.62;
  const h1 = mesh(new TorusGeometry(0.78, 0.026, 4, 36), mat(C.glow, { emissive: C.glow, emissiveIntensity: 0.45, rough: 0.3 }), 0, 0, 0);
  h1.rotation.x = Math.PI / 2.15;
  const h2 = mesh(new TorusGeometry(0.98, 0.018, 4, 36), mat(C.paper, { emissive: C.paper, emissiveIntensity: 0.22, rough: 0.3 }), 0, 0, 0);
  h2.rotation.set(Math.PI / 2.45, 0.4, 0.2);
  h1.castShadow = h2.castShadow = false;
  halo.add(h1, h2);
  g.add(halo);
  const runeMat = new MeshBasicMaterial({ color: C.inkSoft, transparent: true, opacity: 0.4, side: DoubleSide });
  const ring1 = mesh(new TorusGeometry(1.2, 0.03, 4, 30), runeMat, 0, 0.62, 0);
  ring1.rotation.x = Math.PI / 2;
  ring1.castShadow = false;
  g.add(ring1);
  const ring2 = mesh(new TorusGeometry(0.9, 0.018, 4, 30), runeMat.clone(), 0, 0.62, 0);
  ring2.rotation.x = Math.PI / 2;
  ring2.castShadow = false;
  g.add(ring2);
  return { group: g, crystal, halo, ring1, ring2 };
}

export function makeCrystal(size: number, color: number, emissive: number = C.glow): Group {
  const g = new Group();
  const crystal = mesh(new ConeGeometry(size, size * 2.2, 4), mat(color, { emissive, emissiveIntensity: 0.6, rough: 0.3 }), 0, size * 1.2, 0);
  crystal.rotation.y = Math.PI / 4;
  crystal.castShadow = false;
  g.add(crystal);
  const base = ico(size * 0.42, color, 0, 0.1, 0, 0, { emissive, emissiveIntensity: 0.4 });
  base.castShadow = false;
  g.add(base);
  return g;
}

export function makeLily(size: number): Group {
  const g = new Group();
  const pad = new Mesh(new RingGeometry(0.18 * size, 0.32 * size, 10, 1, 0.4), new MeshStandardMaterial({ color: C.jade, side: DoubleSide, roughness: 1 }));
  pad.rotation.x = -Math.PI / 2;
  g.add(pad);
  return g;
}

/** 梯田: a freestanding three-tier rice terrace that reads from the menu camera. */
export function makeTerraces(width = 12, depth = 6.2): Group {
  const g = new Group();
  const tiers = 3;
  const tierDepth = depth / tiers;
  // A soft grass mound under the paddies keeps the terraces from reading as a
  // floating planter box when seen from the island rim.
  for (let tier = 0; tier < tiers; tier++) {
    const y = 0.18 + tier * 0.78;
    const tierWidth = width - tier * 2.2;
    const mound = sphere(1, C.jadeDark, tier * 0.6, y - 0.28, -depth / 2 + tierDepth * (tier + 0.5), 7);
    mound.scale.set(tierWidth * 0.53, 0.4, tierDepth * 0.7);
    g.add(mound);
  }
  for (let tier = 0; tier < tiers; tier++) {
    // Back tiers step up; each tier has a stone retaining lip, a wet tread and
    // a handful of rice clumps so it reads as a paddy rather than a box.
    const y = 0.2 + tier * 0.78;
    const z = -depth / 2 + tierDepth * (tier + 0.5);
    const tierWidth = width - tier * 2.2;
    const centerX = tier * 0.6;
    const tread = box(tierWidth, 0.24, tierDepth, C.earth, centerX, y, z);
    g.add(tread);
    const water = new Mesh(
      new PlaneGeometry(tierWidth - 0.5, tierDepth - 0.4),
      new MeshStandardMaterial({ color: 0x9fc0ba, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.72 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(centerX, y + 0.13, z);
    g.add(water);
    const lip = box(tierWidth + 0.1, 0.62, 0.2, C.paperDeep, centerX, y - 0.2, z + tierDepth / 2);
    g.add(lip);
    g.add(box(tierWidth + 0.1, 0.14, 0.12, C.inkSoft, centerX, y + 0.16, z + tierDepth / 2));
    // Dense green seedlings, with a few taller rice clumps for texture.
    for (let i = 0; i < 18; i++) {
      const rice = makeGrassTuft(0.34 + (i % 3) * 0.05, i % 4 === 0 ? C.jadeDark : C.jade);
      rice.position.set(
        centerX + (i / 17 - 0.5) * (tierWidth - 1.0) + (tier % 2) * 0.16,
        y + 0.15,
        z + ((i % 3) - 1) * 0.42,
      );
      g.add(rice);
    }
    for (let i = 0; i < 4; i++) {
      const rice = cropModel('wheat').clone(true);
      rice.scale.setScalar(0.24);
      rice.position.set(centerX + (i / 3 - 0.5) * (tierWidth - 1.4), y + 0.15, z + (i % 2 ? 0.34 : -0.36));
      g.add(rice);
    }
    // Side retaining walls in packed earth, with a grass fringe at the lip.
    for (const side of [-1, 1]) {
      const wall = box(0.22, 0.72, tierDepth, C.earth, centerX + (side * tierWidth) / 2, y - 0.2, z);
      g.add(wall);
      const fringe = makeGrassTuft(0.3, C.jadeDark);
      fringe.position.set(centerX + (side * tierWidth) / 2, y + 0.05, z + tierDepth / 2 - 0.1);
      g.add(fringe);
    }
  }
  return g;
}

/** 晒谷架 */
export function makeDryingRack(): Group {
  const g = new Group();
  for (const x of [-0.9, 0.9]) {
    g.add(cyl(0.05, 0.07, 1.5, C.earthDark, x, 0.75, 0, 5));
    g.add(cyl(0.05, 0.07, 1.5, C.earthDark, x, 0.75, 0.55, 5));
    g.add(box(0.06, 0.06, 0.62, C.earthDark, x, 1.42, 0.28));
  }
  for (const y of [0.55, 0.9, 1.25]) {
    g.add(cyl(0.025, 0.025, 1.8, C.jadeDark, 0, y, 0.28, 4).rotateZ(Math.PI / 2));
    for (let i = 0; i < 5; i++) {
      const sheaf = cone(0.12, 0.42, C.straw, -0.7 + i * 0.35, y - 0.28, 0.28, 5);
      sheaf.rotation.z = Math.PI;
      g.add(sheaf);
    }
  }
  return g;
}

/** 稻草人: also a landmark next to the field. */
export function makeScarecrow(): Group {
  const g = new Group();
  g.add(cyl(0.05, 0.07, 1.9, C.earthDark, 0, 0.95, 0, 5));
  g.add(box(1.1, 0.07, 0.07, C.earthDark, 0, 1.45, 0));
  g.add(cyl(0.22, 0.28, 0.62, C.straw, 0, 1.3, 0, 7));
  g.add(sphere(0.17, C.paperShade, 0, 1.78, 0, 7));
  g.add(cyl(0.34, 0.38, 0.05, C.straw, 0, 1.95, 0, 9));
  g.add(cyl(0.15, 0.2, 0.17, C.straw, 0, 2.05, 0, 9));
  g.add(box(0.04, 0.04, 0.03, C.ink, -0.06, 1.78, 0.16));
  g.add(box(0.04, 0.04, 0.03, C.ink, 0.06, 1.78, 0.16));
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
  const skin = 0xc59a70;
  const shirt = C.paper;
  const trousers = C.inkSoft;
  const boots = C.ink;
  const straw = C.straw;

  const legs: [Group, Group] = [new Group(), new Group()];
  for (let i = 0; i < 2; i++) {
    const hip = legs[i];
    hip.position.set(i === 0 ? -0.145 : 0.145, 0.86, 0);
    hip.add(box(0.2, 0.8, 0.22, trousers, 0, -0.4, 0));
    hip.add(box(0.22, 0.15, 0.3, boots, 0, -0.79, -0.03));
    group.add(hip);
  }
  const torso = new Group();
  group.add(torso);
  torso.add(box(0.5, 0.56, 0.32, shirt, 0, 1.16, 0));
  torso.add(box(0.54, 0.24, 0.34, C.paperShade, 0, 1.5, 0));
  torso.add(box(0.12, 0.36, 0.02, C.paperShade, -0.16, 1.34, -0.17));
  torso.add(box(0.12, 0.36, 0.02, C.paperShade, 0.16, 1.34, -0.17));
  torso.add(box(0.5, 0.08, 0.36, C.earthDark, 0, 0.9, 0));
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
  head.add(box(0.28, 0.14, 0.04, C.ink, 0, 0.08, 0.14));
  head.add(box(0.045, 0.05, 0.03, C.ink, -0.07, 0.03, -0.17));
  head.add(box(0.045, 0.05, 0.03, C.ink, 0.07, 0.03, -0.17));
  head.add(box(0.07, 0.06, 0.05, C.earth, 0, -0.04, -0.18));
  head.add(cyl(0.38, 0.42, 0.055, straw, 0, 0.19, 0, 9));
  head.add(cyl(0.19, 0.23, 0.22, straw, 0, 0.3, 0, 9));
  head.add(cyl(0.205, 0.235, 0.06, C.jadeDark, 0, 0.22, 0, 9));
  return { group, legs, arms, torso, head };
}

/** A first-person farming hoe, held at the lower-right of the view. */
export function makeHeldHoe(): Group {
  const g = new Group();
  g.add(cyl(0.028, 0.034, 0.92, C.earthDark, 0, 0.46, 0, 5));
  g.add(cyl(0.036, 0.036, 0.07, C.ink, 0, 0.04, 0, 5));
  const blade = box(0.26, 0.045, 0.16, C.inkPale, 0, 0.01, -0.08);
  blade.rotation.x = 0.24;
  g.add(blade);
  g.add(sphere(0.07, C.earth, 0.01, 0.5, 0.02, 5));
  g.add(box(0.1, 0.16, 0.11, C.earth, 0, 0.44, 0.02));
  g.traverse((child) => {
    child.castShadow = false;
    child.receiveShadow = false;
  });
  return g;
}

/* ───────────────────────────── gallery registry ─────────────────────────────
 * Every id here must exist in `whitebox-assets.json`; the gallery and the
 * acceptance script use this registry to render the complete placeholder set. */

export const WHITEBOX_BUILDERS: Record<string, () => Group> = {
  env_house: () => makeHouse(),
  env_waterwheel: () => makeWindmill().group,
  env_tea_shed: () => makeMarket(),
  env_well: () => makeWell(),
  env_haystack: () => makeHaystack(),
  env_basket: () => makeCrate(),
  env_jar: () => makeBarrel(),
  env_bamboo_fence: () => makeFenceSegment(2.4),
  env_pine: () => makePineTree(4.2, 0),
  env_bamboo: () => makeBambooGrove(4.0, 7),
  env_rock: () => {
    const g = new Group();
    g.add(makeRock(0.9));
    return g;
  },
  env_stone_lantern: () => makeStatue(),
  env_field_shelter: () => makeTent(),
  env_beast_gate: () => makePortal().group,
  env_shrine: () => makeShrineCore().group,
  env_terrace: () => makeTerraces(7, 5),
  env_drying_rack: () => makeDryingRack(),
  env_scarecrow: () => makeScarecrow(),
  crop_rice: () => cropModel('wheat'),
  crop_pumpkin: () => cropModel('pumpkin'),
  crop_starflower: () => cropModel('flower'),
  tower_bamboo: () => buildTowerModel('arrow', 1).group,
  tower_mortar: () => buildTowerModel('cannon', 1).group,
  tower_shrine: () => buildTowerModel('star', 1).group,
  guard_bowman: () => buildGuardianModel('bowman', 1).group,
  guard_hoeman: () => buildGuardianModel('hoeman', 1).group,
  guard_fieldhand: () => buildGuardianModel('fieldhand', 1).group,
  guard_herbalist: () => buildGuardianModel('herbalist', 1).group,
  guard_mason: () => buildGuardianModel('mason', 1).group,
  guard_ricespirit: () => buildGuardianModel('ricespirit', 1).group,
  enemy_fox: () => enemyModel('fox').group,
  enemy_wolf: () => enemyModel('wolf').group,
  enemy_boar: () => enemyModel('bull').group,
  enemy_stag: () => enemyModel('stag').group,
  player_farmer: () => makeFarmer().group,
  player_hoe: () => makeHeldHoe(),
};
