import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/**
 * Build Phetta's House — a Chibi-Robo style room where the tiny player
 * character (1 unit tall) explores an oversized room with furniture.
 *
 * Strategy:
 * 1. Load the FBX asset pack with a LoadingManager that redirects textures
 * 2. Auto-detect furniture scale from a reference object
 * 3. Extract individual named furniture pieces and place them in the room
 * 4. Build procedural room shell (floor, walls, ceiling) with textures
 * 5. Generate physics colliders for everything
 */

// ── Room dimensions (character = 1 unit tall) ─────────────────────
const ROOM = {
  width:  24,   // X axis
  height: 14,   // Y axis (ceiling)
  depth:  20,   // Z axis
  wallThick: 0.3,
};

// ── Furniture layout ──────────────────────────────────────────────
// Each entry: { find: 'MeshName', pos: [x, y, z], rotY: radians }
// Room center = origin, floor = y:0, walls at ±width/2 and ±depth/2
const HALF_W = ROOM.width / 2;
const HALF_D = ROOM.depth / 2;

const LAYOUT = [
  // === Back wall (Z negative) ===
  { find: 'bed_04',           pos: [-2,  0, -HALF_D + 2],  rotY: 0 },
  { find: 'Wardrobe',         pos: [-HALF_W + 2, 0, -HALF_D + 1.5], rotY: Math.PI / 2 },
  { find: 'Chest_drawers_04', pos: [HALF_W - 2, 0, -HALF_D + 1.5], rotY: Math.PI },

  // === Left wall (X negative) ===
  { find: 'Bookcase',         pos: [-HALF_W + 1.5, 0, -2], rotY: Math.PI / 2 },

  // === Right wall (X positive) ===
  { find: 'Desk_lamp',        pos: [HALF_W - 2, 0, -3],    rotY: -Math.PI / 2 },

  // === Center area ===
  { find: 'Table_01',         pos: [0, 0, 3],               rotY: 0 },
  { find: 'Chair',            pos: [2.5, 0, 5],             rotY: Math.PI },
  { find: 'Chair_01',         pos: [-2.5, 0, 5],            rotY: Math.PI },

  // === Front area (Z positive, camera side) ===
  { find: 'Armchair_03',      pos: [-7, 0, 6],              rotY: Math.PI / 4 },
  { find: 'Refrigerator',     pos: [HALF_W - 2, 0, 5],     rotY: Math.PI },

  // === Wall decorations ===
  { find: 'Painting_04',      pos: [0, 7, -HALF_D + 0.15], rotY: 0 },

  // === Ceiling ===
  { find: 'Ceiling_Fan',      pos: [0, ROOM.height - 0.5, 0], rotY: 0 },

  // === Small items ===
  { find: 'Lamp',             pos: [-5, 0, -HALF_D + 2],   rotY: 0 },
  { find: 'Phone',            pos: [HALF_W - 2, 0, -HALF_D + 1.5], rotY: 0 },
  { find: 'Radio',            pos: [-HALF_W + 1.5, 0, 4],  rotY: Math.PI / 2 },
  { find: 'Books_001',        pos: [-HALF_W + 1.5, 0, -4], rotY: 0 },
];

// ── Extract triangle mesh data from a Three.js object ────────────
// Returns { vertices: Float32Array, indices: Uint32Array } in world space
function extractTriMeshData(object) {
  const allVerts = [];
  const allIdx = [];
  let offset = 0;

  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    const geo = child.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr) return;

    const matrix = child.matrixWorld;
    const v = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      v.applyMatrix4(matrix);
      allVerts.push(v.x, v.y, v.z);
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        allIdx.push(geo.index.getX(i) + offset);
      }
    } else {
      // Non-indexed geometry — sequential triangles
      for (let i = 0; i < posAttr.count; i++) {
        allIdx.push(i + offset);
      }
    }

    offset += posAttr.count;
  });

  if (allVerts.length === 0) return null;

  return {
    vertices: new Float32Array(allVerts),
    indices: new Uint32Array(allIdx),
  };
}

// ── Main entry point ──────────────────────────────────────────────
export async function createRoom(scene) {
  // 1. Load FBX with texture path fixer
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    const fileName = url.split(/[/\\]/).pop();
    if (/\.(png|jpg|jpeg|tga|bmp)$/i.test(fileName)) {
      return `/models/Textures/${fileName}`;
    }
    return url;
  });

  const loader = new FBXLoader(manager);
  const fbx = await loader.loadAsync('/models/Models/Objects_Interior(Village)_Demo.fbx');

  // Fix shadows and color space on all meshes
  fbx.traverse(child => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }
  });

  // 2. Build name → object lookup (first occurrence of each name)
  const objMap = new Map();
  fbx.traverse(child => {
    if (child.name && !objMap.has(child.name)) {
      objMap.set(child.name, child);
    }
  });

  // Log available objects for debugging
  const meshNames = [];
  objMap.forEach((v, k) => { if (v.isMesh || v.isGroup) meshNames.push(k); });
  console.log(`FBX contains ${meshNames.length} named objects`);

  // 3. Determine furniture scale
  //    Find a reference object and compute scale so furniture is
  //    Chibi-Robo proportioned (table ≈ 5 units tall, character = 1 unit)
  const furnitureScale = computeFurnitureScale(objMap);
  console.log(`Furniture scale factor: ${furnitureScale.toFixed(4)}`);

  // 4. Create room group
  const roomGroup = new THREE.Group();
  roomGroup.name = 'PhettasHouse';

  // 5. Build room shell (floor, walls, ceiling)
  await buildRoomShell(roomGroup);

  // 6. Extract and place furniture (visual only first)
  const wrappers = [];
  let placed = 0;

  for (const entry of LAYOUT) {
    const original = objMap.get(entry.find);
    if (!original) {
      console.warn(`Furniture "${entry.find}" not found in FBX`);
      continue;
    }

    const result = extractAndPlace(original, entry, furnitureScale);
    if (result) {
      roomGroup.add(result.wrapper);
      wrappers.push(result.wrapper);
      placed++;
    }
  }

  console.log(`Placed ${placed}/${LAYOUT.length} furniture pieces`);

  // 7. Add to scene so world matrices are valid
  scene.add(roomGroup);
  roomGroup.updateMatrixWorld(true);

  // 8. Build collider defs — trimesh for furniture, cuboid for room shell
  const colliderDefs = [];

  // Furniture → trimesh colliders (actual mesh geometry)
  for (const wrapper of wrappers) {
    const meshData = extractTriMeshData(wrapper);
    if (meshData && meshData.vertices.length > 0) {
      colliderDefs.push({
        type: 'trimesh',
        vertices: meshData.vertices,
        indices: meshData.indices,
      });
    }
  }

  // Room shell → cuboid colliders
  addRoomColliders(colliderDefs);

  const dimensions = {
    width: ROOM.width,
    height: ROOM.height,
    depth: ROOM.depth,
  };

  console.log(`Room built: ${ROOM.width}x${ROOM.height}x${ROOM.depth}, ${colliderDefs.length} colliders (${wrappers.length} trimesh)`);

  // Expose for debugging
  window.__roomGroup = roomGroup;
  window.__colliderDefs = colliderDefs;
  window.__furnitureScale = furnitureScale;
  window.__objMap = objMap;

  return { roomGroup, colliderDefs, dimensions };
}

// ── Compute furniture scale ───────────────────────────────────────
function computeFurnitureScale(objMap) {
  // Try several reference objects to find one we can measure
  const refs = [
    { name: 'Table_01',    targetHeight: 5 },   // table ~5x character
    { name: 'Table',       targetHeight: 5 },
    { name: 'Chair',       targetHeight: 4 },   // chair ~4x character
    { name: 'Armchair_03', targetHeight: 4.5 },
    { name: 'bed_04',      targetHeight: 3.5 }, // bed frame ~3.5x character
    { name: 'Bookcase',    targetHeight: 8 },   // bookcase ~8x character
  ];

  for (const ref of refs) {
    const obj = objMap.get(ref.name);
    if (!obj) continue;

    const box = new THREE.Box3().setFromObject(obj);
    const rawHeight = box.max.y - box.min.y;
    if (rawHeight > 0.001) {
      console.log(`Scale reference: "${ref.name}" raw height=${rawHeight.toFixed(3)}, target=${ref.targetHeight}`);
      return ref.targetHeight / rawHeight;
    }
  }

  // Fallback: use the overall FBX bounding box
  console.warn('No reference object found, using fallback scale');
  return 0.1;
}

// ── Extract a single furniture piece and place it ─────────────────
function extractAndPlace(original, entry, scale) {
  try {
    const clone = original.clone(true);

    // Apply furniture scale
    clone.scale.multiplyScalar(scale);

    // Force matrix update so bounding box is correct
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);

    if (box.isEmpty()) return null;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Reposition clone: bottom-center at origin of wrapper
    clone.position.x -= center.x;
    clone.position.y -= box.min.y;
    clone.position.z -= center.z;

    // Wrapper group for room placement
    const wrapper = new THREE.Group();
    wrapper.name = `furniture_${entry.find}`;
    wrapper.position.set(entry.pos[0], entry.pos[1], entry.pos[2]);
    wrapper.rotation.y = entry.rotY || 0;
    wrapper.add(clone);

    // Ensure shadows on all child meshes
    wrapper.traverse(c => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });

    return { wrapper };
  } catch (err) {
    console.warn(`Failed to extract "${entry.find}":`, err.message);
    return null;
  }
}

// ── Build room shell (floor, walls, ceiling) ──────────────────────
async function buildRoomShell(roomGroup) {
  const texLoader = new THREE.TextureLoader();

  // Helper: load texture with tiling
  function loadTex(path, repeatX = 1, repeatY = 1) {
    const tex = texLoader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ── Floor ────────────────────────────────────────────────────────
  const floorMat = new THREE.MeshStandardMaterial({
    map: loadTex('/models/Textures/Wood.jpg', ROOM.width / 3, ROOM.depth / 3),
    roughness: 0.7,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  roomGroup.add(floor);

  // ── Ceiling ──────────────────────────────────────────────────────
  const ceilingMat = new THREE.MeshStandardMaterial({
    map: loadTex('/models/Textures/Concrete.jpg', ROOM.width / 4, ROOM.depth / 4),
    roughness: 0.9,
    metalness: 0.0,
  });
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    ceilingMat
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.height;
  ceiling.receiveShadow = true;
  ceiling.name = 'ceiling';
  roomGroup.add(ceiling);

  // ── Walls ────────────────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    map: loadTex('/models/Textures/WallpaperForties.jpg', ROOM.width / 4, ROOM.height / 4),
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Back wall (Z negative)
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    wallMat
  );
  backWall.position.set(0, ROOM.height / 2, -HALF_D);
  backWall.name = 'wall_back';
  backWall.receiveShadow = true;
  roomGroup.add(backWall);

  // Front wall (Z positive) — with doorway gap for camera
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    wallMat.clone()
  );
  frontWall.position.set(0, ROOM.height / 2, HALF_D);
  frontWall.rotation.y = Math.PI;
  frontWall.name = 'wall_front';
  frontWall.receiveShadow = true;
  frontWall.material.transparent = true;
  frontWall.material.opacity = 0.3; // semi-transparent so camera can see through
  roomGroup.add(frontWall);

  // Left wall (X negative)
  const leftWallMat = wallMat.clone();
  leftWallMat.map = loadTex('/models/Textures/WallpaperForties.jpg', ROOM.depth / 4, ROOM.height / 4);
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.depth, ROOM.height),
    leftWallMat
  );
  leftWall.position.set(-HALF_W, ROOM.height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.name = 'wall_left';
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  // Right wall (X positive)
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.depth, ROOM.height),
    leftWallMat.clone()
  );
  rightWall.position.set(HALF_W, ROOM.height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.name = 'wall_right';
  rightWall.receiveShadow = true;
  roomGroup.add(rightWall);

  // ── Baseboard trim (adds visual detail) ──────────────────────────
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x8B7355,
    roughness: 0.6,
    metalness: 0.1,
  });
  const trimHeight = 0.4;
  const trimDepth = 0.08;

  // Back baseboard
  const trimBack = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.width, trimHeight, trimDepth),
    trimMat
  );
  trimBack.position.set(0, trimHeight / 2, -HALF_D + trimDepth / 2);
  trimBack.receiveShadow = true;
  roomGroup.add(trimBack);

  // Left baseboard
  const trimLeft = new THREE.Mesh(
    new THREE.BoxGeometry(trimDepth, trimHeight, ROOM.depth),
    trimMat
  );
  trimLeft.position.set(-HALF_W + trimDepth / 2, trimHeight / 2, 0);
  trimLeft.receiveShadow = true;
  roomGroup.add(trimLeft);

  // Right baseboard
  const trimRight = new THREE.Mesh(
    new THREE.BoxGeometry(trimDepth, trimHeight, ROOM.depth),
    trimMat
  );
  trimRight.position.set(HALF_W - trimDepth / 2, trimHeight / 2, 0);
  trimRight.receiveShadow = true;
  roomGroup.add(trimRight);
}

// ── Room physics colliders ────────────────────────────────────────
function addRoomColliders(colliderDefs) {
  const T = ROOM.wallThick;

  // Floor
  colliderDefs.push({
    position: { x: 0, y: -T / 2, z: 0 },
    size: { x: HALF_W, y: T / 2, z: HALF_D },
  });

  // Ceiling
  colliderDefs.push({
    position: { x: 0, y: ROOM.height + T / 2, z: 0 },
    size: { x: HALF_W, y: T / 2, z: HALF_D },
  });

  // Back wall
  colliderDefs.push({
    position: { x: 0, y: ROOM.height / 2, z: -HALF_D - T / 2 },
    size: { x: HALF_W, y: ROOM.height / 2, z: T / 2 },
  });

  // Front wall
  colliderDefs.push({
    position: { x: 0, y: ROOM.height / 2, z: HALF_D + T / 2 },
    size: { x: HALF_W, y: ROOM.height / 2, z: T / 2 },
  });

  // Left wall
  colliderDefs.push({
    position: { x: -HALF_W - T / 2, y: ROOM.height / 2, z: 0 },
    size: { x: T / 2, y: ROOM.height / 2, z: HALF_D },
  });

  // Right wall
  colliderDefs.push({
    position: { x: HALF_W + T / 2, y: ROOM.height / 2, z: 0 },
    size: { x: T / 2, y: ROOM.height / 2, z: HALF_D },
  });
}
