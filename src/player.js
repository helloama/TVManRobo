import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RuntimeRetargeter } from './retarget.js';

// Animation state enum
export const PlayerState = {
  IDLE: 'idle',
  WALKING: 'walk',
  JUMPING: 'jump',
  FALLING: 'fall',
};

// GLB animation files — Mixamo-rigged from a different source character
const ANIM_FILES = {
  idle: '/models/animations/idle.glb',
  walk: '/models/animations/walk.glb',
  run:  '/models/animations/run.glb',
  jump: '/models/animations/jump.glb',
  fall: '/models/animations/fall.glb',
};

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.retargeter = null;
    this.clips = {};             // { idle: clip, walk: clip, ... }
    this.currentState = PlayerState.IDLE;
    this.rigidBody = null;
    this.targetRotationY = 0;
    this.rotationSpeed = 10;
  }

  async load() {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const gltf = await gltfLoader.loadAsync('/models/tvmanwelcomenpc-v1.glb');
    this.model = gltf.scene;
    this.model.name = 'TVMan';

    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Auto-scale to ~1.0 unit tall
    const box = new THREE.Box3().setFromObject(this.model);
    const height = box.max.y - box.min.y;
    if (height > 0) this.model.scale.setScalar(1.0 / height);

    // Feet at y=0
    const scaledBox = new THREE.Box3().setFromObject(this.model);
    this.model.position.y = -scaledBox.min.y;

    // Flip to face away from camera (-Z forward)
    this.model.rotation.y = Math.PI;

    // Wrap in group for physics alignment
    this.group = new THREE.Group();
    this.group.add(this.model);
    this.scene.add(this.group);

    // Load animations and set up retargeter
    await this._loadAnimations(gltfLoader);

    // Start idle
    if (this.clips.idle && this.retargeter) {
      this.retargeter.play(this.clips.idle, { fadeTime: 0 });
    }

    console.log('TV Man loaded. Animation slots:', Object.keys(this.clips).join(', ') || 'none');

    dracoLoader.dispose();
    return this.group;
  }

  async _loadAnimations(loader) {
    // Load all GLBs — the first one provides the source skeleton for retargeting
    let sourceScene = null;

    for (const [slot, path] of Object.entries(ANIM_FILES)) {
      try {
        const gltf = await loader.loadAsync(path);

        // Use first loaded GLB's scene as source skeleton
        if (!sourceScene) {
          sourceScene = gltf.scene;
        }

        if (gltf.animations.length > 0) {
          const clip = gltf.animations[0];
          clip.name = slot; // Unique name to avoid mixer dedup

          if (clip.duration < 0.01) {
            console.warn(`  Skipped ${slot} — static pose`);
            continue;
          }

          this.clips[slot] = clip;
          console.log(`  Loaded ${slot} (${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks)`);
        }
      } catch (err) {
        console.warn(`Could not load ${slot}: ${err.message}`);
      }
    }

    // Fallback: use fall clip for jump if jump is missing
    if (!this.clips.jump && this.clips.fall) {
      const jumpClip = this.clips.fall.clone();
      jumpClip.name = 'jump';
      this.clips.jump = jumpClip;
      console.log('  Using fall → jump fallback');
    }

    // Create retargeter: source skeleton (from GLB) → target model
    if (sourceScene && this.model) {
      this.scene.add(sourceScene);
      this.retargeter = new RuntimeRetargeter(sourceScene, this.model);
    }
  }

  setState(newState) {
    if (newState === this.currentState) return;
    if (!this.retargeter) return;

    const clip = this.clips[newState];
    if (!clip) return;

    const opts = {};
    if (newState === PlayerState.JUMPING) {
      opts.loop = THREE.LoopOnce;
      opts.clampWhenFinished = true;
    }
    this.retargeter.play(clip, opts);
    this.currentState = newState;
  }

  setRigidBody(rigidBody) {
    this.rigidBody = rigidBody;
  }

  applyMovement(direction, speed, isGrounded) {
    if (!this.rigidBody) return;

    const vel = this.rigidBody.linvel();

    if (direction) {
      this.targetRotationY = Math.atan2(-direction.x, -direction.z);
      this.rigidBody.setLinvel(
        { x: direction.x * speed, y: vel.y, z: direction.z * speed },
        true
      );
    } else {
      this.rigidBody.setLinvel(
        { x: vel.x * 0.85, y: vel.y, z: vel.z * 0.85 },
        true
      );
    }
  }

  jump(impulse) {
    if (!this.rigidBody) return;
    this.rigidBody.applyImpulse({ x: 0, y: impulse, z: 0 }, true);
  }

  syncFromPhysics() {
    if (!this.rigidBody || !this.group) return;
    const pos = this.rigidBody.translation();
    this.group.position.set(pos.x, pos.y - 0.6, pos.z);
  }

  update(delta) {
    // Smooth rotation toward target
    if (this.group) {
      let currentY = this.group.rotation.y;
      let diff = this.targetRotationY - currentY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, this.rotationSpeed * delta);
    }

    // Advance animation + retarget
    if (this.retargeter) {
      this.retargeter.update(delta);
    }
  }

  getPosition() {
    if (this.rigidBody) {
      const t = this.rigidBody.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    }
    return this.group ? this.group.position.clone() : new THREE.Vector3();
  }
}
