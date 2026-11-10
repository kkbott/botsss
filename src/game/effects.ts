import {
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';

interface Particle {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: Color;
  gravity: number;
  drag: number;
  active: boolean;
}

interface Floater {
  el: HTMLDivElement;
  world: Vector3;
  life: number;
  maxLife: number;
  rise: number;
  active: boolean;
}

const MAX_PARTICLES = 360;
const MAX_FLOATERS = 18;

export class ParticleSystem {
  readonly mesh: InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly dummy = new Object3D();
  private cursor = 0;

  constructor(scene: Scene) {
    const geometry = new IcosahedronGeometry(0.09, 0);
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: 2, // AdditiveBlending
    });
    this.mesh = new InstancedMesh(geometry, material, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 2;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const particle: Particle = {
        pos: new Vector3(),
        vel: new Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        color: new Color(0xffffff),
        gravity: 4,
        drag: 0.98,
        active: false,
      };
      this.particles.push(particle);
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  spawn(
    position: Vector3,
    color: number | Color,
    count: number,
    opts: { speed?: number; spread?: number; life?: number; size?: number; gravity?: number; up?: number; radius?: number } = {},
  ) {
    const speed = opts.speed ?? 2.2;
    const spread = opts.spread ?? 0.2;
    const life = opts.life ?? 0.65;
    const size = opts.size ?? 0.1;
    const gravity = opts.gravity ?? 4;
    const up = opts.up ?? 1.4;
    const radius = opts.radius ?? 0.05;
    const base = color instanceof Color ? color : new Color(color);
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      p.pos.set(
        position.x + (Math.random() - 0.5) * radius,
        position.y + (Math.random() - 0.5) * radius,
        position.z + (Math.random() - 0.5) * radius,
      );
      const angle = Math.random() * Math.PI * 2;
      const rs = Math.random() * speed;
      p.vel.set(Math.cos(angle) * rs, up * (0.35 + Math.random() * 0.9), Math.sin(angle) * rs);
      p.life = life * (0.65 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color.copy(base);
      if (Math.random() > 0.5) p.color.offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.15);
      p.gravity = gravity;
      p.drag = 0.985;
      p.active = true;
      p.pos.addScaledVector(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5), spread);
      const index = this.particles.indexOf(p);
      this.mesh.setColorAt(index, p.color);
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  burstHit(position: Vector3, color = 0xffd27a, count = 6) {
    this.spawn(position, color, count, { speed: 1.6, life: 0.35, size: 0.075, gravity: 3, up: 1.1 });
  }

  burstHarvest(position: Vector3, color = 0xf3c455, star = false) {
    this.spawn(position, color, star ? 16 : 11, {
      speed: 2.4,
      life: 0.9,
      size: 0.11,
      gravity: 3.5,
      up: 2.6,
      radius: 0.35,
    });
    if (star) {
      this.spawn(position.clone().add(new Vector3(0, 0.5, 0)), 0xb9a5ff, 10, {
        speed: 1.6,
        life: 1.2,
        size: 0.08,
        gravity: 1,
        up: 2.4,
      });
    }
  }

  burstBuild(position: Vector3) {
    this.spawn(position, 0xd9cba8, 12, { speed: 2.2, life: 0.7, size: 0.12, gravity: 5, up: 2.1, radius: 0.35 });
    this.spawn(position.clone().add(new Vector3(0, 0.4, 0)), 0xf3c455, 6, {
      speed: 1.8,
      life: 0.85,
      size: 0.09,
      gravity: 2.2,
      up: 2.6,
    });
  }

  burstDeath(position: Vector3, color = 0x9d7bff) {
    this.spawn(position, color, 14, { speed: 3.2, life: 0.8, size: 0.13, gravity: 5, up: 2.4, radius: 0.3 });
    this.spawn(position.clone().add(new Vector3(0, 0.4, 0)), 0xfff0c9, 5, {
      speed: 1.8,
      life: 0.5,
      size: 0.08,
      gravity: 2,
      up: 2.8,
    });
  }

  update(dt: number) {
    let changed = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        changed = true;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.pos.addScaledVector(p.vel, dt);
      const scale = p.size * Math.min(1, (p.life / p.maxLife) * 1.7);
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.set(p.life * 4, p.life * 3, 0);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
      changed = true;
    }
    if (changed) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

export class FloatingTexts {
  private readonly floaters: Floater[] = [];
  private cursor = 0;
  private readonly projected = new Vector3();

  constructor(layer: HTMLElement) {
    for (let i = 0; i < MAX_FLOATERS; i++) {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.opacity = '0';
      layer.appendChild(el);
      this.floaters.push({ el, world: new Vector3(), life: 0, maxLife: 1, rise: 1, active: false });
    }
  }

  spawn(text: string, world: Vector3, kind: 'gold' | 'star' | 'warn' | 'heal' = 'gold') {
    const floater = this.floaters[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_FLOATERS;
    floater.el.textContent = text;
    floater.el.className = `float-text${kind === 'gold' ? '' : ` is-${kind}`}`;
    floater.world.copy(world);
    floater.life = 1.25;
    floater.maxLife = 1.25;
    floater.rise = 1.1;
    floater.active = true;
    floater.el.style.opacity = '1';
  }

  update(dt: number, camera: PerspectiveCamera) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (const floater of this.floaters) {
      if (!floater.active) continue;
      floater.life -= dt;
      if (floater.life <= 0) {
        floater.active = false;
        floater.el.style.opacity = '0';
        continue;
      }
      const t = 1 - floater.life / floater.maxLife;
      this.projected.copy(floater.world);
      this.projected.y += t * floater.rise;
      this.projected.project(camera);
      if (this.projected.z > 1 || this.projected.z < -1) {
        floater.el.style.opacity = '0';
        continue;
      }
      const x = (this.projected.x * 0.5 + 0.5) * width;
      const y = (-this.projected.y * 0.5 + 0.5) * height;
      const alpha = Math.min(1, floater.life * 3.2);
      const scale = 1 + (1 - alpha) * 0.15;
      floater.el.style.left = `${x.toFixed(1)}px`;
      floater.el.style.top = `${y.toFixed(1)}px`;
      floater.el.style.opacity = `${alpha}`;
      floater.el.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }
  }
}
