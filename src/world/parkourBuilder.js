import * as THREE from 'three';

const DEFAULT_MATERIAL = {
  roughness: 0.72,
  metalness: 0.08,
};

export function buildParkourPlatforms(parkourConfig) {
  const group = new THREE.Group();
  group.name = 'parkour_platforms';

  if (!parkourConfig || !parkourConfig.routes || !parkourConfig.modules) {
    return { group, colliderDefs: [], routeMarkers: [], platformCount: 0 };
  }

  const modules = parkourConfig.modules;
  const geometryCache = new Map();
  const baseMaterialCache = new Map();

  const colliderDefs = [];
  const routeMarkers = [];

  let platformCount = 0;

  const getGeometry = (moduleName) => {
    const module = modules[moduleName];
    if (!module) return null;

    if (!geometryCache.has(moduleName)) {
      geometryCache.set(
        moduleName,
        new THREE.BoxGeometry(module.size[0], module.size[1], module.size[2])
      );
    }

    return geometryCache.get(moduleName);
  };

  const getBaseMaterial = (moduleName) => {
    const module = modules[moduleName];
    if (!module) return null;

    if (!baseMaterialCache.has(moduleName)) {
      baseMaterialCache.set(
        moduleName,
        new THREE.MeshStandardMaterial({
          color: module.color ?? 0xffffff,
          roughness: module.roughness ?? DEFAULT_MATERIAL.roughness,
          metalness: module.metalness ?? DEFAULT_MATERIAL.metalness,
        })
      );
    }

    return baseMaterialCache.get(moduleName);
  };

  for (const route of parkourConfig.routes) {
    if (!route.nodes || route.nodes.length === 0) continue;

    const routeTint = new THREE.Color(route.color ?? 0xffffff);

    route.nodes.forEach((node, idx) => {
      const module = modules[node.module];
      if (!module) {
        console.warn(`Parkour node skipped: module "${node.module}" not found`);
        return;
      }

      const geometry = getGeometry(node.module);
      const baseMaterial = getBaseMaterial(node.module);
      if (!geometry || !baseMaterial) return;

      const mat = baseMaterial.clone();
      mat.color.lerp(routeTint, 0.22);

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = `parkour_${route.id}_${idx}_${node.module}`;
      mesh.position.set(node.pos[0], node.pos[1], node.pos[2]);
      mesh.rotation.y = node.rotY || 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const [sx, sy, sz] = module.size;
      colliderDefs.push({
        position: { x: node.pos[0], y: node.pos[1], z: node.pos[2] },
        size: { x: sx / 2, y: sy / 2, z: sz / 2 },
      });

      routeMarkers.push({
        routeId: route.id,
        routeName: route.name,
        index: idx,
        module: node.module,
        position: {
          x: node.pos[0],
          y: node.pos[1] + sy / 2,
          z: node.pos[2],
        },
      });

      platformCount += 1;
    });
  }

  return { group, colliderDefs, routeMarkers, platformCount };
}
