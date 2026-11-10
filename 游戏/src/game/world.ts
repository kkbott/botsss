import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { collapseGroup } from './batch';
import { ENVIRONMENT_FILES, type EnvironmentAssets } from './assets';
import { PATH_POINTS, PLOTS, TOWER_PADS, WORLD } from './config';
import type { PlotRuntime, PlotSpec } from './types';
import {
  makeBarrel,
  makeCrate,
  makeFenceSegment,
  makeFlower,
  makeGrassTuft,
  makeHaystack,
  makeHouse,
  makeLily,
  makeMarket,
  makePathStone,
  makePineTree,
  makePortal,
  makeRock,
  makeRoundTree,
  makeShrineCore,
  makeStatue,
  makeTent,
  makeWell,
  makeWindmill,
} from './models';

const UP = new Vector3(0, 1, 0);

export interface PlotVisual {
  group: Group;
  soil: Mesh;
  cropAnchor: Group;
  locked: Group;
  scorched: Group;
  highlight: Mesh;
  matureGlow: Group;
  spec: PlotSpec;
}

export interface PadVisual {
  group: Group;
  base: Mesh;
  highlight: Mesh;
  marker: Group;
  spec: (typeof TOWER_PADS)[number];
}

export interface WorldPath {
  curve: CatmullRomCurve3;
  length: number;
  samples: Vector3[];
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRibbon(curve: CatmullRomCurve3, width: number, color: number, y: number, wobble = 0): Mesh {
  const segments = 140;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();
  const tangent = new Vector3();
  const normal = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, point);
    curve.getTangentAt(t, tangent);
    normal.crossVectors(UP, tangent).normalize();
    const w = width * (1 + Math.sin(i * 0.42) * wobble);
    for (const side of [-1, 1]) {
      positions.push(point.x + normal.x * side * w * 0.5, y, point.z + normal.z * side * w * 0.5);
      uvs.push(t * 16, side === -1 ? 0 : 1);
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const material = new MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: false });
  const mesh = new Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function skyDome(): Mesh {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new Color(0x6fa8cc) },
      midColor: { value: new Color(0xf9ddb3) },
      bottomColor: { value: new Color(0xbdd3dd) },
      sunDirection: { value: new Vector3(-0.55, 0.36, 0.42).normalize() },
      sunColor: { value: new Color(0xffe6b8) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        float horizon = smoothstep(0.36, 0.56, h);
        vec3 col = mix(bottomColor, midColor, smoothstep(0.36, 0.53, h));
        col = mix(col, topColor, horizon);
        float sun = max(dot(normalize(vDir), sunDirection), 0.0);
        col += sunColor * pow(sun, 52.0) * 0.8;
        col += sunColor * pow(sun, 6.0) * 0.09;
        float haze = smoothstep(0.72, 0.36, h) * 0.12;
        col = mix(col, midColor, haze);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new Mesh(new SphereGeometry(180, 32, 18), material);
  sky.frustumCulled = false;
  return sky;
}

function makeSunSprite(): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    gradient.addColorStop(0, 'rgba(255, 248, 221, 1)');
    gradient.addColorStop(0.12, 'rgba(255, 236, 180, 0.9)');
    gradient.addColorStop(0.34, 'rgba(255, 207, 135, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending });
  const sprite = new Sprite(material);
  sprite.scale.set(24, 24, 1);
  sprite.position.set(-40, 29, -30);
  return sprite;
}

function makeCloud(random: () => number): Group {
  const g = new Group();
  const count = 3 + Math.floor(random() * 3);
  for (let i = 0; i < count; i++) {
    const puff = new Mesh(
      new IcosahedronGeometry(1, 1),
      new MeshStandardMaterial({
        color: 0xfaf2df,
        roughness: 1,
        flatShading: true,
      }),
    );
    const s = 0.6 + random() * 0.8;
    puff.scale.set(s * (1.3 + random()), s * (0.45 + random() * 0.2), s);
    puff.position.set((i - count / 2) * 1.3 + random() * 0.5, random() * 0.4, random() * 0.8);
    puff.castShadow = false;
    puff.receiveShadow = false;
    g.add(puff);
  }
  return g;
}

function makeBird(): Line {
  const positions = [-0.55, 0.1, 0, 0, -0.1, 0, 0, -0.1, 0, 0.55, 0.1, 0];
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const line = new Line(geo, new LineBasicMaterial({ color: 0x3d4a3c, transparent: true, opacity: 0.55 }));
  return line;
}

function createTextSprite(text: string): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 64);
    ctx.fillStyle = 'rgba(16, 28, 19, 0.82)';
    ctx.beginPath();
    ctx.roundRect(10, 8, 108, 42, 12);
    ctx.fill();
    ctx.fillStyle = '#f3c455';
    ctx.font = '700 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 30);
  }
  const texture = new Texture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.2, 0.6, 1);
  return sprite;
}

export class World {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;
  readonly raycaster = new Raycaster();
  readonly plotVisuals: PlotVisual[] = [];
  readonly padVisuals: PadVisual[] = [];
  readonly path: WorldPath;
  readonly island = new Group();
  readonly effectsLayer = new Group();
  private readonly staticParts = new Group();
  private readonly environment: EnvironmentAssets | null;

  private readonly initialCamera = new Vector3(WORLD.camera.position.x, WORLD.camera.position.y, WORLD.camera.position.z);
  private readonly initialTarget = new Vector3(WORLD.camera.target.x, WORLD.camera.target.y, WORLD.camera.target.z);
  private readonly targetCamera = new Vector3();
  private readonly targetLook = new Vector3();
  private cameraTween = 0;
  private cameraTweenDuration = 0;
  private windmillBlades: Group | null = null;
  private portalSwirl: Group | null = null;
  private coreCrystal: Group | null = null;
  private coreHalo: Group | null = null;
  private coreRings: Mesh[] = [];
  private fireflies: Points | null = null;
  private fireflyBase: Float32Array | null = null;
  private pollen: Points | null = null;
  private pollenBase: Float32Array | null = null;
  private clouds: Group[] = [];
  private birds: Line[] = [];
  private pondRings: Mesh[] = [];
  private matureGlows: Group[] = [];
  private elapsed = 0;
  private readonly random = mulberry32(0xf13d2026);
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, environment: EnvironmentAssets | null = null) {
    this.environment = environment;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setClearColor(0xd9c9a8, 1);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMappingExposure = 1.12;
    const pixelRatio = Math.min(window.devicePixelRatio, this.isNarrow() ? 1.6 : 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.scene.fog = new Fog(0xd8c8a8, 52, 112);
    this.camera = new PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 240);
    this.camera.position.copy(this.initialCamera);
    this.camera.lookAt(this.initialTarget);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(this.initialTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minDistance = WORLD.camera.minDistance;
    this.controls.maxDistance = WORLD.camera.maxDistance;
    this.controls.minPolarAngle = WORLD.camera.minPolar;
    this.controls.maxPolarAngle = WORLD.camera.maxPolar;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.26;
    this.controls.update();

    this.path = this.makePath();
    this.buildScene();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  private isNarrow() {
    return window.matchMedia('(max-width: 760px)').matches;
  }

  private makePath(): WorldPath {
    const points = PATH_POINTS.map(([x, z]) => new Vector3(x, WORLD.pathY, z));
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.35);
    const length = curve.getLength();
    const samples: Vector3[] = [];
    for (let i = 0; i <= 260; i++) samples.push(curve.getPointAt(i / 260));
    return { curve, length, samples };
  }

  private envInstance(
    key: keyof typeof ENVIRONMENT_FILES,
    height: number,
    options: { maxWidth?: number; shadows?: boolean } = {},
  ): Group | null {
    return this.environment?.instance(key, height, options) ?? null;
  }

  private prop(
    key: keyof typeof ENVIRONMENT_FILES,
    height: number,
    fallback: () => Object3D,
    options: { maxWidth?: number; shadows?: boolean; fallbackScale?: number } = {},
  ): Object3D {
    const asset = this.envInstance(key, height, options);
    if (asset) return asset;
    const object = fallback();
    if (options.fallbackScale) object.scale.multiplyScalar(options.fallbackScale);
    return object;
  }

  private buildScene() {
    this.scene.add(skyDome());
    this.scene.add(makeSunSprite());
    this.addLights();
    this.scene.add(this.staticParts);
    this.buildIsland();
    this.buildPath();
    this.buildFarm();
    this.buildPads();
    this.buildCore();
    this.buildPortal();
    this.buildFarmstead();
    this.buildPond();
    this.buildDecor();
    collapseGroup(this.staticParts);
    this.buildAmbientLife();
    this.buildClouds();
    this.scene.add(this.effectsLayer);
  }

  private addLights() {
    const hemisphere = new HemisphereLight(0xc9e3ff, 0x5f7041, 1.3);
    this.scene.add(hemisphere);
    this.scene.add(new AmbientLight(0xffe8c9, 0.3));

    const sun = new DirectionalLight(0xffd7a0, 2.8);
    sun.position.set(-20, 30, 17);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    const target = new Group();
    target.position.set(0, 0, 0);
    this.scene.add(target);
    sun.target = target;

    const fill = new DirectionalLight(0xa8cfe8, 0.4);
    fill.position.set(16, 12, -18);
    this.scene.add(fill);
  }

  private buildIsland() {
    const g = this.island;
    const cliff = new MeshStandardMaterial({ color: 0x786f5d, roughness: 1, flatShading: true });
    const cliffDark = new MeshStandardMaterial({ color: 0x5e5849, roughness: 1, flatShading: true });
    const grass = new MeshStandardMaterial({ color: 0x789f55, roughness: 1, flatShading: true });
    const grassEdge = new MeshStandardMaterial({ color: 0x6b944d, roughness: 1, flatShading: true });

    const geo = new CylinderGeometry(WORLD.island.rx, 9.5, 8.2, 26, 6, false);
    geo.scale(1, 1, WORLD.island.rz / WORLD.island.rx);
    geo.translate(0, -4.1, 0);

    const pos = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const radial = Math.hypot(x, z);
      if (y < -0.15 && radial > 1) {
        const angle = Math.atan2(z, x);
        const noise = Math.sin(angle * 7 + y * 1.8) * 0.28 + Math.cos(angle * 13 - y) * 0.18;
        const depth = Math.min(1, -y / 7);
        pos.setX(i, x * (1 + noise * 0.07 * (0.5 + depth)));
        pos.setZ(i, z * (1 + noise * 0.09 * (0.5 + depth)));
        pos.setY(i, y + noise * 0.55 * depth);
      }
    }
    geo.computeVertexNormals();
    const islandMesh = new Mesh(geo, [cliff, grass, cliffDark]);
    islandMesh.receiveShadow = true;
    islandMesh.castShadow = false;
    g.add(islandMesh);

    const rim = new Mesh(new CylinderGeometry(WORLD.island.rx * 1.012, WORLD.island.rx * 1.002, 0.5, 26, 1, true), grassEdge);
    rim.position.y = -0.24;
    rim.receiveShadow = true;
    g.add(rim);

    // Rock spurs hanging under the island.
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + 0.25;
      const radius = 0.55 + (i % 3) * 0.11;
      const spur = new ConeGeometry(1.1 + (i % 4) * 0.35, 2.2 + (i % 3) * 1.2, 5);
      const rock = new Mesh(spur, i % 2 ? cliff : cliffDark);
      rock.position.set(Math.cos(angle) * WORLD.island.rx * radius, -5.2 - (i % 4) * 0.6, Math.sin(angle) * WORLD.island.rz * radius);
      rock.rotation.set(Math.cos(angle) * 0.2, angle, Math.sin(angle) * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      g.add(rock);
    }

    // Floating satellite rocks for depth.
    for (let i = 0; i < 3; i++) {
      const angle = 1.2 + i * 2.1;
      const islet = new Group();
      const top = new Mesh(new CylinderGeometry(1.3 + i * 0.45, 0.7, 0.4, 7), grass);
      top.position.y = 0;
      top.receiveShadow = true;
      const bottom = new Mesh(new ConeGeometry(1.2 + i * 0.45, 2.2 + i, 7), cliffDark);
      bottom.position.y = -1.25;
      bottom.rotation.y = i;
      bottom.castShadow = true;
      bottom.receiveShadow = true;
      islet.add(top, bottom);
      if (i === 1) {
        const tree = makePineTree(1.9, 1);
        tree.position.y = 0.2;
        islet.add(tree);
      }
      islet.position.set(Math.cos(angle) * (WORLD.island.rx + 2.4), -4.2 - i * 1.4, Math.sin(angle) * (WORLD.island.rz + 1.8));
      g.add(islet);
    }

    // Warm grass mounds give the flat top a hand-made silhouette.
    const moundMat = new MeshStandardMaterial({ color: 0x82a95c, roughness: 1, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const mound = new Mesh(new SphereGeometry(1.2 + this.random() * 1.8, 7, 5), moundMat);
      const angle = this.random() * Math.PI * 2;
      const radius = 0.82 + this.random() * 0.14;
      const x = Math.cos(angle) * WORLD.island.rx * radius;
      const z = Math.sin(angle) * WORLD.island.rz * radius;
      mound.position.set(x, -0.55, z);
      mound.scale.set(1.6, 0.58, 1.2);
      mound.receiveShadow = true;
      g.add(mound);
    }
    this.staticParts.add(g);
  }

  private buildPath() {
    const outer = makeRibbon(this.path.curve, 2.75, 0x9b8057, WORLD.pathY - 0.005, 0.03);
    const inner = makeRibbon(this.path.curve, 2.2, 0xcbb081, WORLD.pathY + 0.008, 0.04);
    this.staticParts.add(outer, inner);

    for (let i = 0; i < 28; i++) {
      const t = 0.02 + (i / 27) * 0.96;
      const point = this.path.curve.getPointAt(t);
      const tangent = this.path.curve.getTangentAt(t);
      const normal = new Vector3().crossVectors(UP, tangent).normalize();
      const side = i % 2 ? 1 : -1;
      const offset = 1.25 + this.random() * 0.35;
      if (i % 2 === 0) {
        const stoneKey = i % 6 === 0 ? 'path_circle' : 'path_stone';
        const stone = this.prop(
          stoneKey,
          0.07 + this.random() * 0.025,
          () => makePathStone(0.45 + this.random() * 0.15),
          { shadows: false, fallbackScale: 0.9, maxWidth: 0.62 },
        );
        stone.position.set(point.x + normal.x * side * offset, 0.055, point.z + normal.z * side * offset);
        stone.rotation.y = this.random() * Math.PI;
        this.staticParts.add(stone);
      }
      if (i % 3 === 0) {
        const tuft = this.prop(
          i % 2 ? 'grass' : 'grass_large',
          0.32 + this.random() * 0.22,
          () => makeGrassTuft(0.45 + this.random() * 0.35),
          { shadows: false },
        );
        tuft.position.set(point.x - normal.x * side * (offset + 0.15), 0.02, point.z - normal.z * side * (offset + 0.15));
        this.staticParts.add(tuft);
      }
    }

    const start = this.path.curve.getPointAt(0);
    const end = this.path.curve.getPointAt(1);
    const startRing = new Mesh(
      new RingGeometry(0.9, 1.25, 30),
      new MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.35, side: DoubleSide }),
    );
    startRing.rotation.x = -Math.PI / 2;
    startRing.position.set(start.x, 0.06, start.z);
    this.staticParts.add(startRing);
    const endRing = new Mesh(
      new RingGeometry(1.7, 2.0, 36),
      new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.28, side: DoubleSide }),
    );
    endRing.rotation.x = -Math.PI / 2;
    endRing.position.set(end.x, 0.06, end.z);
    this.staticParts.add(endRing);
  }

  private buildFarm() {
    const soil = new MeshStandardMaterial({ color: 0x6d4f34, roughness: 1, flatShading: true });
    const soilDark = new MeshStandardMaterial({ color: 0x543c28, roughness: 1, flatShading: true });
    const wood = new MeshStandardMaterial({ color: 0x9b7042, roughness: 1, flatShading: true });
    const weed = new MeshStandardMaterial({ color: 0x5f8a46, roughness: 1, flatShading: true });
    const charred = new MeshStandardMaterial({ color: 0x302c26, roughness: 1, flatShading: true });
    const glow = new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.3, side: DoubleSide });
    const size = WORLD.farm.plotSize;

    for (const spec of PLOTS) {
      const group = new Group();
      group.position.set(spec.x, 0, spec.z);
      group.userData.plotIndex = spec.index;

      const base = new Mesh(new BoxGeometry(size + 0.18, 0.18, size + 0.18), soilDark);
      base.position.y = 0.05;
      base.receiveShadow = true;
      base.userData.plotIndex = spec.index;
      base.userData.pickable = 'plot';
      group.add(base);

      const top = new Mesh(new BoxGeometry(size, 0.14, size), soil);
      top.position.y = 0.12;
      top.receiveShadow = true;
      top.castShadow = false;
      top.userData.plotIndex = spec.index;
      group.add(top);

      for (const [x, z, w, d] of [
        [0, size / 2 + 0.11, size + 0.3, 0.09],
        [0, -size / 2 - 0.11, size + 0.3, 0.09],
        [size / 2 + 0.11, 0, 0.09, size + 0.3],
        [-size / 2 - 0.11, 0, 0.09, size + 0.3],
      ]) {
        const beam = new Mesh(new BoxGeometry(w, 0.1, d), wood);
        beam.position.set(x, 0.21, z);
        beam.castShadow = true;
        beam.receiveShadow = true;
        group.add(beam);
      }

      for (const z of [-0.44, 0, 0.44]) {
        const furrow = new Mesh(new BoxGeometry(size * 0.8, 0.018, 0.065), soilDark);
        furrow.position.set(0, 0.196, z);
        furrow.receiveShadow = true;
        group.add(furrow);
      }

      const cropAnchor = new Group();
      cropAnchor.position.y = 0.19;
      group.add(cropAnchor);

      const locked = new Group();
      for (let i = 0; i < 7; i++) {
        const tuft = makeGrassTuft(0.45 + this.random() * 0.5, 0x729b53);
        tuft.position.set((this.random() - 0.5) * 1.05, 0.17, (this.random() - 0.5) * 1.05);
        locked.add(tuft);
      }
      for (let i = 0; i < 3; i++) {
        const weedStem = new Mesh(new ConeGeometry(0.12, 0.8 + this.random() * 0.5, 4), weed);
        weedStem.position.set((this.random() - 0.5) * 0.8, 0.6, (this.random() - 0.5) * 0.8);
        weedStem.rotation.z = (this.random() - 0.5) * 0.25;
        weedStem.castShadow = true;
        locked.add(weedStem);
      }
      group.add(locked);

      const scorched = new Group();
      const burnt = new Mesh(new BoxGeometry(size * 0.94, 0.04, size * 0.94), charred);
      burnt.position.y = 0.205;
      scorched.add(burnt);
      for (let i = 0; i < 4; i++) {
        const coal = makeRock(0.14 + this.random() * 0.1, 0x2c2723);
        coal.position.set((this.random() - 0.5) * 0.8, 0.22, (this.random() - 0.5) * 0.8);
        scorched.add(coal);
      }
      scorched.visible = false;
      group.add(scorched);

      const highlight = new Mesh(new RingGeometry(size * 0.55, size * 0.63, 32), new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.9, side: DoubleSide }));
      highlight.rotation.x = -Math.PI / 2;
      highlight.position.y = 0.23;
      highlight.visible = false;
      group.add(highlight);

      const matureGlow = new Group();
      const glowRing = new Mesh(new RingGeometry(0.56, 0.64, 30), glow);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.27;
      matureGlow.add(glowRing);
      const spark = new Mesh(new IcosahedronGeometry(0.09, 0), new MeshBasicMaterial({ color: 0xffe79b }));
      spark.position.set(0.42, 1.5, 0.2);
      matureGlow.add(spark);
      const spark2 = new Mesh(new IcosahedronGeometry(0.06, 0), new MeshBasicMaterial({ color: 0xfff2c4 }));
      spark2.position.set(-0.36, 1.9, -0.24);
      matureGlow.add(spark2);
      matureGlow.visible = false;
      group.add(matureGlow);

      this.matureGlows.push(matureGlow);
      collapseGroup(group, { keep: [cropAnchor, locked, scorched, highlight, matureGlow] });
      collapseGroup(locked);
      collapseGroup(scorched);
      this.scene.add(group);
      this.plotVisuals.push({ group, soil: base, cropAnchor, locked, scorched, highlight, matureGlow, spec });
    }

    // Low fence around the south-west edge of the farm for a lived-in silhouette.
    const southZ = WORLD.farm.startZ + (WORLD.farm.rows - 1) * WORLD.farm.spacing + 1.28;
    const westX = WORLD.farm.startX - 1.28;
    for (let i = 0; i < 5; i++) {
      const fence = this.prop('fence', 1.02, () => makeFenceSegment(1.55), { maxWidth: 1.5 });
      fence.position.set(westX + 1.1 + i * 1.52, 0, southZ);
      fence.rotation.y = 0;
      this.staticParts.add(fence);
    }
    for (let i = 0; i < 4; i++) {
      const fence = this.prop('fence', 1.02, () => makeFenceSegment(1.55), { maxWidth: 1.5 });
      fence.position.set(westX, 0, southZ - 1.3 - i * 1.52);
      fence.rotation.y = Math.PI / 2;
      this.staticParts.add(fence);
    }
    const gate = this.prop('fence_gate', 1.22, () => makeFenceSegment(1.3), { maxWidth: 1.45 });
    gate.position.set(westX + 8.25, 0, southZ);
    gate.rotation.y = Math.PI / 2;
    this.staticParts.add(gate);
    const northZ = WORLD.farm.startZ - 1.3;
    for (let i = 0; i < 4; i++) {
      const backFence = this.prop('fence_simple', 0.9, () => makeFenceSegment(1.55), { maxWidth: 1.4 });
      backFence.position.set(westX + 1.1 + i * 1.52, 0, northZ);
      this.staticParts.add(backFence);
    }

    // Soil path from the farmhouse to the farm gate.
    for (let i = 0; i < 8; i++) {
      const stone = this.prop('path_stone', 0.06 + this.random() * 0.02, () => makePathStone(0.38 + this.random() * 0.16), {
        shadows: false,
        fallbackScale: 0.9,
        maxWidth: 0.5,
      });
      stone.position.set(-8.8 + i * 0.5, 0.055, southZ + 1.3 + Math.sin(i * 0.7) * 0.18);
      stone.rotation.y = this.random() * Math.PI;
      this.staticParts.add(stone);
    }

    // Hand props around the field: pots, logs and a stump.
    const pot = this.prop('pot_large', 0.6, () => makeCrate(), { fallbackScale: 0.8 });
    pot.position.set(-10.55, 0, 1.0);
    this.staticParts.add(pot);
    const smallPot = this.prop('pot_small', 0.38, () => makeCrate(), { fallbackScale: 0.5 });
    smallPot.position.set(-10.15, 0, 1.45);
    this.staticParts.add(smallPot);
    const stump = this.prop('stump', 0.52, () => makeBarrel(), { fallbackScale: 0.6 });
    stump.position.set(-10.0, 0, -4.6);
    stump.rotation.y = 0.4;
    this.staticParts.add(stump);
    const log = this.prop('log', 0.42, () => makeBarrel(), { fallbackScale: 0.5 });
    log.position.set(-10.9, 0, -4.1);
    log.rotation.y = 0.8;
    log.rotation.z = 0.25;
    this.staticParts.add(log);
  }

  private buildPads() {
    const stone = new MeshStandardMaterial({ color: 0x8d8d7a, roughness: 1, flatShading: true });
    const stoneDark = new MeshStandardMaterial({ color: 0x6b6d5d, roughness: 1, flatShading: true });
    const rune = new MeshBasicMaterial({ color: 0xa8c97b, transparent: true, opacity: 0.45, side: DoubleSide });
    for (const spec of TOWER_PADS) {
      const group = new Group();
      group.position.set(spec.x, 0, spec.z);
      group.userData.padIndex = spec.index;
      const base = new Mesh(new CylinderGeometry(1.14, 1.28, 0.28, 9), stone);
      base.position.y = 0.14;
      base.receiveShadow = true;
      base.castShadow = true;
      base.userData.padIndex = spec.index;
      base.userData.pickable = 'pad';
      group.add(base);
      const inner = new Mesh(new CylinderGeometry(0.82, 0.9, 0.08, 9), stoneDark);
      inner.position.y = 0.31;
      inner.receiveShadow = true;
      group.add(inner);
      const runeRing = new Mesh(new TorusGeometry(0.95, 0.028, 4, 28), rune);
      runeRing.rotation.x = Math.PI / 2;
      runeRing.position.y = 0.31;
      group.add(runeRing);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const pebble = makeRock(0.14 + this.random() * 0.08, 0x74756a);
        pebble.position.set(Math.cos(a) * 1.28, 0.05, Math.sin(a) * 1.28);
        group.add(pebble);
      }
      const marker = new Group();
      const gem = new Mesh(
        new IcosahedronGeometry(0.17, 0),
        new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.9 }),
      );
      gem.position.y = 1.1;
      marker.add(gem);
      const markerRing = new Mesh(
        new TorusGeometry(0.31, 0.017, 4, 20),
        new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.5 }),
      );
      markerRing.rotation.x = Math.PI / 2;
      markerRing.position.y = 1.1;
      marker.add(markerRing);
      marker.userData.spin = 0.6;
      group.add(marker);
      const highlight = new Mesh(
        new RingGeometry(1.18, 1.34, 32),
        new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.8, side: DoubleSide }),
      );
      highlight.rotation.x = -Math.PI / 2;
      highlight.position.y = 0.33;
      highlight.visible = false;
      group.add(highlight);
      collapseGroup(group, { keep: [highlight, marker] });
      this.scene.add(group);
      this.padVisuals.push({ group, base, highlight, marker, spec });
    }
  }

  private buildCore() {
    const { group, crystal, halo, ring1, ring2 } = makeShrineCore();
    const core = WORLD.core;
    group.position.set(core.x, 0, core.z);
    group.rotation.y = -0.1;
    collapseGroup(group, { keep: [crystal, halo, ring1, ring2] });
    this.scene.add(group);
    this.coreCrystal = crystal;
    this.coreHalo = halo;
    this.coreRings = [ring1, ring2];

    const glow = new Mesh(
      new RingGeometry(2.5, 3.2, 48),
      new MeshBasicMaterial({ color: 0xf3c455, transparent: true, opacity: 0.11, side: DoubleSide }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(core.x, 0.07, core.z);
    this.staticParts.add(glow);

    const tree = this.envInstance('tree_common', 4.8, { maxWidth: 4.6 }) ?? makeRoundTree(4.8, 1);
    tree.position.set(core.x - 4.6, 0, core.z - 2.2);
    tree.rotation.y = 0.4;
    this.staticParts.add(tree);
    const tree2 = this.envInstance('pine_tall', 4.2, { maxWidth: 2.4 }) ?? makePineTree(4.2, 2);
    tree2.position.set(core.x + 3.2, 0, core.z - 2.0);
    tree2.rotation.y = 1.2;
    this.staticParts.add(tree2);

    const fence = this.prop('fence', 1.0, () => makeFenceSegment(2.3));
    fence.position.set(core.x - 2.5, 0, core.z + 2.4);
    fence.rotation.y = 0.2;
    this.staticParts.add(fence);

    const beaconMaterial = new MeshBasicMaterial({
      color: 0x9de9ff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: DoubleSide,
      blending: 2,
    });
    const beacon = new Mesh(new CylinderGeometry(0.22, 0.72, 6.5, 10, 1, true), beaconMaterial);
    beacon.position.set(core.x, 3.3, core.z);
    beacon.castShadow = false;
    beacon.receiveShadow = false;
    this.scene.add(beacon);
    const beaconInner = new Mesh(
      new CylinderGeometry(0.06, 0.18, 5.2, 8, 1, true),
      new MeshBasicMaterial({ color: 0xfff0c9, transparent: true, opacity: 0.14, depthWrite: false, blending: 2 }),
    );
    beaconInner.position.set(core.x, 2.8, core.z);
    this.scene.add(beaconInner);
  }

  private buildPortal() {
    const { group, swirl } = makePortal();
    const spawn = WORLD.spawn;
    group.position.set(spawn.x, 0, spawn.z);
    const next = this.path.curve.getPointAt(0.06);
    group.rotation.y = Math.atan2(next.x - spawn.x, next.z - spawn.z) + Math.PI;
    collapseGroup(group, { keep: [swirl] });
    this.scene.add(group);
    this.portalSwirl = swirl;

    const light = new Mesh(
      new CircleGeometry(1.9, 30),
      new MeshBasicMaterial({ color: 0x7a5ecf, transparent: true, opacity: 0.16, side: DoubleSide }),
    );
    light.rotation.x = -Math.PI / 2;
    light.position.set(spawn.x, 0.06, spawn.z);
    this.staticParts.add(light);

    const portalRocks = [
      ['rock_tall', 1.15, -1.2, 0.6],
      ['rock_a', 0.8, 1.0, 1.0],
      ['rock_group', 0.65, 0.7, -1.1],
    ] as const;
    for (const [key, height, dx, dz] of portalRocks) {
      const rock = this.envInstance(key, height, { maxWidth: 1.9 });
      if (!rock) continue;
      rock.position.set(spawn.x + dx, 0, spawn.z + dz);
      rock.rotation.y = this.random() * Math.PI;
      this.staticParts.add(rock);
    }
  }

  private buildFarmstead() {
    const d = WORLD.decorations;
    const house = this.prop('house', 3.45, () => makeHouse(), { fallbackScale: 1.35 });
    house.position.set(d.farmhouse.x, 0, d.farmhouse.z);
    house.rotation.y = d.farmhouse.rotation;
    this.staticParts.add(house);

    const windmill = this.envInstance('windmill', 5.2);
    if (windmill) {
      windmill.position.set(d.windmill.x, 0, d.windmill.z);
      windmill.rotation.y = d.windmill.rotation;
      this.staticParts.add(windmill);
      this.windmillBlades = null;
    } else {
      const fallback = makeWindmill();
      fallback.group.position.set(d.windmill.x, 0, d.windmill.z);
      fallback.group.rotation.y = d.windmill.rotation;
      fallback.group.scale.setScalar(1.18);
      collapseGroup(fallback.group, { keep: [fallback.blades] });
      this.scene.add(fallback.group);
      this.windmillBlades = fallback.blades;
    }

    const market = this.prop('market', 2.65, () => makeMarket(), { fallbackScale: 0.95 });
    market.position.set(d.market.x, 0, d.market.z);
    market.rotation.y = d.market.rotation;
    this.staticParts.add(market);

    const well = this.prop('well', 2.0, () => makeWell());
    well.position.set(d.well.x, 0, d.well.z);
    well.rotation.y = d.well.rotation;
    this.staticParts.add(well);

    const hay = this.prop('hay', 1.45, () => makeHaystack(), { fallbackScale: 1.1 });
    hay.position.set(d.hay.x, 0, d.hay.z);
    hay.rotation.y = d.hay.rotation;
    this.staticParts.add(hay);

    const crates = this.prop('crate', 0.8, () => makeCrate());
    crates.position.set(d.crates.x, 0, d.crates.z);
    crates.rotation.y = d.crates.rotation;
    this.staticParts.add(crates);
    const crate2 = this.prop('crate', 0.55, () => makeCrate(), { fallbackScale: 0.8 });
    crate2.position.set(d.crates.x + 0.75, 0.55, d.crates.z + 0.15);
    crate2.rotation.y = d.crates.rotation + 0.4;
    this.staticParts.add(crate2);
    const barrel = this.prop('barrel', 0.95, () => makeBarrel());
    barrel.position.set(d.crates.x + 0.25, 0, d.crates.z + 1.1);
    this.staticParts.add(barrel);

    const tent = this.prop('tent', 2.1, () => makeTent(), { fallbackScale: 0.8 });
    tent.position.set(-5.0, 0, -5.4);
    tent.rotation.y = -0.5;
    this.staticParts.add(tent);

    const statue = this.prop('statue_column', 2.4, () => makeStatue(), { fallbackScale: 1.15 });
    statue.position.set(-1.9, 0, 7.1);
    statue.rotation.y = 0.2;
    this.staticParts.add(statue);

    const barrels = this.prop('barrel', 0.95, () => makeBarrel());
    barrels.position.set(-11.0, 0, 4.05);
    barrels.rotation.y = 0.7;
    this.staticParts.add(barrels);

    const firewood = this.prop('campfire', 0.4, () => makeCrate(), { fallbackScale: 0.5 });
    firewood.position.set(-8.9, 0, 4.2);
    firewood.rotation.y = 0.4;
    this.staticParts.add(firewood);
  }

  private buildPond() {
    const pond = WORLD.decorations.pond;
    const water = new Mesh(
      new CircleGeometry(pond.radius, 32),
      new MeshStandardMaterial({
        color: 0x5aafba,
        roughness: 0.18,
        metalness: 0.15,
        transparent: true,
        opacity: 0.86,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(pond.x, 0.035, pond.z);
    water.receiveShadow = true;
    this.staticParts.add(water);

    const shoreline = new Mesh(
      new RingGeometry(pond.radius * 0.94, pond.radius * 1.16, 34),
      new MeshStandardMaterial({ color: 0x7e785d, roughness: 1, flatShading: true }),
    );
    shoreline.rotation.x = -Math.PI / 2;
    shoreline.position.set(pond.x, 0.02, pond.z);
    this.staticParts.add(shoreline);

    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + 0.2;
      const rock = this.prop('rock_a', 0.32 + this.random() * 0.32, () => makeRock(0.18 + this.random() * 0.24, 0x7a7d70), {
        maxWidth: 1.2,
        shadows: false,
      });
      rock.position.set(pond.x + Math.cos(a) * pond.radius * (1.08 + this.random() * 0.12), 0.03, pond.z + Math.sin(a) * pond.radius * 1.08);
      rock.rotation.y = this.random() * Math.PI;
      this.staticParts.add(rock);
    }
    for (let i = 0; i < 5; i++) {
      const lily = this.prop('lily', 0.06 + this.random() * 0.03, () => makeLily(0.9 + this.random() * 0.5), { shadows: false, maxWidth: 0.5 });
      lily.position.set(pond.x + (this.random() - 0.5) * 2.4, 0.06, pond.z + (this.random() - 0.5) * 2.4);
      lily.rotation.y = this.random() * Math.PI;
      this.staticParts.add(lily);
    }
    for (let i = 0; i < 2; i++) {
      const ring = new Mesh(
        new RingGeometry(0.35 + i * 0.35, 0.38 + i * 0.35, 26),
        new MeshBasicMaterial({ color: 0xc7f0f2, transparent: true, opacity: 0.35, side: DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pond.x, 0.05, pond.z);
      this.pondRings.push(ring);
      this.scene.add(ring);
    }
    // Reeds at the pond edge.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.6;
      const reed = this.prop(
        'grass_large',
        0.8 + this.random() * 0.55,
        () => new Mesh(new ConeGeometry(0.035, 0.9 + this.random() * 0.7, 3), new MeshStandardMaterial({ color: 0x6c8e4e, roughness: 1 })),
        { shadows: false },
      );
      reed.position.set(pond.x + Math.cos(a) * pond.radius * 1.12, 0.02, pond.z + Math.sin(a) * pond.radius * 1.12);
      reed.rotation.y = this.random() * Math.PI;
      this.staticParts.add(reed);
    }
  }

  private blocked(x: number, z: number, radius: number): boolean {
    const nx = x / (WORLD.island.rx * 0.86);
    const nz = z / (WORLD.island.rz * 0.86);
    if (nx * nx + nz * nz > 1) return true;
    for (const plot of PLOTS) {
      if (Math.abs(x - plot.x) < 1.35 + radius && Math.abs(z - plot.z) < 1.35 + radius) return true;
    }
    for (const pad of TOWER_PADS) {
      if (Math.hypot(x - pad.x, z - pad.z) < 2.2 + radius) return true;
    }
    for (let i = 0; i < this.path.samples.length; i += 3) {
      const p = this.path.samples[i];
      if (Math.hypot(x - p.x, z - p.z) < 1.9 + radius) return true;
    }
    if (Math.hypot(x - WORLD.core.x, z - WORLD.core.z) < 5.7 + radius) return true;
    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 3.4 + radius) return true;
    const pond = WORLD.decorations.pond;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.radius + 1.0 + radius) return true;
    const d = WORLD.decorations;
    for (const obj of [d.farmhouse, d.windmill, d.market, d.well, d.hay, d.crates]) {
      if (Math.hypot(x - obj.x, z - obj.z) < 2.6 + radius) return true;
    }
    if (Math.hypot(x + 1.9, z - 7.1) < 2.0 + radius) return true;
    return false;
  }

  private buildDecor() {
    const treeSpots: Array<[number, number, number]> = [];
    let attempts = 0;
    while (treeSpots.length < 23 && attempts < 600) {
      attempts++;
      const angle = this.random() * Math.PI * 2;
      const radius = 0.7 + this.random() * 0.25;
      const x = Math.cos(angle) * WORLD.island.rx * radius;
      const z = Math.sin(angle) * WORLD.island.rz * radius;
      if (this.blocked(x, z, 1.4)) continue;
      if (x > -2.5 && x < 8.5 && z > 2.5) continue;
      if (treeSpots.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 2.7)) continue;
      treeSpots.push([x, z, 3.0 + this.random() * 2.2]);
    }
    const treeVariants = ['tree_common', 'tree_autumn', 'tree_birch', 'pine_tall', 'oak', 'tree_small'] as const;
    treeSpots.forEach(([x, z, height], i) => {
      const key = treeVariants[i % treeVariants.length];
      const asset = this.envInstance(key, height, { maxWidth: 4.4 });
      let tree: Object3D;
      if (asset) tree = asset;
      else {
        tree = i % 3 === 0 ? makeRoundTree(height, i) : makePineTree(height, i);
        tree.scale.setScalar(0.9 + this.random() * 0.2);
      }
      tree.position.set(x, 0, z);
      tree.rotation.y = this.random() * Math.PI * 2;
      this.staticParts.add(tree);
    });

    for (let i = 0; i < 26; i++) {
      const x = (this.random() * 2 - 1) * WORLD.island.rx * 0.88;
      const z = (this.random() * 2 - 1) * WORLD.island.rz * 0.88;
      if (this.blocked(x, z, 0.3)) continue;
      const rockKeys = ['rock_a', 'rock_c', 'rock_tall', 'rock_group', 'rock'] as const;
      const rock = this.prop(rockKeys[i % rockKeys.length], 0.45 + this.random() * 0.85, () =>
        makeRock(0.25 + this.random() * 0.65, i % 4 === 0 ? 0x8e8d7e : 0x7d8071),
      { maxWidth: 2.0, shadows: true });
      rock.position.set(x, 0, z);
      rock.rotation.y = this.random() * Math.PI * 2;
      this.staticParts.add(rock);
    }

    for (let i = 0; i < 58; i++) {
      const x = (this.random() * 2 - 1) * WORLD.island.rx * 0.89;
      const z = (this.random() * 2 - 1) * WORLD.island.rz * 0.89;
      if (this.blocked(x, z, 0.15)) continue;
      const grass = this.prop(
        i % 4 === 0 ? 'grass_large' : 'grass',
        0.26 + this.random() * 0.3,
        () => makeGrassTuft(0.35 + this.random() * 0.4, i % 3 === 0 ? 0x88b366 : 0x709a52),
        { shadows: false },
      );
      grass.position.set(x, 0, z);
      grass.rotation.y = this.random() * Math.PI;
      this.staticParts.add(grass);
    }

    const flowerKeys = ['flowers_purple', 'flowers_yellow', 'flowers_red'] as const;
    for (let i = 0; i < 40; i++) {
      const x = (this.random() * 2 - 1) * WORLD.island.rx * 0.88;
      const z = (this.random() * 2 - 1) * WORLD.island.rz * 0.88;
      if (this.blocked(x, z, 0.1)) continue;
      const flower = this.prop(flowerKeys[i % flowerKeys.length], 0.32 + this.random() * 0.24, () =>
        makeFlower(0.55 + this.random() * 0.45, [0xe8c45c, 0xb9a5ff, 0xef8056][i % 3]),
      { shadows: false });
      flower.position.set(x, 0, z);
      flower.rotation.y = this.random() * Math.PI;
      this.staticParts.add(flower);
    }

    for (let i = 0; i < 7; i++) {
      const x = (this.random() * 2 - 1) * WORLD.island.rx * 0.82;
      const z = (this.random() * 2 - 1) * WORLD.island.rz * 0.82;
      if (this.blocked(x, z, 0.1)) continue;
      const mushroom = this.prop(i % 2 ? 'mushroom_red' : 'mushroom_tan', 0.28 + this.random() * 0.18, () => {
        const fallback = new Group();
        const stem = new Mesh(new CylinderGeometry(0.05, 0.07, 0.28, 5), new MeshStandardMaterial({ color: 0xe8dcc1, roughness: 1 }));
        stem.position.y = 0.14;
        fallback.add(stem);
        const cap = new Mesh(
          new ConeGeometry(0.2, 0.15, 7),
          new MeshStandardMaterial({ color: i % 2 ? 0xc55c48 : 0xd9b56d, roughness: 1, flatShading: true }),
        );
        cap.position.y = 0.3;
        fallback.add(cap);
        return fallback;
      }, { shadows: false });
      mushroom.position.set(x, 0, z);
      mushroom.rotation.y = this.random() * Math.PI;
      this.staticParts.add(mushroom);
    }

    for (let i = 0; i < 4; i++) {
      const x = (this.random() * 2 - 1) * WORLD.island.rx * 0.8;
      const z = (this.random() * 2 - 1) * WORLD.island.rz * 0.8;
      if (this.blocked(x, z, 0.4)) continue;
      const stump = this.prop('stump', 0.45 + this.random() * 0.2, () => {
        const fallback = new Mesh(new CylinderGeometry(0.35, 0.45, 0.4, 7), new MeshStandardMaterial({ color: 0x8a6138, roughness: 1, flatShading: true }));
        fallback.position.y = 0.2;
        return fallback;
      });
      stump.position.set(x, 0, z);
      stump.rotation.y = this.random() * Math.PI;
      this.staticParts.add(stump);
    }

    for (let i = 0; i < 5; i++) {
      const x = (this.random() * 2 - 1) * WORLD.island.rx * 0.78;
      const z = (this.random() * 2 - 1) * WORLD.island.rz * 0.78;
      if (this.blocked(x, z, 0.5)) continue;
      const bushKeys = ['bush', 'bush_berries', 'plant_bush', 'plant_bush_detailed'] as const;
      const bush = this.prop(bushKeys[i % bushKeys.length], 0.9 + this.random() * 0.5, () => makeRock(0.4, 0x6f9a4e), {
        maxWidth: 1.8,
      });
      bush.position.set(x, 0, z);
      bush.rotation.y = this.random() * Math.PI;
      this.staticParts.add(bush);
    }

    const obelisk = this.prop('statue_obelisk', 2.6, () => makeStatue(), { fallbackScale: 1.1 });
    obelisk.position.set(0.6, 0, -6.2);
    obelisk.rotation.y = -0.4;
    this.staticParts.add(obelisk);

    // A patch of tiny wildflowers by the farmhouse.
    for (let i = 0; i < 6; i++) {
      const tuft = this.prop('flowers_yellow', 0.28, () => makeFlower(0.45, 0xe8c45c), { shadows: false });
      tuft.position.set(-9.3 + i * 0.35, 0, 7.3);
      tuft.rotation.y = this.random() * Math.PI;
      this.staticParts.add(tuft);
    }
  }

  private buildAmbientLife() {
    const fireflyCount = 80;
    const positions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      const angle = this.random() * Math.PI * 2;
      const radius = 4 + this.random() * 11;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.8 + this.random() * 3.2;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.8;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: 0xffe08a,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    });
    this.fireflies = new Points(geo, material);
    this.fireflies.frustumCulled = false;
    this.fireflyBase = positions.slice();
    this.scene.add(this.fireflies);

    const pollenCount = 110;
    const pollenPositions = new Float32Array(pollenCount * 3);
    for (let i = 0; i < pollenCount; i++) {
      pollenPositions[i * 3] = (this.random() * 2 - 1) * 13;
      pollenPositions[i * 3 + 1] = 0.4 + this.random() * 5;
      pollenPositions[i * 3 + 2] = (this.random() * 2 - 1) * 11;
    }
    const pollenGeo = new BufferGeometry();
    pollenGeo.setAttribute('position', new BufferAttribute(pollenPositions, 3));
    this.pollen = new Points(
      pollenGeo,
      new PointsMaterial({
        color: 0xf7e7b0,
        size: 0.055,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.pollen.frustumCulled = false;
    this.pollenBase = pollenPositions.slice();
    this.scene.add(this.pollen);

    for (let i = 0; i < 3; i++) {
      const bird = makeBird();
      bird.position.set(-8 + i * 5, 8 + i * 0.6, -6 + i * 2);
      bird.scale.setScalar(0.8 + i * 0.22);
      this.birds.push(bird);
      this.scene.add(bird);
    }
  }

  private buildClouds() {
    for (let i = 0; i < 5; i++) {
      const cloud = makeCloud(this.random);
      const angle = (i / 5) * Math.PI * 2 + 0.5;
      const radius = 46 + this.random() * 14;
      cloud.position.set(Math.cos(angle) * radius, 17 + this.random() * 8, Math.sin(angle) * radius * 0.8);
      cloud.scale.setScalar(1.1 + this.random() * 0.9);
      cloud.userData.drift = 0.006 + this.random() * 0.008;
      collapseGroup(cloud);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
    // A few low wisps make the island read as floating without stealing the view.
    for (let i = 0; i < 3; i++) {
      const cloud = makeCloud(this.random);
      const angle = 1.1 + (i / 3) * Math.PI * 1.4;
      const radius = 32 + this.random() * 8;
      cloud.position.set(Math.cos(angle) * radius, -6 + this.random() * 2.5, Math.sin(angle) * radius * 0.8);
      cloud.scale.setScalar(1.6 + this.random() * 0.8);
      cloud.userData.drift = 0.004 + this.random() * 0.004;
      collapseGroup(cloud);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  setMenuMode(menu: boolean) {
    this.controls.autoRotate = menu;
    this.controls.autoRotateSpeed = 0.24;
  }

  resetCamera(animated = true) {
    this.targetCamera.copy(this.initialCamera);
    this.targetLook.copy(this.initialTarget);
    if (!animated) {
      this.camera.position.copy(this.initialCamera);
      this.controls.target.copy(this.initialTarget);
      this.cameraTween = 0;
      return;
    }
    this.cameraTween = 0.0001;
    this.cameraTweenDuration = 1.1;
  }

  updateAmbient(dt: number) {
    this.elapsed += dt;
    const t = this.elapsed;
    if (this.portalSwirl) {
      this.portalSwirl.rotation.z += dt * 0.6;
      this.portalSwirl.rotation.y += dt * 0.22;
      this.portalSwirl.position.y = 1.4 + Math.sin(t * 1.8) * 0.04;
    }
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.55;
    if (this.coreCrystal) {
      this.coreCrystal.rotation.y += dt * 0.55;
      this.coreCrystal.position.y = 1.05 + Math.sin(t * 1.6) * 0.08;
    }
    if (this.coreHalo) {
      this.coreHalo.rotation.y += dt * 0.28;
      this.coreHalo.rotation.x = Math.sin(t * 0.45) * 0.1;
    }
    for (let i = 0; i < this.coreRings.length; i++) {
      this.coreRings[i].rotation.z += dt * (i === 0 ? 0.35 : -0.5);
      this.coreRings[i].position.y = 0.62 + Math.sin(t * 1.2 + i) * 0.03;
    }
    this.pondRings.forEach((ring, i) => {
      const s = 1 + Math.sin(t * 0.8 + i * 1.6) * 0.12;
      ring.scale.set(s, s, 1);
      ring.rotation.z += dt * 0.04 * (i + 1);
    });
    this.matureGlows.forEach((glow, i) => {
      if (!glow.visible) return;
      glow.rotation.y += dt * 0.8;
      glow.children[0].scale.setScalar(1 + Math.sin(t * 2.4 + i) * 0.1);
    });
    this.padVisuals.forEach((pad, i) => {
      if (!pad.marker.visible) return;
      pad.marker.rotation.y += dt * 0.6;
      pad.marker.position.y = Math.sin(t * 1.5 + i) * 0.06;
    });
    this.clouds.forEach((cloud) => {
      cloud.rotation.y += dt * 0.005;
      cloud.position.x += Math.sin(t * 0.03 + cloud.id) * dt * 0.02;
    });
    this.birds.forEach((bird, i) => {
      const angle = t * 0.18 + i * 2.1;
      bird.position.x = Math.cos(angle) * (12 + i * 3);
      bird.position.z = Math.sin(angle) * (9 + i * 2.5);
      bird.rotation.y = -angle + Math.PI / 2;
      bird.position.y = 8 + i * 0.8 + Math.sin(t * 0.5 + i) * 0.6;
    });
    if (this.fireflies && this.fireflyBase) {
      const pos = this.fireflies.geometry.attributes.position as BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const bx = this.fireflyBase[i * 3];
        const by = this.fireflyBase[i * 3 + 1];
        const bz = this.fireflyBase[i * 3 + 2];
        pos.setX(i, bx + Math.sin(t * 0.5 + i * 1.7) * 0.45);
        pos.setY(i, by + Math.sin(t * 0.8 + i * 0.9) * 0.35);
        pos.setZ(i, bz + Math.cos(t * 0.45 + i * 1.3) * 0.45);
      }
      pos.needsUpdate = true;
      (this.fireflies.material as PointsMaterial).opacity = 0.6 + Math.sin(t * 1.6) * 0.18;
    }
    if (this.pollen && this.pollenBase) {
      const pos = this.pollen.geometry.attributes.position as BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const bx = this.pollenBase[i * 3];
        const by = this.pollenBase[i * 3 + 1];
        const bz = this.pollenBase[i * 3 + 2];
        pos.setX(i, bx + Math.sin(t * 0.16 + i) * 1.3);
        pos.setY(i, by - ((t * 0.12 + i * 0.37) % 5));
        pos.setZ(i, bz + Math.cos(t * 0.13 + i * 0.8) * 1.1);
      }
      pos.needsUpdate = true;
    }

    if (this.cameraTween > 0) {
      this.cameraTween += dt / this.cameraTweenDuration;
      const k = Math.min(1, this.cameraTween);
      const eased = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerp(this.targetCamera, eased * 0.12);
      this.controls.target.lerp(this.targetLook, eased * 0.12);
      if (k >= 1) this.cameraTween = 0;
    }
    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isNarrow() ? 1.6 : 2));
    this.renderer.setSize(width, height, false);
  }

  screenPoint(world: Vector3): { x: number; y: number } {
    const point = world.clone().project(this.camera);
    return {
      x: (point.x * 0.5 + 0.5) * window.innerWidth,
      y: (-point.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  pick(clientX: number, clientY: number): { kind: 'plot' | 'pad'; index: number } | null {
    const ndc = new Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.plotVisuals.map((p) => p.group), ...this.padVisuals.map((p) => p.group)], true);
    for (const hit of hits) {
      let obj: import('three').Object3D | null = hit.object;
      while (obj) {
        if (obj.userData.pickable === 'plot' || (obj.userData.plotIndex !== undefined && obj.userData.pickable !== 'pad')) {
          return { kind: 'plot', index: obj.userData.plotIndex as number };
        }
        if (obj.userData.pickable === 'pad' || obj.userData.padIndex !== undefined) {
          return { kind: 'pad', index: obj.userData.padIndex as number };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  hitWorld(clientX: number, clientY: number): Vector3 | null {
    const ndc = new Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new Mesh(new PlaneGeometry(WORLD.island.rx * 2.4, WORLD.island.rz * 2.4), new MeshBasicMaterial());
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.1;
    const hits = this.raycaster.intersectObject(plane);
    return hits[0]?.point ?? null;
  }

  addFloatingSprite(text: string, x: number, y: number, z: number): Sprite {
    const sprite = createTextSprite(text);
    sprite.position.set(x, y, z);
    this.effectsLayer.add(sprite);
    return sprite;
  }

  /** Crops are recreated as visual groups by the game; this cleans old children. */
  clearCropAnchor(plot: PlotVisual) {
    while (plot.cropAnchor.children.length) {
      const child = plot.cropAnchor.children.pop();
      if (child) child.removeFromParent();
    }
  }

  syncPlotVisual(plot: PlotRuntime, view: PlotVisual) {
    view.locked.visible = !plot.unlocked;
    view.scorched.visible = plot.scorched;
    view.matureGlow.visible = !!plot.crop?.mature;
    view.highlight.visible = false;
    view.soil.userData.plotIndex = plot.spec.index;
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}

export { createTextSprite };
