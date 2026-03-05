import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { WORLD_LAYOUT_V2 } from './world/layoutConfig.js';
import { buildParkourPlatforms } from './world/parkourBuilder.js';

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

    for (let i = 0; i < posAttr.count; i += 1) {
      v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      v.applyMatrix4(matrix);
      allVerts.push(v.x, v.y, v.z);
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i += 1) {
        allIdx.push(geo.index.getX(i) + offset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 1) {
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

export async function createRoom(scene, layout = WORLD_LAYOUT_V2) {
  const room = layout.room;
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const furnitureLayout = layout.furnitureLayout || {};
  const furnitureAnchors = layout.furnitureAnchors || {};

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const fileName = url.split(/[/\\]/).pop();
    if (/\.(png|jpg|jpeg|tga|bmp)$/i.test(fileName)) {
      return `/models/Textures/${fileName}`;
    }
    return url;
  });

  const loader = new FBXLoader(manager);
  const fbx = await loader.loadAsync('/models/Models/Objects_Interior(Village)_Demo.fbx');

  fbx.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (mat?.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat?.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }
  });

  const objMap = new Map();
  fbx.traverse((child) => {
    if (!child.name) return;
    if (objMap.has(child.name)) return;
    objMap.set(child.name, child);
  });

  const furnitureScale = computeFurnitureScale(objMap, layout.scaleReferences || []);

  const roomGroup = new THREE.Group();
  roomGroup.name = 'PhettasHouseV2';

  await buildRoomShell(roomGroup, room, layout.shellAccents || []);
  const outlets = buildOutlets(roomGroup, layout.outlets || []);
  const stains = buildStains(roomGroup, layout.stains || []);
  const waters = buildWaters(roomGroup, layout.waters || []);
  const storyTriggers = buildStoryTriggers(roomGroup, layout.storyTriggers || []);
  const grabbables = buildGrabbables(roomGroup, layout.grabbables || []);
  const roomTransitions = buildRoomTransitions(layout.roomTransitions || []);
  const npcs = buildNpcs(roomGroup, layout.npcs || []);
  const {
    shopTerminals,
    colliderDefs: shopTerminalColliders,
  } = buildShopTerminals(roomGroup, layout.shopTerminals || []);
  const pushables = buildPushables(roomGroup, layout.pushables || []);
  const {
    climbables,
    colliderDefs: climbableColliderDefs,
  } = buildClimbables(roomGroup, layout.climbables || []);

  const wrappers = [];
  const placedFurniture = [];
  const adjustedFurniture = [];
  const skippedFurniture = [];
  let placed = 0;
  const missing = [];

  for (const entry of layout.furniture || []) {
    const resolvedEntry = resolveFurnitureEntry(entry, furnitureAnchors);
    const original = objMap.get(resolvedEntry.find);
    if (!original) {
      missing.push(resolvedEntry.find);
      continue;
    }

    const result = extractAndPlace(original, resolvedEntry, furnitureScale);
    if (!result) continue;

    const placement = resolvedEntry.locked
      ? evaluateLockedFurniturePlacement(result.wrapper, placedFurniture, {
        halfW,
        halfD,
        settings: furnitureLayout,
      })
      : resolveFurniturePlacement(
        result.wrapper,
        placedFurniture,
        {
          halfW,
          halfD,
          settings: furnitureLayout,
        }
      );

    const maxAcceptedOverlapArea = furnitureLayout.maxAcceptedOverlapArea ?? 0.03;
    const maxAcceptedBoundaryPenalty = furnitureLayout.maxAcceptedBoundaryPenalty ?? 0.12;
    if (
      placement.overlapArea > maxAcceptedOverlapArea
      || placement.boundaryPenalty > maxAcceptedBoundaryPenalty
    ) {
      skippedFurniture.push({
        name: resolvedEntry.find,
        overlapArea: placement.overlapArea,
        boundaryPenalty: placement.boundaryPenalty,
      });
      continue;
    }

    if (placement.distanceMoved > 0.05 || placement.overlapArea > 1e-3 || placement.boundaryPenalty > 1e-3) {
      adjustedFurniture.push({
        name: resolvedEntry.find,
        moved: placement.distanceMoved,
        overlapArea: placement.overlapArea,
        boundaryPenalty: placement.boundaryPenalty,
      });
    }

    result.wrapper.userData.colliderEnabled = resolvedEntry.collider !== false;
    result.wrapper.userData.furnitureAnchor = resolvedEntry.anchor || null;
    result.wrapper.userData.furnitureLocked = !!resolvedEntry.locked;
    roomGroup.add(result.wrapper);
    wrappers.push(result.wrapper);
    placedFurniture.push({
      name: resolvedEntry.find,
      box: placement.box.clone(),
    });
    placed += 1;
  }

  if (missing.length > 0) {
    const uniqueMissing = [...new Set(missing)];
    console.warn(`Missing furniture objects (${uniqueMissing.length}): ${uniqueMissing.join(', ')}`);
  }

  if (adjustedFurniture.length > 0) {
    const moved = adjustedFurniture.filter((item) => item.moved > 0.05).length;
    const unresolved = adjustedFurniture.filter((item) => item.overlapArea > 1e-3).length;
    console.warn(
      `Furniture layout auto-adjusted ${moved} items` +
      (unresolved > 0 ? ` | unresolved overlaps: ${unresolved}` : '')
    );
  }

  if (skippedFurniture.length > 0) {
    const skippedNames = skippedFurniture.map((item) => item.name);
    console.warn(`Skipped ${skippedFurniture.length} overlapping furniture items: ${skippedNames.join(', ')}`);
  }

  const {
    group: parkourGroup,
    colliderDefs: parkourColliderDefs,
    routeMarkers,
    platformCount,
  } = buildParkourPlatforms(layout.parkour);
  roomGroup.add(parkourGroup);

  const {
    items: decorItems,
    stats: decorStats,
  } = buildDecor(
    roomGroup,
    layout.decor || {},
    placedFurniture,
    parkourColliderDefs,
    {
      halfW,
      halfD,
      roomHeight: room.height,
    }
  );

  scene.add(roomGroup);
  roomGroup.updateMatrixWorld(true);

  const colliderDefs = [];

  for (const wrapper of wrappers) {
    if (!wrapper.userData.colliderEnabled) continue;

    const meshData = extractTriMeshData(wrapper);
    if (!meshData || meshData.vertices.length === 0) continue;

    colliderDefs.push({
      type: 'trimesh',
      vertices: meshData.vertices,
      indices: meshData.indices,
    });
  }

  addRoomColliders(colliderDefs, room, halfW, halfD);
  colliderDefs.push(...parkourColliderDefs);
  colliderDefs.push(...climbableColliderDefs);
  colliderDefs.push(...shopTerminalColliders);

  const dimensions = {
    width: room.width,
    height: room.height,
    depth: room.depth,
  };

  console.log(
    `Room built ${room.width}x${room.height}x${room.depth}` +
    ` | furniture ${placed}/${(layout.furniture || []).length}` +
    ` | parkour platforms ${platformCount}` +
    ` | decor props ${decorStats.totalPlaced}` +
    ` | colliders ${colliderDefs.length}`
  );

  window.__roomGroup = roomGroup;
  window.__colliderDefs = colliderDefs;
  window.__furnitureScale = furnitureScale;
  window.__routeMarkers = routeMarkers;
  window.__outlets = outlets;
  window.__stains = stains;
  window.__waters = waters;
  window.__climbables = climbables;
  window.__storyTriggers = storyTriggers;
  window.__npcs = npcs;
  window.__shopTerminals = shopTerminals;
  window.__pushables = pushables;
  window.__grabbables = grabbables;
  window.__roomTransitions = roomTransitions;
  window.__decorItems = decorItems;
  window.__parkourGroup = parkourGroup;

  return {
    roomGroup,
    colliderDefs,
    dimensions,
    routeMarkers,
    outlets,
    stains,
    waters,
    climbables,
    storyTriggers,
    npcs,
    shopTerminals,
    pushables,
    grabbables,
    roomTransitions,
    decorItems,
    parkourGroup,
  };
}

function computeFurnitureScale(objMap, refs) {
  const fallbackRefs = refs.length > 0
    ? refs
    : [
      { name: 'Table_01', targetHeight: 5 },
      { name: 'Table', targetHeight: 5 },
      { name: 'Chair', targetHeight: 4 },
      { name: 'Armchair_03', targetHeight: 4.5 },
      { name: 'bed_04', targetHeight: 3.5 },
      { name: 'Bookcase', targetHeight: 8 },
    ];

  for (const ref of fallbackRefs) {
    const obj = objMap.get(ref.name);
    if (!obj) continue;

    const box = new THREE.Box3().setFromObject(obj);
    const rawHeight = box.max.y - box.min.y;
    if (rawHeight <= 0.001) continue;

    const scale = ref.targetHeight / rawHeight;
    console.log(`Scale reference: "${ref.name}" raw=${rawHeight.toFixed(3)} target=${ref.targetHeight} => ${scale.toFixed(4)}`);
    return scale;
  }

  console.warn('No scale reference found; using fallback scale 0.1');
  return 0.1;
}

function extractAndPlace(original, entry, scale) {
  try {
    const clone = original.clone(true);

    clone.scale.multiplyScalar(scale * (entry.scale || 1));
    clone.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clone);
    if (box.isEmpty()) return null;

    const center = box.getCenter(new THREE.Vector3());

    clone.position.x -= center.x;
    clone.position.y -= box.min.y;
    clone.position.z -= center.z;

    const wrapper = new THREE.Group();
    wrapper.name = `furniture_${entry.find}`;
    wrapper.position.set(entry.pos[0], entry.pos[1], entry.pos[2]);
    wrapper.rotation.y = entry.rotY || 0;
    wrapper.add(clone);

    wrapper.traverse((c) => {
      if (!c.isMesh) return;
      c.castShadow = true;
      c.receiveShadow = true;
      c.userData.surface = inferSurfaceFromObjectName(entry.find);
    });

    return { wrapper };
  } catch (err) {
    console.warn(`Failed to place "${entry.find}": ${err.message}`);
    return null;
  }
}

function resolveFurnitureEntry(entry, anchorMap) {
  if (!entry) return entry;

  const resolved = {
    ...entry,
    pos: Array.isArray(entry.pos) ? [...entry.pos] : [0, 0, 0],
    rotY: entry.rotY || 0,
    locked: !!entry.locked,
  };

  if (entry.anchor) {
    const slot = anchorMap?.[entry.anchor];
    if (slot?.pos) {
      resolved.pos = [slot.pos[0], slot.pos[1] ?? resolved.pos[1], slot.pos[2]];
      if (typeof slot.rotY === 'number') {
        resolved.rotY = slot.rotY;
      }
      resolved.locked = slot.locked !== false;
    } else {
      console.warn(`Missing furniture anchor slot "${entry.anchor}" for "${entry.find}"`);
    }
  }

  return resolved;
}

function evaluateLockedFurniturePlacement(wrapper, placedFurniture, { halfW, halfD, settings }) {
  const cfg = {
    clearance: settings.clearance ?? 0.55,
    wallMargin: settings.wallMargin ?? 0.45,
    candidateStep: settings.candidateStep ?? 1.0,
    candidateRings: settings.candidateRings ?? 8,
    verticalOverlapThreshold: settings.verticalOverlapThreshold ?? 0.2,
  };
  const lockedPos = wrapper.position.clone();
  const evalResult = evaluateFurniturePlacement(
    wrapper,
    placedFurniture,
    lockedPos,
    lockedPos,
    {
      halfW,
      halfD,
      settings: cfg,
    }
  );

  return {
    box: evalResult.box,
    overlapArea: evalResult.overlapArea,
    boundaryPenalty: evalResult.boundaryPenalty,
    distanceMoved: 0,
  };
}

function resolveFurniturePlacement(wrapper, placedFurniture, { halfW, halfD, settings }) {
  wrapper.updateMatrixWorld(true);
  const originalPos = wrapper.position.clone();

  if (placedFurniture.length === 0) {
    const firstBox = new THREE.Box3().setFromObject(wrapper);
    return {
      box: firstBox,
      overlapArea: 0,
      boundaryPenalty: 0,
      distanceMoved: 0,
    };
  }

  const cfg = {
    clearance: settings.clearance ?? 0.55,
    wallMargin: settings.wallMargin ?? 0.45,
    candidateStep: settings.candidateStep ?? 1.0,
    candidateRings: settings.candidateRings ?? 8,
    verticalOverlapThreshold: settings.verticalOverlapThreshold ?? 0.2,
  };

  let best = evaluateFurniturePlacement(wrapper, placedFurniture, originalPos, originalPos, {
    halfW,
    halfD,
    settings: cfg,
  });
  const offsets = generatePlacementOffsets(cfg.candidateStep, cfg.candidateRings);

  for (let i = 1; i < offsets.length; i += 1) {
    const offset = offsets[i];
    const candidatePos = new THREE.Vector3(
      originalPos.x + offset.x,
      originalPos.y,
      originalPos.z + offset.y
    );
    const candidate = evaluateFurniturePlacement(wrapper, placedFurniture, candidatePos, originalPos, {
      halfW,
      halfD,
      settings: cfg,
    });

    if (candidate.score < best.score) {
      best = candidate;
    }

    if (best.overlapArea <= 1e-4 && best.boundaryPenalty <= 1e-4) {
      break;
    }
  }

  wrapper.position.copy(best.position);
  wrapper.updateMatrixWorld(true);
  best.box.setFromObject(wrapper);

  return {
    box: best.box,
    overlapArea: best.overlapArea,
    boundaryPenalty: best.boundaryPenalty,
    distanceMoved: best.distanceMoved,
  };
}

function evaluateFurniturePlacement(wrapper, placedFurniture, candidatePos, originalPos, { halfW, halfD, settings }) {
  wrapper.position.copy(candidatePos);
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(wrapper);
  const boundaryPenalty = computeBoundaryPenalty(box, halfW, halfD, settings.wallMargin);

  let overlapArea = 0;
  for (let i = 0; i < placedFurniture.length; i += 1) {
    overlapArea += computeFurnitureOverlapArea(
      box,
      placedFurniture[i].box,
      settings.clearance,
      settings.verticalOverlapThreshold
    );
  }

  const distanceMoved = Math.hypot(
    candidatePos.x - originalPos.x,
    candidatePos.z - originalPos.z
  );
  const score = overlapArea * 1000 + boundaryPenalty * 500 + distanceMoved;

  return {
    box,
    overlapArea,
    boundaryPenalty,
    distanceMoved,
    score,
    position: candidatePos.clone(),
  };
}

function computeFurnitureOverlapArea(a, b, clearance, verticalOverlapThreshold) {
  const yOverlap = axisOverlap(a.min.y, a.max.y, b.min.y, b.max.y, 0);
  if (yOverlap <= verticalOverlapThreshold) return 0;

  const inflate = Math.max(0, clearance) * 0.5;
  const xOverlap = axisOverlap(a.min.x - inflate, a.max.x + inflate, b.min.x - inflate, b.max.x + inflate, 0);
  if (xOverlap <= 0) return 0;

  const zOverlap = axisOverlap(a.min.z - inflate, a.max.z + inflate, b.min.z - inflate, b.max.z + inflate, 0);
  if (zOverlap <= 0) return 0;

  return xOverlap * zOverlap;
}

function axisOverlap(minA, maxA, minB, maxB, padding = 0) {
  const lo = Math.max(minA, minB) - padding;
  const hi = Math.min(maxA, maxB) + padding;
  return hi - lo;
}

function computeBoundaryPenalty(box, halfW, halfD, wallMargin) {
  const minX = -halfW + wallMargin;
  const maxX = halfW - wallMargin;
  const minZ = -halfD + wallMargin;
  const maxZ = halfD - wallMargin;

  let penalty = 0;
  if (box.min.x < minX) penalty += minX - box.min.x;
  if (box.max.x > maxX) penalty += box.max.x - maxX;
  if (box.min.z < minZ) penalty += minZ - box.min.z;
  if (box.max.z > maxZ) penalty += box.max.z - maxZ;

  return penalty;
}

function generatePlacementOffsets(step, rings) {
  const offsets = [new THREE.Vector2(0, 0)];

  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = ring * step;
    const pointCount = Math.max(6, ring * 6);
    for (let i = 0; i < pointCount; i += 1) {
      const a = (i / pointCount) * Math.PI * 2;
      offsets.push(new THREE.Vector2(
        Math.cos(a) * radius,
        Math.sin(a) * radius
      ));
    }
  }

  return offsets;
}

async function buildRoomShell(roomGroup, room, shellAccents) {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;

  const texLoader = new THREE.TextureLoader();

  const loadTex = (path, repeatX = 1, repeatY = 1) => {
    const tex = texLoader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const floorMat = new THREE.MeshStandardMaterial({
    map: loadTex('/models/Textures/Wood.jpg', room.width / 3, room.depth / 3),
    roughness: 0.72,
    metalness: 0.05,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  floor.userData.surface = 'wood';
  roomGroup.add(floor);

  const ceilingMat = new THREE.MeshStandardMaterial({
    map: loadTex('/models/Textures/Concrete.jpg', room.width / 5, room.depth / 5),
    roughness: 0.92,
    metalness: 0.02,
  });

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = room.height;
  ceiling.receiveShadow = true;
  ceiling.name = 'ceiling';
  ceiling.userData.surface = 'plaster';
  roomGroup.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({
    map: loadTex('/models/Textures/WallpaperForties.jpg', room.width / 5, room.height / 4),
    roughness: 0.82,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.height), wallMat);
  backWall.position.set(0, room.height / 2, -halfD);
  backWall.receiveShadow = true;
  backWall.name = 'wall_back';
  backWall.userData.surface = 'wall';
  roomGroup.add(backWall);

  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(room.width, room.height),
    wallMat.clone()
  );
  frontWall.position.set(0, room.height / 2, halfD);
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  frontWall.material.transparent = true;
  frontWall.material.opacity = 0.18;
  frontWall.name = 'wall_front';
  frontWall.userData.surface = 'wall';
  roomGroup.add(frontWall);

  const sideWallMat = wallMat.clone();
  sideWallMat.map = loadTex('/models/Textures/WallpaperForties.jpg', room.depth / 5, room.height / 4);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(room.depth, room.height), sideWallMat);
  leftWall.position.set(-halfW, room.height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  leftWall.name = 'wall_left';
  leftWall.userData.surface = 'wall';
  roomGroup.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(room.depth, room.height),
    sideWallMat.clone()
  );
  rightWall.position.set(halfW, room.height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  rightWall.name = 'wall_right';
  rightWall.userData.surface = 'wall';
  roomGroup.add(rightWall);

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x8b7355,
    roughness: 0.65,
    metalness: 0.06,
  });

  const trimHeight = 0.38;
  const trimDepth = 0.1;

  const trimBack = new THREE.Mesh(
    new THREE.BoxGeometry(room.width, trimHeight, trimDepth),
    trimMat
  );
  trimBack.position.set(0, trimHeight / 2, -halfD + trimDepth / 2);
  trimBack.receiveShadow = true;
  roomGroup.add(trimBack);

  const trimFront = new THREE.Mesh(
    new THREE.BoxGeometry(room.width, trimHeight, trimDepth),
    trimMat
  );
  trimFront.position.set(0, trimHeight / 2, halfD - trimDepth / 2);
  trimFront.receiveShadow = true;
  roomGroup.add(trimFront);

  const trimLeft = new THREE.Mesh(
    new THREE.BoxGeometry(trimDepth, trimHeight, room.depth),
    trimMat
  );
  trimLeft.position.set(-halfW + trimDepth / 2, trimHeight / 2, 0);
  trimLeft.receiveShadow = true;
  roomGroup.add(trimLeft);

  const trimRight = new THREE.Mesh(
    new THREE.BoxGeometry(trimDepth, trimHeight, room.depth),
    trimMat
  );
  trimRight.position.set(halfW - trimDepth / 2, trimHeight / 2, 0);
  trimRight.receiveShadow = true;
  roomGroup.add(trimRight);

  for (const accent of shellAccents) {
    if (accent.type === 'box') {
      const mat = new THREE.MeshStandardMaterial({
        color: accent.color ?? 0x707070,
        roughness: accent.roughness ?? 0.75,
        metalness: accent.metalness ?? 0.06,
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(accent.size[0], accent.size[1], accent.size[2]),
        mat
      );
      mesh.position.set(accent.pos[0], accent.pos[1], accent.pos[2]);
      mesh.rotation.y = accent.rotY || 0;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.surface = 'carpet';
      roomGroup.add(mesh);
    }
  }
}

function buildOutlets(roomGroup, outletDefs) {
  const outlets = [];
  if (!outletDefs || outletDefs.length === 0) return outlets;

  const plateGeo = new THREE.BoxGeometry(0.34, 0.45, 0.08);
  const slotGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10);
  const ledGeo = new THREE.SphereGeometry(0.02, 10, 10);
  const ringGeo = new THREE.TorusGeometry(0.22, 0.02, 8, 20);

  for (let i = 0; i < outletDefs.length; i += 1) {
    const def = outletDefs[i];
    const normal = new THREE.Vector3(
      def.normal?.[0] ?? 0,
      def.normal?.[1] ?? 0,
      def.normal?.[2] ?? 1
    );
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
    normal.normalize();

    const basePos = new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]);

    const group = new THREE.Group();
    group.name = `outlet_${def.id || i}`;
    group.position.copy(basePos).addScaledVector(normal, 0.02);
    group.rotation.y = Math.atan2(normal.x, normal.z);

    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xe7e2d4,
      roughness: 0.42,
      metalness: 0.1,
      emissive: 0x2f3f55,
      emissiveIntensity: 0.05,
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.castShadow = false;
    plate.receiveShadow = true;
    group.add(plate);

    const slotMat = new THREE.MeshStandardMaterial({
      color: 0x272727,
      roughness: 0.8,
      metalness: 0.15,
    });
    const slotL = new THREE.Mesh(slotGeo, slotMat);
    slotL.rotation.z = Math.PI / 2;
    slotL.position.set(-0.06, 0, 0.035);
    group.add(slotL);

    const slotR = new THREE.Mesh(slotGeo, slotMat);
    slotR.rotation.z = Math.PI / 2;
    slotR.position.set(0.06, 0, 0.035);
    group.add(slotR);

    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x94d8ff,
      emissive: 0x245577,
      emissiveIntensity: 0.2,
      roughness: 0.35,
      metalness: 0.05,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, -0.14, 0.04);
    led.castShadow = false;
    led.receiveShadow = false;
    group.add(led);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x8fd9ff,
      emissive: 0x2f6b99,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.08,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.36, 0.04);
    ring.castShadow = false;
    ring.receiveShadow = false;
    group.add(ring);

    roomGroup.add(group);

    outlets.push({
      id: def.id || `outlet_${i}`,
      position: basePos.clone(),
      socketPosition: basePos.clone().addScaledVector(normal, 0.19),
      normal: normal.clone(),
      mesh: plate,
      led,
      ring,
      group,
    });
  }

  return outlets;
}

function buildStains(roomGroup, stainDefs) {
  const stains = [];
  if (!stainDefs || stainDefs.length === 0) return stains;

  for (let i = 0; i < stainDefs.length; i += 1) {
    const def = stainDefs[i];
    const radius = def.radius ?? 0.55;
    const pos = def.pos || [0, 0.035, 0];

    const stainGeo = new THREE.CircleGeometry(radius, 28);
    const stainMat = new THREE.MeshStandardMaterial({
      color: def.color ?? 0x5a422d,
      transparent: true,
      opacity: 0.76,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const stainMesh = new THREE.Mesh(stainGeo, stainMat);
    stainMesh.rotation.x = -Math.PI / 2;
    stainMesh.rotation.z = (i * 1.3) % (Math.PI * 2);
    stainMesh.position.set(pos[0], pos[1] ?? 0.035, pos[2]);
    stainMesh.receiveShadow = true;
    stainMesh.name = `stain_${def.id || i}`;

    roomGroup.add(stainMesh);

    stains.push({
      id: def.id || `stain_${i}`,
      zone: def.zone || 'unknown',
      points: def.points ?? 10,
      interactRadius: def.interactRadius ?? 1.35,
      position: new THREE.Vector3(pos[0], pos[1] ?? 0.035, pos[2]),
      mesh: stainMesh,
      cleaned: false,
    });
  }

  return stains;
}

function buildWaters(roomGroup, waterDefs) {
  const waters = [];
  if (!waterDefs || waterDefs.length === 0) return waters;

  for (let i = 0; i < waterDefs.length; i += 1) {
    const def = waterDefs[i];
    const radius = def.radius ?? 0.5;
    const pos = def.pos || [0, 0.036, 0];

    const waterGeo = new THREE.CircleGeometry(radius, 32);
    const waterMat = new THREE.MeshStandardMaterial({
      color: def.color ?? 0x4aa3cf,
      transparent: true,
      opacity: 0.64,
      roughness: 0.2,
      metalness: 0.0,
      emissive: 0x124968,
      emissiveIntensity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.rotation.z = ((i * 0.77) + 0.35) % (Math.PI * 2);
    waterMesh.position.set(pos[0], pos[1] ?? 0.036, pos[2]);
    waterMesh.receiveShadow = true;
    waterMesh.name = `water_${def.id || i}`;
    roomGroup.add(waterMesh);

    waters.push({
      id: def.id || `water_${i}`,
      zone: def.zone || 'unknown',
      points: def.points ?? 8,
      interactRadius: def.interactRadius ?? 1.35,
      position: new THREE.Vector3(pos[0], pos[1] ?? 0.036, pos[2]),
      mesh: waterMesh,
      cleared: false,
    });
  }

  return waters;
}

function buildStoryTriggers(roomGroup, triggerDefs) {
  const triggers = [];
  if (!triggerDefs || triggerDefs.length === 0) return triggers;

  const baseGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.12, 12);
  const orbGeo = new THREE.SphereGeometry(0.11, 14, 14);

  for (let i = 0; i < triggerDefs.length; i += 1) {
    const def = triggerDefs[i];
    const pos = def.pos || [0, 0.75, 0];

    const group = new THREE.Group();
    group.name = `story_trigger_${def.id || i}`;
    group.position.set(pos[0], pos[1] ?? 0.75, pos[2]);

    const base = new THREE.Mesh(
      baseGeo,
      new THREE.MeshStandardMaterial({
        color: 0x394554,
        roughness: 0.84,
        metalness: 0.18,
      })
    );
    base.position.y = -0.08;
    base.castShadow = false;
    base.receiveShadow = true;
    group.add(base);

    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x9ed9ff,
      emissive: 0x356699,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.14,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.castShadow = false;
    orb.receiveShadow = false;
    group.add(orb);

    roomGroup.add(group);

    triggers.push({
      id: def.id || `story_trigger_${i}`,
      cutsceneId: def.cutsceneId || '',
      prompt: def.prompt || 'Press E to inspect',
      radius: def.radius ?? 2.0,
      once: def.once !== false,
      used: false,
      position: new THREE.Vector3(pos[0], pos[1] ?? 0.75, pos[2]),
      orb,
      group,
    });
  }

  return triggers;
}

function buildNpcs(roomGroup, npcDefs) {
  const npcs = [];
  if (!npcDefs || npcDefs.length === 0) return npcs;

  for (let i = 0; i < npcDefs.length; i += 1) {
    const def = npcDefs[i];
    const pos = def.pos || [0, 0, 0];
    const bodyColor = def.bodyColor ?? 0xc8a971;
    const faceColor = def.faceColor ?? 0xefe3c9;

    const group = new THREE.Group();
    group.name = `npc_${def.id || i}`;
    group.position.set(pos[0], pos[1] ?? 0, pos[2]);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.27, 0.62, 14),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.72,
        metalness: 0.06,
      })
    );
    body.position.y = 0.31;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({
        color: faceColor,
        roughness: 0.6,
        metalness: 0.04,
      })
    );
    head.position.set(0, 0.78, 0);
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.032, 10, 10);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
      metalness: 0.2,
    });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.07, 0.82, 0.18);
    eyeR.position.set(0.07, 0.82, 0.18);
    group.add(eyeL);
    group.add(eyeR);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.18, 8),
      new THREE.MeshStandardMaterial({
        color: 0xbad6ff,
        roughness: 0.4,
        metalness: 0.22,
        emissive: 0x2d4a66,
        emissiveIntensity: 0.18,
      })
    );
    antenna.position.set(0, 1.03, 0);
    group.add(antenna);

    roomGroup.add(group);

    npcs.push({
      id: def.id || `npc_${i}`,
      name: def.name || `Toy ${i + 1}`,
      interactRadius: def.interactRadius ?? 2,
      walkSpeed: def.walkSpeed ?? 0.45,
      patrol: def.patrol || [],
      dialogue: def.dialogue || null,
      group,
    });
  }

  return npcs;
}

function buildShopTerminals(roomGroup, terminalDefs) {
  const shopTerminals = [];
  const colliderDefs = [];
  if (!terminalDefs || terminalDefs.length === 0) {
    return { shopTerminals, colliderDefs };
  }

  for (let i = 0; i < terminalDefs.length; i += 1) {
    const def = terminalDefs[i];
    const id = def.id || `shop_terminal_${i}`;
    const pos = def.pos || [0, 0.65, 0];
    const rotY = def.rotY ?? 0;

    const group = new THREE.Group();
    group.name = `shop_terminal_${id}`;
    group.position.set(pos[0], pos[1], pos[2]);
    group.rotation.y = rotY;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.86, 0.44),
      new THREE.MeshStandardMaterial({
        color: 0x2f3647,
        roughness: 0.72,
        metalness: 0.14,
      })
    );
    base.position.y = 0.43;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.28),
      new THREE.MeshStandardMaterial({
        color: 0x98dfff,
        roughness: 0.18,
        metalness: 0.08,
        emissive: 0x2a6e9f,
        emissiveIntensity: 0.55,
      })
    );
    screen.position.set(0, 0.62, 0.226);
    group.add(screen);

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x485066,
        roughness: 0.8,
        metalness: 0.1,
      })
    );
    stand.position.y = 0.05;
    stand.castShadow = true;
    stand.receiveShadow = true;
    group.add(stand);

    roomGroup.add(group);

    const worldPos = new THREE.Vector3(pos[0], pos[1], pos[2]);
    shopTerminals.push({
      id,
      prompt: def.prompt || 'Press E to access shop',
      interactRadius: def.interactRadius ?? 2.3,
      position: worldPos,
      group,
      screen,
    });

    colliderDefs.push({
      position: { x: pos[0], y: pos[1] + 0.43, z: pos[2] },
      size: { x: 0.29, y: 0.43, z: 0.22 },
    });
  }

  return { shopTerminals, colliderDefs };
}

function buildPushables(roomGroup, pushableDefs) {
  const pushables = [];
  if (!pushableDefs || pushableDefs.length === 0) return pushables;

  for (let i = 0; i < pushableDefs.length; i += 1) {
    const def = pushableDefs[i];
    const id = def.id || `pushable_${i}`;
    const size = def.size || [1, 0.7, 1];
    const pos = def.pos || [0, size[1] * 0.5, 0];

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.MeshStandardMaterial({
        color: def.color ?? 0xb28a57,
        roughness: 0.88,
        metalness: 0.04,
      })
    );
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `pushable_${id}`;
    mesh.userData.pushable = true;
    mesh.userData.surface = 'wood';
    roomGroup.add(mesh);

    pushables.push({
      id,
      size: new THREE.Vector3(size[0], size[1], size[2]),
      position: new THREE.Vector3(pos[0], pos[1], pos[2]),
      mass: def.mass ?? 14,
      friction: def.friction ?? 1.6,
      linearDamping: def.linearDamping ?? 6.8,
      angularDamping: def.angularDamping ?? 8.4,
      mesh,
    });
  }

  return pushables;
}

function buildGrabbables(roomGroup, grabbableDefs) {
  const grabbables = [];
  if (!grabbableDefs || grabbableDefs.length === 0) return grabbables;

  for (let i = 0; i < grabbableDefs.length; i += 1) {
    const def = grabbableDefs[i];
    const id = def.id || `grabbable_${i}`;
    const size = def.size || [0.3, 0.3, 0.3];
    const pos = def.pos || [0, size[1] * 0.5, 0];
    const kind = def.kind || 'trash';

    let geometry = null;
    if (kind === 'robot_part') {
      geometry = new THREE.CylinderGeometry(size[0] * 0.35, size[0] * 0.46, size[1], 10);
    } else if (kind === 'scrap') {
      geometry = new THREE.DodecahedronGeometry(size[0] * 0.6, 0);
    } else {
      geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    }

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: def.color ?? 0xc8b895,
        roughness: 0.7,
        metalness: kind === 'robot_part' ? 0.2 : 0.05,
      })
    );
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `grabbable_${id}`;
    mesh.userData.grabbable = true;
    mesh.userData.grabbableId = id;
    mesh.userData.surface = 'metal';
    roomGroup.add(mesh);

    grabbables.push({
      id,
      kind,
      value: def.value ?? 0,
      size: new THREE.Vector3(size[0], size[1], size[2]),
      position: new THREE.Vector3(pos[0], pos[1], pos[2]),
      mass: def.mass ?? 1.6,
      mesh,
    });
  }

  return grabbables;
}

function buildDecor(roomGroup, decorConfig, placedFurniture, parkourColliderDefs, bounds) {
  const items = [];
  const stats = {
    rugs: 0,
    wallPanels: 0,
    clutter: 0,
    totalPlaced: 0,
  };

  if (!decorConfig) {
    return { items, stats };
  }

  const decorGroup = new THREE.Group();
  decorGroup.name = 'room_decor';

  const occupiedRects = [];
  const furniturePadding = decorConfig.furniturePadding ?? 0.18;
  const parkourPadding = decorConfig.parkourPadding ?? 0.12;

  for (const entry of placedFurniture) {
    if (!entry.box) continue;
    occupiedRects.push(boxToRect(entry.box, furniturePadding));
  }
  for (const collider of parkourColliderDefs || []) {
    const rect = colliderToRect(collider, parkourPadding);
    if (rect) occupiedRects.push(rect);
  }

  const materialCache = new Map();
  stats.rugs = buildDecorRugs(
    decorGroup,
    decorConfig.rugs || [],
    occupiedRects,
    items,
    materialCache
  );
  stats.wallPanels = buildDecorWallPanels(
    decorGroup,
    decorConfig.wallPanels || [],
    items,
    materialCache
  );
  stats.clutter = buildDecorClutterZones(
    decorGroup,
    decorConfig,
    occupiedRects,
    bounds,
    items,
    materialCache
  );

  stats.totalPlaced = stats.rugs + stats.wallPanels + stats.clutter;

  if (decorGroup.children.length > 0) {
    roomGroup.add(decorGroup);
  }

  return { items, stats };
}

function buildDecorRugs(group, rugDefs, occupiedRects, items, materialCache) {
  let placed = 0;

  for (let i = 0; i < rugDefs.length; i += 1) {
    const def = rugDefs[i];
    const size = def.size || [2.4, 1.6];
    const height = def.height ?? 0.028;
    const pos = def.pos || [0, 0];
    const rotY = def.rotY ?? 0;

    const key = `rug:${def.color ?? 0x5c4e42}:${def.roughness ?? 0.92}:${def.metalness ?? 0.01}`;
    let mat = materialCache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: def.color ?? 0x5c4e42,
        roughness: def.roughness ?? 0.92,
        metalness: def.metalness ?? 0.01,
      });
      materialCache.set(key, mat);
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], height, size[1]), mat);
    mesh.position.set(pos[0], height * 0.5, pos[1]);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.surface = 'carpet';
    mesh.name = `decor_rug_${def.id || i}`;
    group.add(mesh);

    if (def.reserveSpace !== false) {
      const pad = def.padding ?? 0.08;
      occupiedRects.push({
        minX: pos[0] - size[0] * 0.5 - pad,
        maxX: pos[0] + size[0] * 0.5 + pad,
        minZ: pos[1] - size[1] * 0.5 - pad,
        maxZ: pos[1] + size[1] * 0.5 + pad,
      });
    }

    items.push({
      id: def.id || `rug_${i}`,
      type: 'rug',
      mesh,
    });
    placed += 1;
  }

  return placed;
}

function buildDecorWallPanels(group, panelDefs, items, materialCache) {
  let placed = 0;

  for (let i = 0; i < panelDefs.length; i += 1) {
    const def = panelDefs[i];
    const size = def.size || [1.8, 1.2, 0.06];
    const pos = def.pos || [0, 2, 0];
    const rotY = def.rotY ?? 0;
    const key = `panel:${def.color ?? 0x6a5948}:${def.roughness ?? 0.82}:${def.metalness ?? 0.03}`;

    let mat = materialCache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: def.color ?? 0x6a5948,
        roughness: def.roughness ?? 0.82,
        metalness: def.metalness ?? 0.03,
      });
      materialCache.set(key, mat);
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.y = rotY;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.surface = 'wall';
    mesh.name = `decor_panel_${def.id || i}`;
    group.add(mesh);

    items.push({
      id: def.id || `panel_${i}`,
      type: 'wallPanel',
      mesh,
    });
    placed += 1;
  }

  return placed;
}

function buildDecorClutterZones(group, decorConfig, occupiedRects, bounds, items, materialCache) {
  const presets = decorConfig.clutterPresets || {};
  const zones = decorConfig.clutterZones || [];
  if (zones.length === 0) return 0;

  const geometryCache = new Map();
  const globalSeed = decorConfig.seed ?? 1337;
  let placed = 0;

  for (const zone of zones) {
    const modules = zone.modules || [];
    if (modules.length === 0) continue;

    const rng = createSeededRandom((globalSeed + hashString(zone.id || 'zone')) >>> 0);
    const count = Math.max(0, zone.count ?? 0);
    const attempts = Math.max(count * (zone.triesPerItem ?? 10), 1);
    const margin = zone.margin ?? 0.45;

    const minXRaw = zone.bounds?.[0] ?? -bounds.halfW;
    const maxXRaw = zone.bounds?.[1] ?? bounds.halfW;
    const minZRaw = zone.bounds?.[2] ?? -bounds.halfD;
    const maxZRaw = zone.bounds?.[3] ?? bounds.halfD;

    const minX = Math.max(minXRaw, -bounds.halfW + margin);
    const maxX = Math.min(maxXRaw, bounds.halfW - margin);
    const minZ = Math.max(minZRaw, -bounds.halfD + margin);
    const maxZ = Math.min(maxZRaw, bounds.halfD - margin);

    if (maxX <= minX || maxZ <= minZ) continue;

    let zonePlaced = 0;
    let attempt = 0;
    while (zonePlaced < count && attempt < attempts) {
      attempt += 1;

      const module = pickDecorModule(modules, rng);
      if (!module) continue;

      const preset = presets[module.id];
      if (!preset || !Array.isArray(preset.size)) continue;

      const scaleRange = preset.scaleRange || zone.scaleRange || [0.85, 1.18];
      const scaleMin = scaleRange[0] ?? 0.85;
      const scaleMax = scaleRange[1] ?? 1.18;
      const scale = randomRange(rng, Math.min(scaleMin, scaleMax), Math.max(scaleMin, scaleMax));

      const sx = Math.max(0.03, preset.size[0] * scale);
      const sy = Math.max(0.01, preset.size[1] * scale);
      const sz = Math.max(0.03, preset.size[2] * scale);

      const xMin = minX + sx * 0.5;
      const xMax = maxX - sx * 0.5;
      const zMin = minZ + sz * 0.5;
      const zMax = maxZ - sz * 0.5;
      if (xMax <= xMin || zMax <= zMin) continue;

      const x = randomRange(rng, xMin, xMax);
      const z = randomRange(rng, zMin, zMax);
      const spacing = preset.spacing ?? zone.spacing ?? 0.1;
      const rect = {
        minX: x - sx * 0.5 - spacing,
        maxX: x + sx * 0.5 + spacing,
        minZ: z - sz * 0.5 - spacing,
        maxZ: z + sz * 0.5 + spacing,
      };

      if (occupiedRects.some((entry) => rectsOverlap(rect, entry))) {
        continue;
      }

      const colorList = Array.isArray(preset.colors) ? preset.colors : null;
      const color = colorList && colorList.length > 0
        ? colorList[Math.floor(rng() * colorList.length)]
        : (preset.color ?? 0xc1b79e);
      const matKey = [
        preset.shape || 'box',
        color,
        preset.roughness ?? 0.75,
        preset.metalness ?? 0.04,
      ].join(':');

      let mat = materialCache.get(matKey);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color,
          roughness: preset.roughness ?? 0.75,
          metalness: preset.metalness ?? 0.04,
          emissive: preset.emissive ?? 0x000000,
          emissiveIntensity: preset.emissiveIntensity ?? 0,
        });
        materialCache.set(matKey, mat);
      }

      const geoKey = `${preset.shape || 'box'}:${sx.toFixed(3)}:${sy.toFixed(3)}:${sz.toFixed(3)}`;
      let geometry = geometryCache.get(geoKey);
      if (!geometry) {
        geometry = createDecorGeometry(preset.shape || 'box', sx, sy, sz);
        geometryCache.set(geoKey, geometry);
      }

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, (preset.baseY ?? 0) + sy * 0.5, z);
      mesh.rotation.y = randomRange(rng, 0, Math.PI * 2);
      if (preset.shape === 'box' && sy <= 0.04) {
        mesh.rotation.x = randomRange(rng, -0.08, 0.08);
        mesh.rotation.z = randomRange(rng, -0.08, 0.08);
      }
      if (preset.shape === 'torus') {
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = randomRange(rng, 0, Math.PI * 2);
      }

      mesh.castShadow = preset.castShadow !== false;
      mesh.receiveShadow = true;
      mesh.userData.surface = preset.surface || 'wood';
      mesh.name = `decor_${zone.id || 'zone'}_${zonePlaced}`;
      group.add(mesh);

      if (preset.reserveSpace !== false) {
        occupiedRects.push(rect);
      }

      items.push({
        id: `${zone.id || 'zone'}_${zonePlaced}`,
        type: 'clutter',
        zone: zone.id || 'zone',
        mesh,
      });

      zonePlaced += 1;
      placed += 1;
    }
  }

  return placed;
}

function pickDecorModule(modules, rng) {
  if (modules.length === 0) return null;
  let total = 0;
  for (const entry of modules) {
    total += Math.max(0.0001, entry.weight ?? 1);
  }

  let pick = rng() * total;
  for (const entry of modules) {
    pick -= Math.max(0.0001, entry.weight ?? 1);
    if (pick <= 0) return entry;
  }

  return modules[modules.length - 1];
}

function createDecorGeometry(shape, sx, sy, sz) {
  if (shape === 'cylinder') {
    const radius = Math.max(0.03, Math.max(sx, sz) * 0.5);
    return new THREE.CylinderGeometry(radius, radius, sy, 12);
  }
  if (shape === 'sphere') {
    const radius = Math.max(0.03, Math.max(sx, sy, sz) * 0.5);
    return new THREE.SphereGeometry(radius, 12, 10);
  }
  if (shape === 'torus') {
    const radius = Math.max(0.04, Math.max(sx, sz) * 0.45);
    const tube = Math.max(0.012, sy * 0.5);
    return new THREE.TorusGeometry(radius, tube, 8, 18);
  }
  return new THREE.BoxGeometry(sx, sy, sz);
}

function boxToRect(box, padding = 0) {
  return {
    minX: box.min.x - padding,
    maxX: box.max.x + padding,
    minZ: box.min.z - padding,
    maxZ: box.max.z + padding,
  };
}

function colliderToRect(colliderDef, padding = 0) {
  if (!colliderDef?.position || !colliderDef?.size) return null;
  return {
    minX: colliderDef.position.x - colliderDef.size.x - padding,
    maxX: colliderDef.position.x + colliderDef.size.x + padding,
    minZ: colliderDef.position.z - colliderDef.size.z - padding,
    maxZ: colliderDef.position.z + colliderDef.size.z + padding,
  };
}

function rectsOverlap(a, b) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

function inferSurfaceFromObjectName(name = '') {
  const normalized = String(name).toLowerCase();
  if (normalized.includes('chair') || normalized.includes('table') || normalized.includes('bookcase') || normalized.includes('bed')) {
    return 'wood';
  }
  if (normalized.includes('stove') || normalized.includes('fridge') || normalized.includes('radio') || normalized.includes('phone') || normalized.includes('ventilator')) {
    return 'metal';
  }
  if (normalized.includes('armchair') || normalized.includes('sofa') || normalized.includes('lamp')) {
    return 'carpet';
  }
  return 'wood';
}

function buildRoomTransitions(transitionDefs) {
  const transitions = [];
  if (!transitionDefs || transitionDefs.length === 0) return transitions;

  for (let i = 0; i < transitionDefs.length; i += 1) {
    const def = transitionDefs[i];
    const min = new THREE.Vector3(
      def.min?.[0] ?? 0,
      def.min?.[1] ?? 0,
      def.min?.[2] ?? 0
    );
    const max = new THREE.Vector3(
      def.max?.[0] ?? 0,
      def.max?.[1] ?? 0,
      def.max?.[2] ?? 0
    );
    const box = new THREE.Box3(min, max);
    const targetSpawn = new THREE.Vector3(
      def.targetSpawn?.[0] ?? 0,
      def.targetSpawn?.[1] ?? 1.5,
      def.targetSpawn?.[2] ?? 0
    );

    transitions.push({
      id: def.id || `transition_${i}`,
      prompt: def.prompt || 'Transition',
      targetRoom: def.targetRoom || 'mainFloor',
      targetSpawn,
      box,
    });
  }

  return transitions;
}

function buildClimbables(roomGroup, climbDefs) {
  const climbables = [];
  const colliderDefs = [];
  if (!climbDefs || climbDefs.length === 0) {
    return { climbables, colliderDefs };
  }

  const cordMat = new THREE.MeshStandardMaterial({
    color: 0xd1d3de,
    roughness: 0.58,
    metalness: 0.08,
    emissive: 0x3f4a69,
    emissiveIntensity: 0.1,
  });
  const ladderMat = new THREE.MeshStandardMaterial({
    color: 0x9b7c58,
    roughness: 0.72,
    metalness: 0.02,
    emissive: 0x2d1f11,
    emissiveIntensity: 0.05,
  });

  for (let i = 0; i < climbDefs.length; i += 1) {
    const def = climbDefs[i];
    const id = def.id || `climbable_${i}`;
    const type = def.type || 'ladder';
    const pos = def.pos || [0, 0, 0];
    const height = def.height ?? 3.5;
    const width = def.width ?? 0.5;
    const depth = def.depth ?? 0.26;
    const radius = def.radius ?? Math.max(width * 0.45, 0.12);
    const rotY = def.rotY ?? 0;
    const baseY = pos[1];
    const centerY = baseY + height * 0.5;
    const topY = baseY + height;

    const group = new THREE.Group();
    group.name = `climbable_${id}`;
    group.position.set(pos[0], centerY, pos[2]);
    group.rotation.y = rotY;

    let mesh = null;
    let visualWidth = width;
    let visualDepth = depth;

    if (type === 'cord') {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.88, height, 14),
        cordMat.clone()
      );
      visualWidth = radius * 2;
      visualDepth = radius * 2;
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        ladderMat.clone()
      );

      const rungGeo = new THREE.CylinderGeometry(0.045, 0.045, width * 0.85, 8);
      for (let r = 0; r < 6; r += 1) {
        const rung = new THREE.Mesh(rungGeo, ladderMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, -height * 0.42 + r * (height * 0.17), depth * 0.52);
        group.add(rung);
      }
    }

    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.climbable = true;
    mesh.userData.climbableId = id;
    group.userData.climbable = true;
    group.userData.climbableId = id;
    group.add(mesh);
    roomGroup.add(group);

    const normal = new THREE.Vector3(
      def.normal?.[0] ?? Math.sin(rotY),
      0,
      def.normal?.[2] ?? Math.cos(rotY)
    );
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
    normal.normalize();

    climbables.push({
      id,
      type,
      height,
      width: visualWidth,
      depth: visualDepth,
      radius,
      baseY,
      topY,
      position: new THREE.Vector3(pos[0], centerY, pos[2]),
      normal,
      mesh,
      group,
    });

    colliderDefs.push({
      position: { x: pos[0], y: centerY, z: pos[2] },
      size: {
        x: Math.max(visualWidth * 0.5, radius),
        y: height * 0.5,
        z: Math.max(visualDepth * 0.5, radius),
      },
    });
  }

  return {
    climbables,
    colliderDefs,
  };
}

function addRoomColliders(colliderDefs, room, halfW, halfD) {
  const thickness = room.wallThick;

  colliderDefs.push({
    position: { x: 0, y: -thickness / 2, z: 0 },
    size: { x: halfW, y: thickness / 2, z: halfD },
  });

  colliderDefs.push({
    position: { x: 0, y: room.height + thickness / 2, z: 0 },
    size: { x: halfW, y: thickness / 2, z: halfD },
  });

  colliderDefs.push({
    position: { x: 0, y: room.height / 2, z: -halfD - thickness / 2 },
    size: { x: halfW, y: room.height / 2, z: thickness / 2 },
  });

  colliderDefs.push({
    position: { x: 0, y: room.height / 2, z: halfD + thickness / 2 },
    size: { x: halfW, y: room.height / 2, z: thickness / 2 },
  });

  colliderDefs.push({
    position: { x: -halfW - thickness / 2, y: room.height / 2, z: 0 },
    size: { x: thickness / 2, y: room.height / 2, z: halfD },
  });

  colliderDefs.push({
    position: { x: halfW + thickness / 2, y: room.height / 2, z: 0 },
    size: { x: thickness / 2, y: room.height / 2, z: halfD },
  });
}
