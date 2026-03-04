import * as THREE from 'three';

/**
 * Add ambient, directional, and accent lighting to the scene.
 * Adapts to room dimensions if provided.
 */
export function setupLighting(scene, roomDimensions = null) {
  const halfW = roomDimensions ? roomDimensions.width / 2 : 30;
  const halfD = roomDimensions ? roomDimensions.depth / 2 : 30;
  const roomH = roomDimensions ? roomDimensions.height : 28;

  // Strong ambient fill — FBX materials (MeshPhongMaterial) need more ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  // Main directional light — positioned inside room, looking down
  const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.5);
  dirLight.position.set(0, roomH * 0.9, 0); // center of ceiling
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(4096, 4096);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = roomH * 3;
  dirLight.shadow.camera.left = -halfW;
  dirLight.shadow.camera.right = halfW;
  dirLight.shadow.camera.top = halfD;
  dirLight.shadow.camera.bottom = -halfD;
  dirLight.shadow.bias = -0.001;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  // Hemisphere light for sky/ground color variation
  const hemi = new THREE.HemisphereLight(0xffeedd, 0x8B6914, 0.4);
  scene.add(hemi);

  // Multiple point lights for warm interior feel
  const positions = [
    [0, roomH * 0.7, 0],
    [-halfW * 0.4, roomH * 0.5, -halfD * 0.3],
    [halfW * 0.4, roomH * 0.5, halfD * 0.3],
  ];
  const lights = [];
  for (const pos of positions) {
    const light = new THREE.PointLight(0xffcc88, 0.6, halfW * 2, 1.5);
    light.position.set(...pos);
    scene.add(light);
    lights.push(light);
  }

  return { dirLight, lights };
}
