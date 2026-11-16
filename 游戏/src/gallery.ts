import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import manifest from './game/whitebox-assets.json';
import { WHITEBOX_BUILDERS } from './game/models';

interface GalleryItem {
  id: string;
  name: string;
  en: string;
  category: string;
  categoryLabel: string;
  gameRole: string;
  triangles: number;
  dimensions: { width: number; height: number; depth: number };
  file: string;
}

interface PlacedItem {
  item: GalleryItem;
  group: import('three').Group;
  labelY: number;
}

const items = manifest.items as GalleryItem[];

/**
 * `?gallery=1` — a clean white-box contact sheet used for the acceptance
 * screenshots and for checking that every documented placeholder exists.
 * Optional filters: `&category=tower` or `&item=tower_bamboo`.
 */
export function startWhiteboxGallery(canvas: HTMLCanvasElement) {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const itemId = params.get('item');
  const selected = items.filter((entry) => (itemId ? entry.id === itemId : category ? entry.category === category : true));
  if (selected.length === 0) {
    document.body.innerHTML = `<pre style="padding:32px;color:#4b514c">No white-box item matches ${itemId ?? category ?? ''}</pre>`;
    return;
  }

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0xe8dfcf);
  scene.fog = new Fog(0xe8dfcf, 52, 150);
  const camera = new PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 300);
  scene.add(camera);

  scene.add(new HemisphereLight(0xfff7e8, 0xb5a98f, 1.35));
  scene.add(new AmbientLight(0xffffff, 0.22));
  const sun = new DirectionalLight(0xfff0d4, 1.9);
  sun.position.set(-14, 22, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const floor = new Mesh(new PlaneGeometry(180, 180), new MeshStandardMaterial({ color: 0xe4d9c5, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // Faint drafting grid.
  const gridMat = new MeshStandardMaterial({ color: 0xcdbfa6, roughness: 1 });
  for (let i = -12; i <= 12; i++) {
    const lineX = new Mesh(new BoxGeometry(0.025, 0.012, 44), gridMat);
    lineX.position.set(i * 3.2, 0.006, 0);
    scene.add(lineX);
    const lineZ = new Mesh(new BoxGeometry(44, 0.012, 0.025), gridMat);
    lineZ.position.set(0, 0.006, i * 3.2);
    scene.add(lineZ);
  }

  const placed: PlacedItem[] = [];
  const missing: string[] = [];
  const columns = itemId ? 1 : selected.length <= 8 ? selected.length : Math.max(1, Math.min(6, Math.ceil(Math.sqrt(selected.length * 1.35))));
  const spacingX = selected.length <= 8 ? 3.6 : 3.9;
  const spacingZ = 3.4;
  const rows = Math.ceil(selected.length / columns);
  selected.forEach((item, index) => {
    const builder = WHITEBOX_BUILDERS[item.id];
    if (!builder) {
      missing.push(item.id);
      return;
    }
    const group = builder();
    const box = new Box3().setFromObject(group);
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = Math.min(1.9 / maxDim, 1.55);
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);
    const scaledBox = new Box3().setFromObject(group);
    // Drop each object onto the paper floor, centred on its grid cell.
    group.position.y -= scaledBox.min.y;
    const col = itemId ? 0 : index % columns;
    const row = itemId ? 0 : Math.floor(index / columns);
    const x = (col - (columns - 1) / 2) * spacingX;
    const z = (row - (rows - 1) / 2) * spacingZ;
    group.position.x = x;
    group.position.z = z;
    group.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.add(group);
    const pedestal = new Mesh(new BoxGeometry(1.55, 0.08, 1.55), new MeshStandardMaterial({ color: 0xe6decd, roughness: 1 }));
    pedestal.position.set(x, 0.04, z);
    pedestal.receiveShadow = true;
    scene.add(pedestal);
    placed.push({ item, group, labelY: scaledBox.max.y + 0.25 });
  });

  const width = columns * spacingX;
  const depth = rows * spacingZ;
  const aspect = window.innerWidth / window.innerHeight;
  const fov = (camera.fov * Math.PI) / 180;
  const distanceForHeight = depth / 2 / Math.tan(fov / 2) + 5;
  const distanceForWidth = width / 2 / (Math.tan(fov / 2) * aspect) + 5;
  const distance = Math.max(distanceForHeight, distanceForWidth, itemId ? 7 : 12);
  const viewTarget = new Vector3(0, itemId ? 0.9 : 0.9, 0);
  camera.position.set(0, itemId ? 2.2 : Math.max(5.5, depth * 0.32), distance);
  camera.lookAt(viewTarget);

  const overlay = document.createElement('div');
  overlay.id = 'whitebox-gallery';
  overlay.innerHTML = `
    <div class="wb-head">
      <div class="wb-kicker">${manifest.title}</div>
      <h1>白模占位陈列</h1>
      <p>${selected.length} 个占位物 · 无贴图 · 平面着色 · 1 单位 = 1 米 · 清单 / Blender 提示词见 docs/whitebox-blender-prompts.md</p>
    </div>
    <div class="wb-legend">
      <span><i style="background:#f2efe6"></i>米白 · 主体</span>
      <span><i style="background:#4b514c"></i>墨灰 · 瓦木</span>
      <span><i style="background:#b09571"></i>暖土 · 土木</span>
      <span><i style="background:#8d9f87"></i>淡青 · 植物</span>
      <span><i style="background:#a84b38"></i>朱砂 · 点色</span>
      <span><i style="background:#e6d6a4"></i>浅金 · 发光</span>
    </div>
    <div class="wb-labels" id="wb-labels"></div>
    <div class="wb-foot">id 与 docs/whitebox-blender-prompts.md 一一对应 · 运行 <code>npm run screenshots:whitebox</code> 重新生成</div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('is-gallery');
  const labels = overlay.querySelector('#wb-labels') as HTMLElement;
  const indexed = placed.length > 8;
  for (const [index, entry] of placed.entries()) {
    const label = document.createElement('div');
    label.className = `wb-label${indexed ? ' is-index' : ''}`;
    label.dataset.item = entry.item.id;
    label.title = `${entry.item.id} · ${entry.item.gameRole}`;
    label.innerHTML = indexed ? `<b>${String(index + 1).padStart(2, '0')}</b>` : `<b>${entry.item.name}</b>`;
    labels.appendChild(label);
  }
  if (indexed) {
    const indexPanel = document.createElement('div');
    indexPanel.className = 'wb-index';
    indexPanel.innerHTML = placed
      .map(
        (entry, index) =>
          `<span><i>${String(index + 1).padStart(2, '0')}</i>${entry.item.name}</span>`,
      )
      .join('');
    overlay.appendChild(indexPanel);
  }
  document.getElementById('loading-screen')?.setAttribute('hidden', '');
  document.getElementById('menu-screen')?.setAttribute('hidden', '');
  document.getElementById('hud')?.setAttribute('hidden', '');
  document.getElementById('bottom-bar')?.setAttribute('hidden', '');

  const temp = new Vector3();
  function projectLabels() {
    const elements = labels.children;
    for (let i = 0; i < placed.length; i++) {
      const entry = placed[i];
      const el = elements[i] as HTMLElement;
      if (!el) continue;
      temp.set(entry.group.position.x, 0.02, entry.group.position.z + 0.95);
      temp.project(camera);
      const x = (temp.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-temp.y * 0.5 + 0.5) * window.innerHeight;
      el.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${(y + 6).toFixed(1)}px)`;
      el.style.opacity = temp.z < 1 && x > -100 && x < window.innerWidth + 100 ? '1' : '0';
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  let frames = 0;
  function frame() {
    frames += 1;
    renderer.render(scene, camera);
    projectLabels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  (window as unknown as {
    __whiteboxGallery?: { count: number; missing: string[]; ids: string[]; frames: () => number; ready: boolean };
  }).__whiteboxGallery = {
    count: placed.length,
    missing,
    ids: placed.map((entry) => entry.item.id),
    frames: () => frames,
    ready: true,
  };
  // Reflect a missing builder in the page so a broken catalog is not silent.
  if (missing.length > 0) {
    const warn = document.createElement('div');
    warn.className = 'wb-warning';
    warn.textContent = `缺少构建器：${missing.join(', ')}`;
    overlay.appendChild(warn);
  }
}
