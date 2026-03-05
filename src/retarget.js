import * as THREE from 'three';

/**
 * Runtime animation retargeter with world-space bind-pose correction.
 *
 * Transfers animation between similarly named skeletons, correcting for
 * different bind orientations and optional hips translation scaling.
 */
export class RuntimeRetargeter {
  /**
   * @param {THREE.Object3D} sourceRoot
   * @param {THREE.Object3D} targetModel
   * @param {object} options
   */
  constructor(sourceRoot, targetModel, options = {}) {
    this.sourceRoot = sourceRoot;
    this.targetModel = targetModel;
    this.mixer = new THREE.AnimationMixer(this.sourceRoot);
    this.currentAction = null;

    this.options = {
      enableHipsTranslation: options.enableHipsTranslation ?? false,
      hipsBoneName: options.hipsBoneName ?? 'mixamorig:Hips',
      hipsScaleRatio: options.hipsScaleRatio ?? null,
    };

    const srcBones = {};
    sourceRoot.traverse((obj) => {
      if (!obj.isBone) return;
      const key = normalizeBoneName(obj.name);
      if (!srcBones[key]) srcBones[key] = obj;
    });

    const tgtBones = {};
    targetModel.traverse((obj) => {
      if (!obj.isBone) return;
      const key = normalizeBoneName(obj.name);
      if (!tgtBones[key]) tgtBones[key] = obj;
    });

    sourceRoot.updateMatrixWorld(true);
    targetModel.updateMatrixWorld(true);

    this.pairs = [];
    for (const key of Object.keys(srcBones)) {
      const src = srcBones[key];
      const tgt = tgtBones[key];
      if (!tgt) continue;

      // Local-space correction avoids parent world-order instability and
      // keeps mapped limbs from drifting/twisting frame-to-frame.
      const srcBindLocal = src.quaternion.clone();
      const tgtBindLocal = tgt.quaternion.clone();
      const srcBindInv = srcBindLocal.clone().invert();
      const depth = getBoneDepth(src);

      this.pairs.push({ src, tgt, srcBindInv, tgtBindLocal, depth });
    }
    this.pairs.sort((a, b) => a.depth - b.depth);

    this.hips = null;
    if (this.options.enableHipsTranslation) {
      const hipsName = this.options.hipsBoneName;
      const hipsKey = normalizeBoneName(hipsName);
      const srcHips = srcBones[hipsKey];
      const tgtHips = tgtBones[hipsKey];

      if (srcHips && tgtHips) {
        const srcBindLocal = srcHips.position.clone();
        const tgtBindLocal = tgtHips.position.clone();

        let scaleRatio = this.options.hipsScaleRatio;
        if (!(scaleRatio > 0)) {
          scaleRatio = estimateScaleRatio(srcBones, tgtBones, hipsKey);
        }

        this.hips = {
          src: srcHips,
          tgt: tgtHips,
          srcBindLocal,
          tgtBindLocal,
          scaleRatio: scaleRatio > 0 ? scaleRatio : 1,
        };
      }
    }

    this._desiredQ = new THREE.Quaternion();
    this._hipsDelta = new THREE.Vector3();

    this.sourceRoot.visible = false;

    console.log(
      `RuntimeRetargeter: ${this.pairs.length} bone pairs mapped` +
      (this.hips
        ? ` | hips translation enabled (scale=${this.hips.scaleRatio.toFixed(3)})`
        : ' | hips translation disabled')
    );
  }

  play(
    clip,
    { fadeTime = 0.2, loop = THREE.LoopRepeat, clampWhenFinished = false } = {}
  ) {
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeTime);
    }

    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.reset();
    this.currentAction.setLoop(loop);
    this.currentAction.clampWhenFinished = clampWhenFinished;
    this.currentAction.fadeIn(fadeTime).play();
  }

  update(delta) {
    if (!this.currentAction) return;

    this.mixer.update(delta);
    this.sourceRoot.updateMatrixWorld(true);

    for (const { src, tgt, srcBindInv, tgtBindLocal } of this.pairs) {
      // target = targetBind * (sourceBind^-1 * sourceCurrent)
      this._desiredQ.copy(srcBindInv).multiply(src.quaternion);
      this._desiredQ.premultiply(tgtBindLocal);
      tgt.quaternion.copy(this._desiredQ);
    }

    if (this.hips) {
      const { src, tgt, srcBindLocal, tgtBindLocal, scaleRatio } = this.hips;

      this._hipsDelta
        .copy(src.position)
        .sub(srcBindLocal)
        .multiplyScalar(scaleRatio);

      tgt.position.copy(tgtBindLocal).add(this._hipsDelta);
    }
  }
}

function estimateScaleRatio(srcBones, tgtBones, hipsName) {
  const srcHips = srcBones[hipsName];
  const tgtHips = tgtBones[hipsName];
  if (!srcHips || !tgtHips) return 1;

  const headKey = normalizeBoneName('mixamorig:Head');
  const srcHead = srcBones[headKey];
  const tgtHead = tgtBones[headKey];

  if (!srcHead || !tgtHead) return 1;

  const srcHipsPos = new THREE.Vector3();
  const srcHeadPos = new THREE.Vector3();
  const tgtHipsPos = new THREE.Vector3();
  const tgtHeadPos = new THREE.Vector3();

  srcHips.getWorldPosition(srcHipsPos);
  srcHead.getWorldPosition(srcHeadPos);
  tgtHips.getWorldPosition(tgtHipsPos);
  tgtHead.getWorldPosition(tgtHeadPos);

  const srcLen = srcHeadPos.distanceTo(srcHipsPos);
  const tgtLen = tgtHeadPos.distanceTo(tgtHipsPos);

  if (srcLen <= 1e-4 || tgtLen <= 1e-4) return 1;

  return tgtLen / srcLen;
}

function getBoneDepth(bone) {
  let depth = 0;
  let node = bone.parent;

  while (node) {
    if (node.isBone) {
      depth += 1;
    }
    node = node.parent;
  }

  return depth;
}

function normalizeBoneName(name) {
  if (!name) return '';
  return THREE.PropertyBinding.sanitizeNodeName(name);
}
