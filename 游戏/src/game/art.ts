import type { AnimationMixer, Group, Mesh, Object3D } from 'three';
import type { CropId, EnemyId, GuardianId, TowerId } from './types';

export interface CropArt {
  group: Group;
  sway: Object3D;
}

export interface TowerArt {
  group: Group;
  spin: Object3D;
  orb: Mesh;
}

export interface EnemyArt {
  group: Group;
  visual: Group;
  legs: Object3D[];
  phase: number;
  mixer: AnimationMixer | null;
  head?: Object3D;
}

export interface GuardianArt {
  group: Group;
  /** Optional piece that can gently spin (rice halo, charm). */
  spin: Object3D;
}

export interface ArtProvider {
  crop(type: CropId, stage: number, mature: boolean): CropArt;
  tower(type: TowerId, level: 1 | 2 | 3): TowerArt;
  guardian(type: GuardianId, level: 1 | 2 | 3): GuardianArt;
  enemy(type: EnemyId): EnemyArt;
  readonly kind: 'procedural' | 'assets';
}
