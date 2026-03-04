import * as THREE from 'three';

/**
 * Create and return { scene, renderer, camera }
 */
export function createScene() {
  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a3a); // dark interior ambience
  // No fog for indoor room — we want to see all furniture clearly

  // Renderer
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Camera
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 5, 12);

  return { scene, renderer, camera };
}
