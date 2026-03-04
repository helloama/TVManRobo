import * as THREE from 'three';

/**
 * Runtime animation retargeter with world-space bind-pose correction.
 *
 * Transfers animations between two Mixamo-rigged skeletons that share bone names
 * but may have different bind poses / parent chain orientations.
 *
 *   Q_desired_world = Q_src_animated_world * inv(Q_src_bind_world) * Q_tgt_bind_world
 *   Q_local = inv(Q_parent_world) * Q_desired_world
 */
export class RuntimeRetargeter {
  /**
   * @param {THREE.Object3D} sourceRoot - Source skeleton (from GLB anim file)
   * @param {THREE.Object3D} targetModel - Target model (player character)
   */
  constructor(sourceRoot, targetModel) {
    this.sourceRoot = sourceRoot;
    this.targetModel = targetModel;
    this.mixer = new THREE.AnimationMixer(this.sourceRoot);
    this.currentAction = null;

    // Build bone lookups (by name, matching between source and target)
    const srcBones = {};
    sourceRoot.traverse(obj => { if (obj.isBone) srcBones[obj.name] = obj; });

    const tgtBones = {};
    targetModel.traverse(obj => { if (obj.isBone) tgtBones[obj.name] = obj; });

    // Ensure world matrices are up to date for bind-pose capture
    sourceRoot.updateMatrixWorld(true);
    targetModel.updateMatrixWorld(true);

    // Build bone pairs with world-space bind-pose correction
    this.pairs = [];
    for (const name of Object.keys(srcBones)) {
      const src = srcBones[name];
      const tgt = tgtBones[name];
      if (!tgt) continue;

      // Capture world-space bind quaternions
      const srcBindWorld = new THREE.Quaternion();
      src.getWorldQuaternion(srcBindWorld);

      const tgtBindWorld = new THREE.Quaternion();
      tgt.getWorldQuaternion(tgtBindWorld);

      // correction = inv(srcBindWorld) * tgtBindWorld
      const correction = srcBindWorld.clone().invert().multiply(tgtBindWorld);

      this.pairs.push({ src, tgt, parent: tgt.parent, correction });
    }

    // Reusable temporaries
    this._worldQ = new THREE.Quaternion();
    this._desiredQ = new THREE.Quaternion();
    this._parentWorldQ = new THREE.Quaternion();

    // Hide source skeleton
    this.sourceRoot.visible = false;

    console.log(`RuntimeRetargeter: ${this.pairs.length} bone pairs mapped`);
  }

  /**
   * Play an animation clip on the source skeleton.
   */
  play(clip, { fadeTime = 0.2, loop = THREE.LoopRepeat, clampWhenFinished = false } = {}) {
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeTime);
    }
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.reset();
    this.currentAction.setLoop(loop);
    this.currentAction.clampWhenFinished = clampWhenFinished;
    this.currentAction.fadeIn(fadeTime).play();
  }

  /**
   * Advance source animation and copy world-space corrected rotations to target.
   */
  update(delta) {
    if (!this.currentAction) return;

    this.mixer.update(delta);
    this.sourceRoot.updateMatrixWorld(true);

    for (const { src, tgt, parent, correction } of this.pairs) {
      // 1. Animated source world quaternion
      src.getWorldQuaternion(this._worldQ);

      // 2. Apply correction: desiredWorld = srcAnimWorld * correction
      this._desiredQ.copy(this._worldQ).multiply(correction);

      // 3. Convert to target local space
      if (parent) {
        parent.getWorldQuaternion(this._parentWorldQ);
        tgt.quaternion.copy(this._parentWorldQ).invert().multiply(this._desiredQ);
      } else {
        tgt.quaternion.copy(this._desiredQ);
      }
    }
  }
}
