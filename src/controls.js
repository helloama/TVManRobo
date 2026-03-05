import * as THREE from 'three';

/**
 * Third-person controller with:
 * - Pointer lock mouse orbit
 * - WASD movement relative to camera direction
 * - Edge-triggered jump queue
 */
export class ThirdPersonControls {
  constructor(camera, canvas, playerBody) {
    this.camera = camera;
    this.canvas = canvas;
    this.playerBody = playerBody;

    // Orbit parameters
    this.theta = 0;
    this.phi = Math.PI / 4.4;
    this.distance = 3.85;
    this.mouseSensitivity = 0.00155;

    // Vertical angle clamp
    this.phiMin = 0.22;
    this.phiMax = 1.26;

    // Camera smoothing
    this.cameraTarget = new THREE.Vector3();
    this.cameraLookTarget = new THREE.Vector3();
    this.smoothFactor = 8.4;
    this.autoFollowSpeed = 4.8;
    this.lookInputCooldown = 0;
    this.lookInputCooldownDuration = 0.45;

    // Camera offset from player center (lower framing for tiny-character scale)
    this.targetOffset = new THREE.Vector3(0, 0.62, 0);

    // Camera collision
    this.cameraCollisionMeshes = [];
    this.cameraCollisionPadding = 0.22;
    this.cameraMinDistance = 1.75;
    this._raycaster = new THREE.Raycaster();
    this._desiredPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();

    // Input state
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
      e: false,
    };
    this.jumpQueued = false;
    this.interactQueued = false;
    this.primaryActionQueued = false;
    // Chibi-style movement profile.
    this.walkSpeed = 2.2;
    this.runSpeed = 3.5;
    this.moveSpeed = this.walkSpeed; // Backwards-compatible surface.
    this.jumpImpulse = 1.05;
    this.isLocked = false;
    this.enabled = true;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Reusable vectors
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._moveDir = new THREE.Vector3();
    this._moveDirNormalized = new THREE.Vector3();
    this._rawInputX = 0;
    this._rawInputZ = 0;
    this._inputMagnitude = 0;

    this._setupEvents();
  }

  _setupEvents() {
    this.canvas.addEventListener('click', () => {
      if (!this.isLocked && this.enabled) {
        try {
          this.canvas.requestPointerLock();
        } catch (_err) {
          // Some browser/embed contexts can reject pointer lock; drag-look fallback remains available.
        }
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button !== 0) return;
      this.primaryActionQueued = true;
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('blur', () => {
      this.isDragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      const prompt = document.getElementById('click-prompt');
      if (prompt) prompt.classList.toggle('hidden', this.isLocked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;

      if (this.isLocked) {
        this.lookInputCooldown = this.lookInputCooldownDuration;
        this.theta -= e.movementX * this.mouseSensitivity;
        this.phi = Math.max(
          this.phiMin,
          Math.min(this.phiMax, this.phi + e.movementY * this.mouseSensitivity)
        );
        return;
      }

      if (!this.isDragging) return;

      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      if (Math.abs(dx) + Math.abs(dy) > 0.01) {
        this.lookInputCooldown = this.lookInputCooldownDuration;
      }
      this.theta -= dx * (this.mouseSensitivity * 0.95);
      this.phi = Math.max(
        this.phiMin,
        Math.min(this.phiMax, this.phi + dy * (this.mouseSensitivity * 0.95))
      );
    });

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      switch (e.code) {
        case 'KeyW':
          this.keys.w = true;
          break;
        case 'KeyA':
          this.keys.a = true;
          break;
        case 'KeyS':
          this.keys.s = true;
          break;
        case 'KeyD':
          this.keys.d = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = true;
          break;
        case 'Space':
          this.keys.space = true;
          if (!e.repeat) this.jumpQueued = true;
          e.preventDefault();
          break;
        case 'KeyE':
          this.keys.e = true;
          if (!e.repeat) this.interactQueued = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
          this.keys.w = false;
          break;
        case 'KeyA':
          this.keys.a = false;
          break;
        case 'KeyS':
          this.keys.s = false;
          break;
        case 'KeyD':
          this.keys.d = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = false;
          break;
        case 'Space':
          this.keys.space = false;
          break;
        case 'KeyE':
          this.keys.e = false;
          break;
      }
    });
  }

  _refreshInputAxes() {
    let inputX = 0;
    let inputZ = 0;

    if (this.keys.a) inputX -= 1;
    if (this.keys.d) inputX += 1;
    if (this.keys.w) inputZ -= 1;
    if (this.keys.s) inputZ += 1;

    this._rawInputX = inputX;
    this._rawInputZ = inputZ;
    const len = Math.hypot(inputX, inputZ);
    this._inputMagnitude = Math.min(1, len);

    if (len > 1e-5) {
      this._moveDirNormalized.set(inputX / len, 0, inputZ / len);
    } else {
      this._moveDirNormalized.set(0, 0, 0);
    }
  }

  getMovementDirection() {
    if (!this.enabled) return null;
    this._refreshInputAxes();

    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    if (this._forward.lengthSq() < 1e-6) {
      this._forward.set(0, 0, -1);
    } else {
      this._forward.normalize();
    }
    this._right.crossVectors(this._forward, this._up);
    if (this._right.lengthSq() < 1e-6) {
      this._right.set(1, 0, 0);
    } else {
      this._right.normalize();
    }

    this._moveDir.set(0, 0, 0);
    this._moveDir
      .addScaledVector(this._right, this._moveDirNormalized.x)
      .addScaledVector(this._forward, -this._moveDirNormalized.z);

    if (this._moveDir.lengthSq() < 0.001) return null;
    return this._moveDir.normalize();
  }

  setCameraCollisionMeshes(meshes) {
    this.cameraCollisionMeshes = Array.isArray(meshes) ? meshes : [];
  }

  updateCamera(playerPosition, delta, moveDirection = null) {
    this.lookInputCooldown = Math.max(0, this.lookInputCooldown - delta);
    this.cameraTarget.copy(playerPosition).add(this.targetOffset);

    this.cameraLookTarget.lerp(
      this.cameraTarget,
      1 - Math.exp(-this.smoothFactor * delta)
    );

    // Auto-recenter behind movement direction when the player is moving and
    // not actively adjusting camera with mouse.
    if (
      moveDirection
      && moveDirection.lengthSq() > 0.0001
      && this.lookInputCooldown <= 0
      && this._inputMagnitude > 0.15
    ) {
      const targetTheta = Math.atan2(-moveDirection.x, -moveDirection.z);
      this.theta = dampAngle(this.theta, targetTheta, this.autoFollowSpeed, delta);
    }

    const offsetX = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const offsetY = this.distance * Math.cos(this.phi);
    const offsetZ = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

    this._desiredPos.set(
      this.cameraTarget.x + offsetX,
      this.cameraTarget.y + offsetY,
      this.cameraTarget.z + offsetZ
    );

    if (this.cameraCollisionMeshes.length > 0) {
      this._camDir.copy(this._desiredPos).sub(this.cameraLookTarget);
      const desiredDistance = this._camDir.length();

      if (desiredDistance > 0.001) {
        this._camDir.multiplyScalar(1 / desiredDistance);
        this._raycaster.set(this.cameraLookTarget, this._camDir);
        this._raycaster.far = desiredDistance;

        const hits = this._raycaster.intersectObjects(this.cameraCollisionMeshes, false);
        for (let i = 0; i < hits.length; i += 1) {
          const hit = hits[i];
          if (!hit.object?.visible) continue;
          if (hit.distance <= 0.02) continue;

          const correctedDistance = Math.max(
            this.cameraMinDistance,
            hit.distance - this.cameraCollisionPadding
          );
          if (correctedDistance < desiredDistance) {
            this._desiredPos.copy(this.cameraLookTarget).addScaledVector(
              this._camDir,
              correctedDistance
            );
          }
          break;
        }
      }
    }

    this.camera.position.lerp(
      this._desiredPos,
      1 - Math.exp(-this.smoothFactor * delta)
    );

    this.camera.lookAt(this.cameraLookTarget);
  }

  get isMoving() {
    this._refreshInputAxes();
    return this.enabled && this._inputMagnitude > 0.001;
  }

  get isRunning() {
    this._refreshInputAxes();
    return (
      this.enabled
      && this.keys.shift
      && this._inputMagnitude > 0.001
      && this._rawInputZ <= -0.12
    );
  }

  get isBackpedalIntent() {
    this._refreshInputAxes();
    return (
      this.enabled
      && this._inputMagnitude > 0.001
      && this._rawInputZ >= 0.22
      && !this.keys.w
    );
  }

  getMoveSpeed() {
    this._refreshInputAxes();

    let speed = this.isRunning ? this.runSpeed : this.walkSpeed;

    // Strafing and backpedal are intentionally slower to mimic
    // tighter toy-like movement.
    if (this.isBackpedalIntent) {
      speed *= 0.72;
    } else if (Math.abs(this._rawInputX) > 0.45 && Math.abs(this._rawInputZ) < 0.2) {
      speed *= 0.83;
    }

    this.moveSpeed = speed;
    return speed;
  }

  getClimbAxis() {
    if (!this.enabled) return 0;
    let axis = 0;
    if (this.keys.w) axis += 1;
    if (this.keys.s) axis -= 1;
    return axis;
  }

  get isJumpHeld() {
    return this.enabled && this.keys.space;
  }

  consumeJumpIntent() {
    if (!this.enabled) {
      this.jumpQueued = false;
      return false;
    }
    if (!this.jumpQueued) return false;
    this.jumpQueued = false;
    return true;
  }

  // Backwards-compatible alias used by older gameplay code paths.
  consumeJump() {
    return this.consumeJumpIntent();
  }

  consumeInteractIntent() {
    if (!this.enabled) {
      this.interactQueued = false;
      return false;
    }
    if (!this.interactQueued) return false;
    this.interactQueued = false;
    return true;
  }

  consumePrimaryActionIntent() {
    if (!this.enabled) {
      this.primaryActionQueued = false;
      return false;
    }
    if (!this.primaryActionQueued) return false;
    this.primaryActionQueued = false;
    return true;
  }

  setEnabled(enabled) {
    if (this.enabled === enabled) return;

    this.enabled = enabled;

    if (!enabled) {
      this.keys.w = false;
      this.keys.a = false;
      this.keys.s = false;
      this.keys.d = false;
      this.keys.shift = false;
      this.keys.space = false;
      this.keys.e = false;
      this.jumpQueued = false;
      this.interactQueued = false;
      this.primaryActionQueued = false;
      this.isDragging = false;
      this.lookInputCooldown = 0;
      this._rawInputX = 0;
      this._rawInputZ = 0;
      this._inputMagnitude = 0;
      this._moveDirNormalized.set(0, 0, 0);

      if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  }

  syncOrbitFromCamera(playerPosition) {
    const target = playerPosition.clone().add(this.targetOffset);
    const offset = this.camera.position.clone().sub(target);
    const dist = Math.max(offset.length(), 0.001);

    this.distance = THREE.MathUtils.clamp(dist, 2.8, 7.8);
    this.theta = Math.atan2(offset.x, offset.z);
    this.phi = Math.acos(THREE.MathUtils.clamp(offset.y / dist, -1, 1));
    this.phi = THREE.MathUtils.clamp(this.phi, this.phiMin, this.phiMax);

    this.cameraTarget.copy(target);
    this.cameraLookTarget.copy(target);
  }
}

function dampAngle(current, target, speed, delta) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-speed * delta));
}
