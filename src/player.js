import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { VRMLoaderPlugin, VRMHumanBoneName } from '@pixiv/three-vrm';

export const PlayerState = {
  IDLE: 'idle',
  WALKING: 'walk',
  RUNNING: 'run',
  JUMPING: 'jump',
  FALLING: 'fall',
  GLIDING: 'glide',
  SHUTDOWN: 'shutdown',
};

const PLAYER_VRM_FILE = '/models/slotmachinehjones.vrm';

const ANIM_FILES = {
  idle: '/models/animations/idle.glb',
  walk: '/models/animations/walk.glb',
  run: '/models/animations/run.glb',
  jump: '/models/animations/jump.glb',
  fall: '/models/animations/fall.glb',
  glide: '/models/animations/fall.glb',
};

const BONE_MAP_RAW = {
  hips: VRMHumanBoneName.Hips,
  spine: VRMHumanBoneName.Spine,
  spine1: VRMHumanBoneName.Chest,
  spine2: VRMHumanBoneName.UpperChest,
  chest: VRMHumanBoneName.Chest,
  upperchest: VRMHumanBoneName.UpperChest,
  neck: VRMHumanBoneName.Neck,
  head: VRMHumanBoneName.Head,
  leftshoulder: VRMHumanBoneName.LeftShoulder,
  leftarm: VRMHumanBoneName.LeftUpperArm,
  leftforearm: VRMHumanBoneName.LeftLowerArm,
  lefthand: VRMHumanBoneName.LeftHand,
  rightshoulder: VRMHumanBoneName.RightShoulder,
  rightarm: VRMHumanBoneName.RightUpperArm,
  rightforearm: VRMHumanBoneName.RightLowerArm,
  righthand: VRMHumanBoneName.RightHand,
  leftupleg: VRMHumanBoneName.LeftUpperLeg,
  leftleg: VRMHumanBoneName.LeftLowerLeg,
  leftfoot: VRMHumanBoneName.LeftFoot,
  lefttoebase: VRMHumanBoneName.LeftToes,
  rightupleg: VRMHumanBoneName.RightUpperLeg,
  rightleg: VRMHumanBoneName.RightLowerLeg,
  rightfoot: VRMHumanBoneName.RightFoot,
  righttoebase: VRMHumanBoneName.RightToes,
  mixamorighips: VRMHumanBoneName.Hips,
  mixamorigspine: VRMHumanBoneName.Spine,
  mixamorigspine1: VRMHumanBoneName.Chest,
  mixamorigspine2: VRMHumanBoneName.UpperChest,
  mixamorigneck: VRMHumanBoneName.Neck,
  mixamorighead: VRMHumanBoneName.Head,
  mixamorigleftshoulder: VRMHumanBoneName.LeftShoulder,
  mixamorigleftarm: VRMHumanBoneName.LeftUpperArm,
  mixamorigleftforearm: VRMHumanBoneName.LeftLowerArm,
  mixamoriglefthand: VRMHumanBoneName.LeftHand,
  mixamorigrightshoulder: VRMHumanBoneName.RightShoulder,
  mixamorigrightarm: VRMHumanBoneName.RightUpperArm,
  mixamorigrightforearm: VRMHumanBoneName.RightLowerArm,
  mixamorigrighthand: VRMHumanBoneName.RightHand,
  mixamorigleftupleg: VRMHumanBoneName.LeftUpperLeg,
  mixamorigleftleg: VRMHumanBoneName.LeftLowerLeg,
  mixamorigleftfoot: VRMHumanBoneName.LeftFoot,
  mixamoriglefttoebase: VRMHumanBoneName.LeftToes,
  mixamorigrightupleg: VRMHumanBoneName.RightUpperLeg,
  mixamorigrightleg: VRMHumanBoneName.RightLowerLeg,
  mixamorigrightfoot: VRMHumanBoneName.RightFoot,
  mixamorigrighttoebase: VRMHumanBoneName.RightToes,
  mixamoriglefthandthumb1: VRMHumanBoneName.LeftThumbMetacarpal,
  mixamoriglefthandthumb2: VRMHumanBoneName.LeftThumbProximal,
  mixamoriglefthandthumb3: VRMHumanBoneName.LeftThumbDistal,
  mixamoriglefthandindex1: VRMHumanBoneName.LeftIndexProximal,
  mixamoriglefthandindex2: VRMHumanBoneName.LeftIndexIntermediate,
  mixamoriglefthandindex3: VRMHumanBoneName.LeftIndexDistal,
  mixamoriglefthandmiddle1: VRMHumanBoneName.LeftMiddleProximal,
  mixamoriglefthandmiddle2: VRMHumanBoneName.LeftMiddleIntermediate,
  mixamoriglefthandmiddle3: VRMHumanBoneName.LeftMiddleDistal,
  mixamoriglefthandring1: VRMHumanBoneName.LeftRingProximal,
  mixamoriglefthandring2: VRMHumanBoneName.LeftRingIntermediate,
  mixamoriglefthandring3: VRMHumanBoneName.LeftRingDistal,
  mixamoriglefthandpinky1: VRMHumanBoneName.LeftLittleProximal,
  mixamoriglefthandpinky2: VRMHumanBoneName.LeftLittleIntermediate,
  mixamoriglefthandpinky3: VRMHumanBoneName.LeftLittleDistal,
  mixamorigrighthandthumb1: VRMHumanBoneName.RightThumbMetacarpal,
  mixamorigrighthandthumb2: VRMHumanBoneName.RightThumbProximal,
  mixamorigrighthandthumb3: VRMHumanBoneName.RightThumbDistal,
  mixamorigrighthandindex1: VRMHumanBoneName.RightIndexProximal,
  mixamorigrighthandindex2: VRMHumanBoneName.RightIndexIntermediate,
  mixamorigrighthandindex3: VRMHumanBoneName.RightIndexDistal,
  mixamorigrighthandmiddle1: VRMHumanBoneName.RightMiddleProximal,
  mixamorigrighthandmiddle2: VRMHumanBoneName.RightMiddleIntermediate,
  mixamorigrighthandmiddle3: VRMHumanBoneName.RightMiddleDistal,
  mixamorigrighthandring1: VRMHumanBoneName.RightRingProximal,
  mixamorigrighthandring2: VRMHumanBoneName.RightRingIntermediate,
  mixamorigrighthandring3: VRMHumanBoneName.RightRingDistal,
  mixamorigrighthandpinky1: VRMHumanBoneName.RightLittleProximal,
  mixamorigrighthandpinky2: VRMHumanBoneName.RightLittleIntermediate,
  mixamorigrighthandpinky3: VRMHumanBoneName.RightLittleDistal,
  defhips: VRMHumanBoneName.Hips,
  defspine001: VRMHumanBoneName.Spine,
  defspine002: VRMHumanBoneName.Chest,
  defspine003: VRMHumanBoneName.UpperChest,
  defneck: VRMHumanBoneName.Neck,
  defhead: VRMHumanBoneName.Head,
  defshoulderl: VRMHumanBoneName.LeftShoulder,
  defupperarml: VRMHumanBoneName.LeftUpperArm,
  defforearml: VRMHumanBoneName.LeftLowerArm,
  defhandl: VRMHumanBoneName.LeftHand,
  defshoulderr: VRMHumanBoneName.RightShoulder,
  defupperarmr: VRMHumanBoneName.RightUpperArm,
  defforearmr: VRMHumanBoneName.RightLowerArm,
  defhandr: VRMHumanBoneName.RightHand,
  defthighl: VRMHumanBoneName.LeftUpperLeg,
  defshinl: VRMHumanBoneName.LeftLowerLeg,
  deffootl: VRMHumanBoneName.LeftFoot,
  deftoel: VRMHumanBoneName.LeftToes,
  defthighr: VRMHumanBoneName.RightUpperLeg,
  defshinr: VRMHumanBoneName.RightLowerLeg,
  deffootr: VRMHumanBoneName.RightFoot,
  deftoer: VRMHumanBoneName.RightToes,
};

const BONE_MAP = Object.freeze(
  Object.entries(BONE_MAP_RAW).reduce((acc, [key, value]) => {
    acc[normalizeBoneKey(key)] = value;
    return acc;
  }, {})
);

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.group = null;
    this.vrm = null;
    this.mixer = null;
    this.currentAction = null;
    this.clips = {};
    this.currentState = PlayerState.IDLE;
    this.rigidBody = null;
    this.targetRotationY = 0;
    this.rotationSpeed = 10;
    this.groundAcceleration = 13.5;
    this.groundDeceleration = 17.5;
    this.airControlFactor = 0.45;
    this.backpedalStartDot = -0.34;
    this.backpedalEndDot = -0.1;
    this.backpedalSpeedMultiplier = 0.78;
    this.isBackpedaling = false;
    // Match 3DPVP lobby orientation flow (group yaw + PI, model yaw + PI).
    this.visualYawOffset = Math.PI;
  }

  async load() {
    const vrmLoader = new GLTFLoader();
    vrmLoader.register((parser) => new VRMLoaderPlugin(parser));

    const vrmGltf = await vrmLoader.loadAsync(PLAYER_VRM_FILE);
    this.vrm = vrmGltf.userData.vrm;
    if (!this.vrm) {
      throw new Error(`VRM not found in ${PLAYER_VRM_FILE}`);
    }

    this.model = this.vrm.scene;
    this.model.name = 'SlotMachineJones';
    this.model.rotation.y = Math.PI;

    this.model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    });
    this.model.frustumCulled = false;

    const box = new THREE.Box3().setFromObject(this.model);
    const height = box.max.y - box.min.y;
    if (height > 0) this.model.scale.setScalar(1.0 / height);

    const scaledBox = new THREE.Box3().setFromObject(this.model);
    this.model.position.y = -scaledBox.min.y;

    this.group = new THREE.Group();
    this.group.add(this.model);
    this.group.rotation.y = this.visualYawOffset;
    this.scene.add(this.group);

    const animLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    animLoader.setDRACOLoader(dracoLoader);

    await this._loadAnimations(animLoader);

    if (this.clips.idle && this.mixer) {
      this._playClip(this.clips.idle, { fadeTime: 0 });
    }

    console.log(
      'SlotMachineJones loaded. Animation slots:',
      Object.keys(this.clips).join(', ') || 'none'
    );

    dracoLoader.dispose();
    return this.group;
  }

  async _loadAnimations(loader) {
    if (!this.model || !this.vrm) return;

    const loaded = {};
    this.mixer = new THREE.AnimationMixer(this.model);

    for (const [slot, path] of Object.entries(ANIM_FILES)) {
      try {
        const gltf = await loader.loadAsync(path);
        const rawClip = gltf.animations[0];
        if (!rawClip) {
          console.warn(`Animation ${slot} missing clip`);
          continue;
        }

        const retargeted = retargetClipToVRM(rawClip, gltf, this.vrm);
        if (!retargeted) {
          console.warn(`Animation ${slot} produced no valid retargeted tracks`);
          continue;
        }

        if (retargeted.duration < 0.1 || retargeted.tracks.length < 8) {
          console.warn(
            `Animation ${slot} rejected: duration=${retargeted.duration.toFixed(3)} tracks=${retargeted.tracks.length}`
          );
          continue;
        }

        retargeted.name = slot;
        loaded[slot] = retargeted;

        console.log(
          `Loaded ${slot} | duration=${retargeted.duration.toFixed(2)}s tracks=${retargeted.tracks.length}`
        );
      } catch (err) {
        console.warn(`Could not load ${slot}: ${err.message}`);
      }
    }

    this.clips = resolveClipSet(loaded);

    if (!this.clips.jump) {
      console.warn('No jump-capable clip found; falling back to idle for jump state');
      this.clips.jump = this.clips.idle;
    }
  }

  setState(newState) {
    if (newState === this.currentState) return;
    if (!this.mixer) return;

    const clip = this.clips[newState] || this.clips.idle;
    if (!clip) return;

    const fadeByState = {
      [PlayerState.IDLE]: 0.16,
      [PlayerState.WALKING]: 0.12,
      [PlayerState.RUNNING]: 0.1,
      [PlayerState.JUMPING]: 0.12,
      [PlayerState.FALLING]: 0.18,
      [PlayerState.GLIDING]: 0.14,
      [PlayerState.SHUTDOWN]: 0.15,
    };

    const opts = {
      fadeTime: fadeByState[newState] ?? 0.15,
    };

    if (newState === PlayerState.JUMPING || newState === PlayerState.SHUTDOWN) {
      opts.loop = THREE.LoopOnce;
      opts.clampWhenFinished = true;
    }

    this._playClip(clip, opts);
    this.currentState = newState;
  }

  _playClip(
    clip,
    { fadeTime = 0.2, loop = THREE.LoopRepeat, clampWhenFinished = false } = {}
  ) {
    if (!this.mixer || !clip) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(fadeTime);
    }

    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.reset();
    this.currentAction.setLoop(loop);
    this.currentAction.clampWhenFinished = clampWhenFinished;
    this.currentAction.fadeIn(fadeTime).play();
  }

  setRigidBody(rigidBody) {
    this.rigidBody = rigidBody;
  }

  applyMovement(
    direction,
    speed,
    delta = 1 / 60,
    { grounded = true, backpedalIntent = false, airControlMultiplier = 1 } = {}
  ) {
    if (!this.rigidBody) return;

    const vel = this.rigidBody.linvel();
    const controlFactor = grounded
      ? 1
      : this.airControlFactor * Math.max(0.1, airControlMultiplier);

    if (direction) {
      const facingYaw = this.group
        ? (this.group.rotation.y - this.visualYawOffset)
        : this.targetRotationY;
      const facingX = -Math.sin(facingYaw);
      const facingZ = -Math.cos(facingYaw);
      const moveDot = (facingX * direction.x) + (facingZ * direction.z);

      if (this.isBackpedaling) {
        if (moveDot > this.backpedalEndDot || !backpedalIntent) {
          this.isBackpedaling = false;
        }
      } else if (moveDot < this.backpedalStartDot && backpedalIntent) {
        this.isBackpedaling = true;
      }

      if (!this.isBackpedaling) {
        this.targetRotationY = Math.atan2(-direction.x, -direction.z);
      }

      const speedScale = this.isBackpedaling ? this.backpedalSpeedMultiplier : 1;
      const targetX = direction.x * speed * speedScale;
      const targetZ = direction.z * speed * speedScale;
      const blend = 1 - Math.exp(-(this.groundAcceleration * controlFactor) * delta);
      const nextX = THREE.MathUtils.lerp(vel.x, targetX, blend);
      const nextZ = THREE.MathUtils.lerp(vel.z, targetZ, blend);

      this.rigidBody.setLinvel(
        { x: nextX, y: vel.y, z: nextZ },
        true
      );
    } else {
      this.isBackpedaling = false;
      const blend = 1 - Math.exp(-(this.groundDeceleration * controlFactor) * delta);
      const nextX = THREE.MathUtils.lerp(vel.x, 0, blend);
      const nextZ = THREE.MathUtils.lerp(vel.z, 0, blend);
      this.rigidBody.setLinvel(
        {
          x: Math.abs(nextX) < 0.01 ? 0 : nextX,
          y: vel.y,
          z: Math.abs(nextZ) < 0.01 ? 0 : nextZ,
        },
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
    if (this.group) {
      const desiredY = this.targetRotationY + this.visualYawOffset;
      const currentY = this.group.rotation.y;
      let diff = desiredY - currentY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnSpeed = this.currentState === PlayerState.RUNNING
        ? this.rotationSpeed * 1.16
        : this.rotationSpeed;
      this.group.rotation.y += diff * Math.min(1, turnSpeed * delta);
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }

    if (this.vrm) {
      this.vrm.update(Math.min(delta, 0.1));
    }
  }

  getPosition() {
    if (this.rigidBody) {
      const t = this.rigidBody.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    }
    return this.group ? this.group.position.clone() : new THREE.Vector3();
  }

  getHeadWorldPosition(out = new THREE.Vector3()) {
    if (!this.group) return out.set(0, 1.2, 0);

    const headNode = this.vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head)
      || this.vrm?.humanoid?.getRawBoneNode(VRMHumanBoneName.Head);
    if (headNode) {
      headNode.getWorldPosition(out);
      out.y -= 0.03;
      return out;
    }

    this.group.getWorldPosition(out);
    out.y += 1.1;
    return out;
  }

  setVisualVisible(visible) {
    if (!this.model) return;
    this.model.visible = visible;
  }

  getCarryAnchorNode() {
    if (!this.vrm) return this.model || this.group || null;

    const head = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head)
      || this.vrm.humanoid?.getRawBoneNode(VRMHumanBoneName.Head);
    if (head) return head;

    const rightHand = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightHand)
      || this.vrm.humanoid?.getRawBoneNode(VRMHumanBoneName.RightHand);
    if (rightHand) return rightHand;

    return this.model || this.group || null;
  }

  getForwardVector(out = new THREE.Vector3()) {
    if (!this.group) return out.set(0, 0, -1);
    const yaw = this.group.rotation.y - this.visualYawOffset;
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  }
}

function retargetClipToVRM(clip, gltf, vrm) {
  const tracks = [];
  const restRotInv = new THREE.Quaternion();
  const parentRestWorld = new THREE.Quaternion();
  const tmpQuat = new THREE.Quaternion();

  const sourceNodeMap = buildNormalizedNodeMap(gltf.scene);

  let motionHipsHeight = 1;
  for (const name of ['mixamorigHips', 'mixamorig:Hips', 'Hips', 'hips', 'DEF-hips', 'Root', 'root']) {
    const hips = findSourceNode(gltf.scene, sourceNodeMap, name);
    if (hips) {
      motionHipsHeight = Math.max(0.001, Math.abs(hips.position.y));
      break;
    }
  }

  const vrmHipsY = vrm.humanoid?.normalizedRestPose?.hips?.position?.[1] ?? 1;
  const hipsPositionScale =
    Number.isFinite(vrmHipsY) && Number.isFinite(motionHipsHeight) && motionHipsHeight > 1e-4
      ? vrmHipsY / motionHipsHeight
      : 1;
  const isVRM0 = vrm.meta?.metaVersion === '0';

  for (const track of clip.tracks) {
    const parts = track.name.split('.');
    if (parts.length < 2) continue;

    const rigName = parts[0];
    const property = parts[1];
    if (property === 'scale') continue;

    const vrmBone = BONE_MAP[normalizeBoneKey(rigName)];
    if (!vrmBone) continue;

    const vrmNode = vrm.humanoid?.getNormalizedBoneNode(vrmBone);
    const rigNode = findSourceNode(gltf.scene, sourceNodeMap, rigName);
    if (!vrmNode || !rigNode) continue;

    const targetTrackName = `${vrmNode.name}.${property}`;
    rigNode.getWorldQuaternion(restRotInv).invert();
    if (rigNode.parent) {
      rigNode.parent.getWorldQuaternion(parentRestWorld);
    } else {
      parentRestWorld.identity();
    }

    if (track instanceof THREE.QuaternionKeyframeTrack && property === 'quaternion') {
      const newValues = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i += 4) {
        tmpQuat.fromArray(track.values, i);
        tmpQuat.premultiply(parentRestWorld).multiply(restRotInv);
        tmpQuat.normalize();
        tmpQuat.toArray(newValues, i);
      }

      const finalValues = isVRM0
        ? newValues.map((v, i) => (i % 2 === 0 ? -v : v))
        : newValues;

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          targetTrackName,
          track.times,
          finalValues
        )
      );
      continue;
    }

    if (
      track instanceof THREE.VectorKeyframeTrack
      && property === 'position'
      && vrmBone === VRMHumanBoneName.Hips
    ) {
      const values = track.values.map((v, i) =>
        (isVRM0 && i % 3 !== 1 ? -v : v) * hipsPositionScale
      );
      tracks.push(new THREE.VectorKeyframeTrack(targetTrackName, track.times, values));
    }
  }

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function buildNormalizedNodeMap(root) {
  const map = new Map();
  root.traverse((obj) => {
    if (!obj.name) return;
    const key = normalizeBoneKey(obj.name);
    if (!key) return;

    const existing = map.get(key);
    // Prefer actual bones when names collide with helper objects/groups.
    if (!existing || (!existing.isBone && obj.isBone)) {
      map.set(key, obj);
    }
  });
  return map;
}

function findSourceNode(scene, normalizedMap, name) {
  const exact = scene.getObjectByName(name);
  if (exact?.isBone) return exact;

  const normalized = normalizedMap.get(normalizeBoneKey(name));
  if (normalized) return normalized;

  return exact ?? null;
}

function normalizeBoneKey(name) {
  return THREE.PropertyBinding
    .sanitizeNodeName(name || '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toLowerCase();
}

function resolveClipSet(loaded) {
  const resolve = (slot, order) => {
    if (loaded[slot]) return loaded[slot];
    for (const fallback of order) {
      if (loaded[fallback]) {
        console.warn(`Clip fallback: ${slot} -> ${fallback}`);
        return loaded[fallback];
      }
    }
    return null;
  };

  return {
    idle: resolve('idle', ['walk', 'run', 'fall']),
    walk: resolve('walk', ['run', 'idle']),
    run: resolve('run', ['walk', 'idle']),
    jump: resolve('jump', ['fall', 'idle']),
    fall: resolve('fall', ['jump', 'idle']),
    glide: resolve('glide', ['fall', 'jump', 'idle']),
    shutdown: resolve('shutdown', ['fall', 'idle', 'jump']),
  };
}
