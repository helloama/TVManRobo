import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Initialize Rapier and create the physics world.
 * Must call initPhysics() first (awaits WASM init).
 */

let world = null;

export async function initPhysics() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return world;
}

export function getWorld() {
  return world;
}

/**
 * Create a dynamic capsule body for the player.
 * Returns { rigidBody, collider }.
 */
export function createPlayerBody(spawnPos = { x: 0, y: 1.5, z: 2 }) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
    .lockRotations(); // prevent tipping

  const rigidBody = world.createRigidBody(bodyDesc);

  // Capsule: halfHeight along Y, radius
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.35, 0.25)
    .setFriction(0.5)
    .setRestitution(0.0);
  const collider = world.createCollider(colliderDesc, rigidBody);

  return { rigidBody, collider };
}

/**
 * Create static colliders for room geometry.
 * Supports two types:
 *   - { type: 'trimesh', vertices: Float32Array, indices: Uint32Array }
 *   - { position: {x,y,z}, size: {x,y,z} }  (cuboid, for room shell)
 */
export function createRoomColliders(colliderDefs) {
  for (const def of colliderDefs) {
    if (def.type === 'trimesh') {
      // Trimesh collider — vertices are already in world space, body at origin
      const bodyDesc = RAPIER.RigidBodyDesc.fixed();
      const body = world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.trimesh(
        def.vertices, def.indices
      ).setFriction(0.7);
      world.createCollider(colliderDesc, body);
    } else {
      // Cuboid collider — for room shell (floor, walls, ceiling)
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(def.position.x, def.position.y, def.position.z);
      const body = world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.cuboid(
        def.size.x, def.size.y, def.size.z
      ).setFriction(0.7);
      world.createCollider(colliderDesc, body);
    }
  }
}

/**
 * Step the physics world by one fixed timestep.
 */
export function stepPhysics() {
  if (world) {
    world.step();
  }
}

/**
 * Cast a ray downward from a position to detect ground contact.
 * Returns the distance to the ground, or null if nothing hit.
 */
export function castGroundRay(position, maxDistance = 1.2) {
  if (!world) return null;

  const ray = new RAPIER.Ray(
    { x: position.x, y: position.y, z: position.z },
    { x: 0, y: -1, z: 0 }
  );

  const hit = world.castRay(ray, maxDistance, true);
  if (hit) {
    return hit.timeOfImpact;
  }
  return null;
}
