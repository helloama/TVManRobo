import * as THREE from 'three';

export class FirstPersonCameraMode {
  constructor({
    camera,
    canvas,
    getHeadPosition,
    onEnter = null,
    onExit = null,
  }) {
    this.camera = camera;
    this.canvas = canvas;
    this.getHeadPosition = getHeadPosition;
    this.onEnter = onEnter;
    this.onExit = onExit;

    this.active = false;
    this.transition = null;

    this.yaw = 0;
    this.pitch = 0;
    this.pitchMin = -1.25;
    this.pitchMax = 1.1;
    this.mouseSensitivity = 0.00175;
    this.lookSmoothing = 13;

    this._isPointerLocked = false;
    this._dragging = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;

    this._head = new THREE.Vector3();
    this._lookDir = new THREE.Vector3(0, 0, 1);
    this._desiredLook = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._initializedLook = false;

    this._bindEvents();
  }

  get isActive() {
    return this.active;
  }

  get isTransitioning() {
    return this.transition !== null;
  }

  _bindEvents() {
    document.addEventListener('pointerlockchange', () => {
      this._isPointerLocked = document.pointerLockElement === this.canvas;
    });

    this.canvas.addEventListener('mousedown', (event) => {
      if (!this.active || event.button !== 0) return;
      this._dragging = true;
      this._lastMouseX = event.clientX;
      this._lastMouseY = event.clientY;
    });

    window.addEventListener('mouseup', () => {
      this._dragging = false;
    });

    window.addEventListener('blur', () => {
      this._dragging = false;
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.active) return;

      if (this._isPointerLocked) {
        this._applyLookDelta(event.movementX, event.movementY);
        return;
      }

      if (!this._dragging) return;
      const dx = event.clientX - this._lastMouseX;
      const dy = event.clientY - this._lastMouseY;
      this._lastMouseX = event.clientX;
      this._lastMouseY = event.clientY;
      this._applyLookDelta(dx, dy);
    });
  }

  _applyLookDelta(dx, dy) {
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * this.mouseSensitivity,
      this.pitchMin,
      this.pitchMax
    );
  }

  _syncAnglesFromCamera() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(dir.y, -0.999, 0.999)),
      this.pitchMin,
      this.pitchMax
    );
  }

  _requestPointerLock() {
    if (!this.canvas?.requestPointerLock) return;
    try {
      this.canvas.requestPointerLock();
    } catch (_err) {
      // Drag fallback remains active when pointer lock is unavailable.
    }
  }

  _exitPointerLock() {
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  enter() {
    if (this.active || this.transition) return false;
    this.active = true;
    this._syncAnglesFromCamera();
    this._initializedLook = false;
    this._dragging = false;
    this._requestPointerLock();
    if (this.onEnter) this.onEnter();
    return true;
  }

  exitTo(targetPosition, targetLookAt, duration = 0.38) {
    if (!this.active) return false;
    this.active = false;
    this._dragging = false;
    this._exitPointerLock();
    if (this.onExit) this.onExit();

    if (targetPosition && targetLookAt) {
      const currentLook = this._lookTarget.clone();
      this.transition = {
        elapsed: 0,
        duration: Math.max(0.05, duration),
        fromPos: this.camera.position.clone(),
        toPos: targetPosition.clone(),
        fromLook: currentLook,
        toLook: targetLookAt.clone(),
      };
    } else {
      this.transition = null;
    }
    return true;
  }

  cancelTransition() {
    this.transition = null;
  }

  _updateTransition(delta) {
    if (!this.transition) return false;

    this.transition.elapsed += delta;
    const t = THREE.MathUtils.clamp(
      this.transition.elapsed / this.transition.duration,
      0,
      1
    );
    const eased = t < 0.5
      ? 2 * t * t
      : 1 - (Math.pow(-2 * t + 2, 2) / 2);

    this.camera.position.lerpVectors(
      this.transition.fromPos,
      this.transition.toPos,
      eased
    );
    this._lookTarget.lerpVectors(
      this.transition.fromLook,
      this.transition.toLook,
      eased
    );
    this.camera.lookAt(this._lookTarget);

    if (t >= 1) {
      this.transition = null;
      return true;
    }

    return false;
  }

  update(delta) {
    if (this.transition) {
      const done = this._updateTransition(delta);
      return done ? 'transition-complete' : 'transitioning';
    }

    if (!this.active) return 'inactive';

    if (!this.getHeadPosition) return 'inactive';
    this.getHeadPosition(this._head);
    this.camera.position.copy(this._head);

    const cosPitch = Math.cos(this.pitch);
    this._lookDir.set(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch
    ).normalize();

    this._desiredLook.copy(this._head).addScaledVector(this._lookDir, 4.0);

    if (!this._initializedLook) {
      this._lookTarget.copy(this._desiredLook);
      this._initializedLook = true;
    } else {
      this._lookTarget.lerp(
        this._desiredLook,
        1 - Math.exp(-this.lookSmoothing * delta)
      );
    }

    this.camera.lookAt(this._lookTarget);
    return 'active';
  }
}
