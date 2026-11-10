import { CircleGeometry, Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { WORLD } from './config';
import { makeFarmer, makeHeldHoe, type FarmerRig } from './models';

export type PlayerMode = 'first' | 'overview';

const LOOK_SENSITIVITY = 0.0022;
const PITCH_LIMIT = 1.42;

export interface PlayerCollision {
  (x: number, z: number): { x: number; z: number };
}

export interface PlayerTouchControls {
  joystick: HTMLElement | null;
  joystickKnob: HTMLElement | null;
}

interface DragLook {
  pointerId: number;
  kind: 'mouse' | 'touch';
  x: number;
  y: number;
  moved: number;
  time: number;
}

/**
 * First-person character controller.
 *
 * - mouse look through Pointer Lock (with drag-look fallback when lock is
 *   unavailable), WASD movement and an optional jump;
 * - a visible low-poly farmer in the switchable overview camera;
 * - a hoe viewmodel and walking animation in first person;
 * - touch support: left virtual joystick + drag on the scene to look.
 */
export class Player {
  readonly rig: FarmerRig;
  readonly viewmodel: Group;
  readonly position = new Vector3(WORLD.player.start.x, 0, WORLD.player.start.z);
  yaw: number = WORLD.player.startYaw;
  pitch: number = WORLD.player.startPitch;
  mode: PlayerMode = 'first';

  private readonly camera: PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly collide: PlayerCollision;
  private readonly keys = new Set<string>();
  private readonly joystick: HTMLElement | null;
  private readonly joystickKnob: HTMLElement | null;
  private readonly shadow: Group;
  private enabled = false;
  private locked = false;
  private jumpY = 0;
  private vy = 0;
  private grounded = true;
  private walkPhase = 0;
  private moveAmount = 0;
  private bob = 0;
  private swingTime = 0;
  private avatarVisible = true;
  private joystickPointer: number | null = null;
  private joystickValue = { x: 0, y: 0 };
  private drag: DragLook | null = null;
  private wantJump = false;
  private onTap: (() => void) | null;
  private touchTapAt = 0;

  constructor(
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
    collide: PlayerCollision,
    touch: PlayerTouchControls = { joystick: null, joystickKnob: null },
    onTap: (() => void) | null = null,
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.collide = collide;
    this.onTap = onTap;
    this.joystick = touch.joystick;
    this.joystickKnob = touch.joystickKnob;
    this.rig = makeFarmer();
    this.shadow = this.makeShadow();
    this.rig.group.add(this.shadow);
    this.rig.group.visible = false;
    this.viewmodel = makeHeldHoe();
    this.viewmodel.position.set(0.52, -0.5, -0.84);
    this.viewmodel.rotation.set(0.1, -0.22, 0.55);
    this.viewmodel.scale.setScalar(0.62);
    this.viewmodel.visible = false;
    this.camera.add(this.viewmodel);
    this.bindInput();
  }

  private makeShadow(): Group {
    const group = new Group();
    const shadow = new Mesh(
      new CircleGeometry(0.44, 20),
      new MeshBasicMaterial({ color: 0x1c2418, transparent: true, opacity: 0.26, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    shadow.renderOrder = 1;
    group.add(shadow);
    return group;
  }

  /* ───────────────────────────── lifecycle ───────────────────────────── */

  setMode(mode: PlayerMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.keys.clear();
    this.joystickValue = { x: 0, y: 0 };
    this.applyJoystickKnob();
    this.viewmodel.visible = mode === 'first' && this.enabled;
    this.rig.group.visible = mode === 'overview' && this.avatarVisible;
    if (mode === 'overview') this.releasePointer();
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) {
      this.viewmodel.visible = enabled && this.mode === 'first';
      return;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.joystickValue = { x: 0, y: 0 };
      this.applyJoystickKnob();
      this.drag = null;
      this.releasePointer();
    }
    this.viewmodel.visible = enabled && this.mode === 'first';
    this.rig.group.visible = this.mode === 'overview' && this.avatarVisible;
  }

  setAvatarVisible(visible: boolean) {
    this.avatarVisible = visible;
    this.rig.group.visible = visible && this.mode === 'overview';
  }

  get isLocked() {
    return this.locked;
  }

  get jumpYForDebug() {
    return this.jumpY;
  }

  get groundedForDebug() {
    return this.grounded;
  }

  reset() {
    this.position.set(WORLD.player.start.x, 0, WORLD.player.start.z);
    this.yaw = WORLD.player.startYaw;
    this.pitch = WORLD.player.startPitch;
    this.jumpY = 0;
    this.vy = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.moveAmount = 0;
    this.bob = 0;
    this.swingTime = 0;
    this.joystickValue = { x: 0, y: 0 };
    this.applyJoystickKnob();
    this.mode = 'first';
    this.rig.group.visible = false;
    this.viewmodel.visible = this.enabled;
    this.syncCamera();
  }

  releasePointer() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
    this.locked = false;
  }

  /** A short hoe swing played on every successful interaction. */
  swing() {
    this.swingTime = 0.34;
  }

  /** Debug helper: aim the camera at a world position. */
  lookAt(target: Vector3) {
    const eye = this.eyePosition(new Vector3());
    const dx = target.x - eye.x;
    const dy = target.y - eye.y;
    const dz = target.z - eye.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -PITCH_LIMIT, PITCH_LIMIT);
    this.syncCamera();
  }

  setLook(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
    this.syncCamera();
  }

  eyePosition(out = new Vector3()) {
    return out.set(this.position.x, WORLD.player.eyeHeight + this.jumpY + this.bob, this.position.z);
  }

  forward(out = new Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /* ───────────────────────────── per-frame ───────────────────────────── */

  update(dt: number) {
    const active = this.enabled && this.mode === 'first';
    if (active) this.move(dt);
    this.animate(dt, active);
    if (this.mode === 'first') this.syncCamera();
  }

  private move(dt: number) {
    let forwardInput = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let strafeInput = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    if (Math.abs(this.joystickValue.x) > 0.08 || Math.abs(this.joystickValue.y) > 0.08) {
      strafeInput += this.joystickValue.x;
      forwardInput -= this.joystickValue.y;
    }
    const length = Math.hypot(strafeInput, forwardInput);
    const moving = length > 0.12;
    this.moveAmount = MathUtils.lerp(this.moveAmount, moving ? 1 : 0, 1 - Math.pow(0.001, dt));
    if (moving) {
      const scale = 1 / Math.max(1, length);
      forwardInput *= scale;
      strafeInput *= scale;
      const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const speed = running ? WORLD.player.runSpeed : WORLD.player.walkSpeed;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const dx = (-sin * forwardInput + cos * strafeInput) * speed * dt;
      const dz = (-cos * forwardInput - sin * strafeInput) * speed * dt;
      const resolved = this.collide(this.position.x + dx, this.position.z + dz);
      this.position.x = resolved.x;
      this.position.z = resolved.z;
      this.walkPhase += dt * speed * 2.35;
      this.bob = Math.sin(this.walkPhase * 2) * 0.035 * this.moveAmount;
    } else {
      this.bob = MathUtils.lerp(this.bob, 0, 1 - Math.pow(0.002, dt));
    }

    if (!this.grounded) {
      this.vy -= WORLD.player.gravity * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }
    if (this.grounded && this.wantJump) {
      this.vy = WORLD.player.jumpSpeed;
      this.grounded = false;
      this.jumpY = 0.001;
    }
    this.wantJump = false;
  }

  private animate(dt: number, active: boolean) {
    this.swingTime = Math.max(0, this.swingTime - dt);
    const swing = this.swingTime > 0 ? Math.sin((1 - this.swingTime / 0.34) * Math.PI) : 0;

    // First-person hands/hoe.
    if (this.viewmodel.visible) {
      const sway = Math.sin(this.walkPhase) * 0.012 * this.moveAmount;
      this.viewmodel.position.set(0.52 + sway, -0.5 + Math.abs(this.bob) * 0.5 + Math.sin(this.walkPhase * 2) * 0.01, -0.84);
      this.viewmodel.rotation.set(0.1 - swing * 0.72, -0.22, 0.55 + swing * 0.38);
    }

    // Third-person farmer animation.
    if (this.rig.group.visible) {
      this.rig.group.position.set(this.position.x, this.jumpY, this.position.z);
      this.rig.group.rotation.y = this.yaw;
      const stride = Math.sin(this.walkPhase) * 0.55 * this.moveAmount;
      this.rig.legs[0].rotation.x = stride;
      this.rig.legs[1].rotation.x = -stride;
      this.rig.arms[0].rotation.x = -stride * 0.8 - swing * 0.9;
      this.rig.arms[1].rotation.x = stride * 0.8 - swing * 0.4;
      const idle = active ? 0 : Math.sin(performance.now() * 0.0016) * 0.008;
      this.rig.torso.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.035 * this.moveAmount + idle;
      this.rig.head.rotation.y = Math.sin(performance.now() * 0.0007) * 0.18;
    }
  }

  private syncCamera() {
    const camera = this.camera;
    camera.rotation.order = 'YXZ';
    camera.position.set(this.position.x, WORLD.player.eyeHeight + this.jumpY + this.bob, this.position.z);
    camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /* ───────────────────────────── input ───────────────────────────── */

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseLook);
    this.canvas.addEventListener('click', this.onCanvasClick);
    if (this.joystick) {
      this.joystick.addEventListener('pointerdown', this.onJoystickDown);
      this.joystick.addEventListener('pointermove', this.onJoystickMove);
      this.joystick.addEventListener('pointerup', this.onJoystickUp);
      this.joystick.addEventListener('pointercancel', this.onJoystickUp);
    }
  }

  private isTextTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled || this.mode !== 'first' || this.isTextTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      this.keys.add(event.code);
    }
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) this.wantJump = true;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.joystickValue = { x: 0, y: 0 };
    this.applyJoystickKnob();
  };

  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
  };

  private onMouseLook = (event: MouseEvent) => {
    if (!this.locked || !this.enabled || this.mode !== 'first') return;
    this.yaw -= event.movementX * LOOK_SENSITIVITY;
    this.pitch = MathUtils.clamp(this.pitch - event.movementY * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || this.mode !== 'first') return;
    if (event.pointerType === 'touch') {
      this.drag = {
        pointerId: event.pointerId,
        kind: 'touch',
        x: event.clientX,
        y: event.clientY,
        moved: 0,
        time: performance.now(),
      };
      this.canvas.setPointerCapture?.(event.pointerId);
      return;
    }
    if (document.pointerLockElement === this.canvas) return;
    this.drag = {
      pointerId: event.pointerId,
      kind: 'mouse',
      x: event.clientX,
      y: event.clientY,
      moved: 0,
      time: performance.now(),
    };
  };

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!this.enabled || this.mode !== 'first') {
      this.drag = null;
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    // Drag-look covers touch and browsers where pointer lock is unavailable.
    this.yaw -= dx * LOOK_SENSITIVITY * (drag.kind === 'touch' ? 1.25 : 1);
    this.pitch = MathUtils.clamp(this.pitch - dy * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
  };

  private onPointerUp = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.drag = null;
    const tapped = drag.moved < 9 && performance.now() - drag.time < 420;
    if (drag.kind === 'touch') {
      if (tapped) {
        this.touchTapAt = performance.now();
        this.onTap?.();
      }
      return;
    }
    if (tapped && !this.locked) {
      try {
        const result = this.canvas.requestPointerLock?.() as unknown;
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {
            // Drag-look remains available when the browser refuses pointer lock.
          });
        }
      } catch {
        // Drag-look fallback.
      }
    }
  };

  private onCanvasClick = () => {
    if (!this.enabled || this.mode !== 'first' || !this.locked) return;
    if (performance.now() - this.touchTapAt < 600) return;
    this.onTap?.();
  };

  private onJoystickDown = (event: PointerEvent) => {
    if (!this.enabled || this.mode !== 'first') return;
    event.preventDefault();
    event.stopPropagation();
    this.joystickPointer = event.pointerId;
    this.joystick?.setPointerCapture?.(event.pointerId);
    this.updateJoystick(event);
  };

  private onJoystickMove = (event: PointerEvent) => {
    if (this.joystickPointer !== event.pointerId) return;
    event.preventDefault();
    this.updateJoystick(event);
  };

  private onJoystickUp = (event: PointerEvent) => {
    if (this.joystickPointer !== event.pointerId) return;
    this.joystickPointer = null;
    this.joystickValue = { x: 0, y: 0 };
    this.applyJoystickKnob();
  };

  private updateJoystick(event: PointerEvent) {
    if (!this.joystick) return;
    const rect = this.joystick.getBoundingClientRect();
    const radius = rect.width * 0.38;
    let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    this.joystickValue = { x, y };
    this.applyJoystickKnob();
  }

  private applyJoystickKnob() {
    if (!this.joystickKnob) return;
    const rect = this.joystick?.getBoundingClientRect();
    const radius = rect ? rect.width * 0.29 : 0;
    this.joystickKnob.style.transform = `translate(${this.joystickValue.x * radius}px, ${this.joystickValue.y * radius}px)`;
  }
}
