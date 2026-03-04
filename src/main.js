import * as THREE from 'three';
import { createScene } from './scene.js';
import { setupLighting } from './lighting.js';
import { createRoom } from './room.js';
import { initPhysics, createPlayerBody, createRoomColliders, stepPhysics, castGroundRay } from './physics.js';
import { Player, PlayerState } from './player.js';
import { ThirdPersonControls } from './controls.js';
import { setupResizeHandler } from './utils.js';
import { GameStateManager, GamePhase } from './gameState.js';

async function main() {
  // ── Initialize physics (must await WASM) ───────────────────────
  await initPhysics();

  // ── Scene, renderer, camera ────────────────────────────────────
  const { scene, renderer, camera } = createScene();
  setupResizeHandler(renderer, camera);

  // ── Build the room (async — loads FBX model) ───────────────────
  const { colliderDefs, dimensions } = await createRoom(scene);
  createRoomColliders(colliderDefs);

  // ── Lighting (after room so we know dimensions) ────────────────
  setupLighting(scene, dimensions);

  // ── Adjust camera for room size ────────────────────────────────
  if (dimensions) {
    const maxDim = Math.max(dimensions.width, dimensions.depth);
    camera.far = maxDim * 4;
    camera.updateProjectionMatrix();
  }

  // ── Load player (hidden until intro reveals) ───────────────────
  const player = new Player(scene);
  await player.load();
  player.group.visible = false;
  window.__player = player; // TODO: remove debug global

  // ── Player physics body ────────────────────────────────────────
  // Spawn above resting height so the capsule settles cleanly onto the floor
  // Capsule rests at y≈0.6 (halfHeight 0.35 + radius 0.25); start higher to avoid clipping
  const spawnPos = { x: 0, y: 1.5, z: 3 };
  const { rigidBody } = createPlayerBody(spawnPos);
  player.setRigidBody(rigidBody);

  // ── Game State Manager ─────────────────────────────────────────
  const gsm = new GameStateManager(camera);
  let controls = null;

  gsm.onRevealPlayer = () => {
    player.group.visible = true;
    // Position player visually on the floor during intro (no physics yet)
    player.group.position.set(spawnPos.x, 0, spawnPos.z);
  };

  gsm.onGameplayStart = () => {
    player.group.visible = true;
    // Reset physics body to spawn position
    rigidBody.setTranslation(spawnPos, true);
    rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

    // Create controls on first gameplay entry
    if (!controls) {
      controls = new ThirdPersonControls(camera, renderer.domElement, rigidBody);
      // Initialise look target near player so camera doesn't jerk
      const lookInit = new THREE.Vector3(spawnPos.x, 0.8, spawnPos.z);
      controls.cameraLookTarget.copy(lookInit);
      controls.cameraTarget.copy(lookInit);
    }
  };

  // ── Transition: loading → title ────────────────────────────────
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.classList.add('hidden');
  gsm.setPhase(GamePhase.TITLE);

  // ── Game loop ──────────────────────────────────────────────────
  const clock = new THREE.Clock();

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = Math.min(clock.getDelta(), 0.05);

    if (gsm.phase === GamePhase.GAMEPLAY && controls) {
      // ── Full gameplay update ─────────────────────────────────
      const moveDir = controls.getMovementDirection();
      const playerPos = player.getPosition();
      const groundDist = castGroundRay(playerPos, 1.0);
      const isGrounded = groundDist !== null && groundDist < 0.7;

      player.applyMovement(moveDir, controls.moveSpeed, isGrounded);

      if (controls.consumeJump() && isGrounded) {
        player.jump(controls.jumpImpulse);
        player.setState(PlayerState.JUMPING);
      }

      if (isGrounded) {
        if (player.currentState === PlayerState.JUMPING || player.currentState === PlayerState.FALLING) {
          player.setState(moveDir ? PlayerState.WALKING : PlayerState.IDLE);
        } else if (moveDir) {
          player.setState(PlayerState.WALKING);
        } else {
          player.setState(PlayerState.IDLE);
        }
      } else {
        const vel = rigidBody.linvel();
        if (vel.y < -0.5 && player.currentState !== PlayerState.FALLING) {
          player.setState(PlayerState.FALLING);
        }
      }

      stepPhysics();
      player.syncFromPhysics();
      player.update(delta);

      const visualPos = player.group
        ? player.group.position.clone().setY(player.group.position.y + 0.5)
        : playerPos;
      controls.updateCamera(visualPos, delta);
    } else {
      // ── Menu / Title / Intro camera ──────────────────────────
      gsm.update(delta);

      // Keep player animation ticking if visible (idle during intro)
      if (player.group.visible) {
        player.update(delta);
      }
    }

    renderer.render(scene, camera);
  }

  gameLoop();
}

main().catch((err) => {
  console.error('Failed to start TVRoboPhetta:', err);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.innerHTML = `<div style="color:#ff6b6b; font-family: 'Fredoka', sans-serif;">Error: ${err.message}</div>`;
  }
});
