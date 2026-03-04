import * as THREE from 'three';

/**
 * Third-person controller with:
 * - Pointer lock mouse orbit
 * - WASD movement relative to camera direction
 * - Space to jump
 */
export class ThirdPersonControls {
  constructor(camera, canvas, playerBody) {
    this.camera = camera;
    this.canvas = canvas;
    this.playerBody = playerBody;

    // Orbit parameters
    this.theta = 0;          // horizontal angle (radians)
    this.phi = Math.PI / 5;  // vertical angle (radians), 0 = top, PI/2 = horizon
    this.distance = 5;
    this.mouseSensitivity = 0.002;

    // Vertical angle clamp
    this.phiMin = 0.15;  // ~8.5 degrees from top
    this.phiMax = 1.35;  // ~77 degrees from top

    // Camera smoothing
    this.cameraTarget = new THREE.Vector3();
    this.cameraSmoothed = new THREE.Vector3();
    this.cameraLookTarget = new THREE.Vector3();
    this.smoothFactor = 8;

    // Camera offset from player center (look at chest/head height)
    this.targetOffset = new THREE.Vector3(0, 0.8, 0);

    // Input state
    this.keys = { w: false, a: false, s: false, d: false, space: false };
    this.moveSpeed = 4.0;
    this.jumpImpulse = 3.0;
    this.isLocked = false;

    // Reusable vectors
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();

    this._setupEvents();
  }

  _setupEvents() {
    // Pointer lock
    this.canvas.addEventListener('click', () => {
      if (!this.isLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      const prompt = document.getElementById('click-prompt');
      if (prompt) prompt.classList.toggle('hidden', this.isLocked);
    });

    // Mouse move
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.theta -= e.movementX * this.mouseSensitivity;
      this.phi = Math.max(
        this.phiMin,
        Math.min(this.phiMax, this.phi + e.movementY * this.mouseSensitivity)
      );
    });

    // Keyboard
    const onKey = (e, down) => {
      switch (e.code) {
        case 'KeyW': this.keys.w = down; break;
        case 'KeyA': this.keys.a = down; break;
        case 'KeyS': this.keys.s = down; break;
        case 'KeyD': this.keys.d = down; break;
        case 'Space': this.keys.space = down; e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
  }

  /**
   * Returns the movement direction in world space (normalized), or null if no input.
   */
  getMovementDirection() {
    // Camera forward projected onto XZ plane
    this._forward.set(
      -Math.sin(this.theta),
      0,
      -Math.cos(this.theta)
    ).normalize();

    this._right.set(
      this._forward.z, 0, -this._forward.x
    );

    this._moveDir.set(0, 0, 0);
    if (this.keys.w) this._moveDir.add(this._forward);
    if (this.keys.s) this._moveDir.sub(this._forward);
    if (this.keys.a) this._moveDir.sub(this._right);
    if (this.keys.d) this._moveDir.add(this._right);

    if (this._moveDir.lengthSq() < 0.001) return null;
    return this._moveDir.normalize();
  }

  /**
   * Update camera position based on orbit around the player.
   * Call after physics step, passing the player mesh position.
   */
  updateCamera(playerPosition, delta) {
    // Target = player position + offset
    this.cameraTarget.copy(playerPosition).add(this.targetOffset);

    // Smooth camera look target
    this.cameraLookTarget.lerp(this.cameraTarget, 1 - Math.exp(-this.smoothFactor * delta));

    // Spherical to cartesian offset
    const offsetX = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const offsetY = this.distance * Math.cos(this.phi);
    const offsetZ = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

    const desiredPos = new THREE.Vector3(
      this.cameraTarget.x + offsetX,
      this.cameraTarget.y + offsetY,
      this.cameraTarget.z + offsetZ
    );

    // Smooth camera position
    this.camera.position.lerp(desiredPos, 1 - Math.exp(-this.smoothFactor * delta));

    this.camera.lookAt(this.cameraLookTarget);
  }

  /**
   * Is the player trying to move?
   */
  get isMoving() {
    return this.keys.w || this.keys.a || this.keys.s || this.keys.d;
  }

  /**
   * Does the player want to jump?
   * Consumes the space press (returns true once per press).
   */
  consumeJump() {
    if (this.keys.space) {
      this.keys.space = false;
      return true;
    }
    return false;
  }
}
