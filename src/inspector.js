import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// ── State ────────────────────────────────────────────────────────
let scene, renderer, camera, controls, clock;
let houseModel;
let objectEntries = []; // { name, object3d, type, vertexCount, bbox }
let selectedEntry = null;
let wireframeMode = false;
let isolateMode = false;
let raycaster, mouse;

// ── Three.js Setup ───────────────────────────────────────────────
function initScene() {
  const canvas = document.getElementById('preview');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
  camera.position.set(5, 5, 5);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Lighting
  scene.add(new THREE.AmbientLight(0xffd9a0, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  dir.shadow.camera.left = -15;
  dir.shadow.camera.right = 15;
  dir.shadow.camera.top = 15;
  dir.shadow.camera.bottom = -15;
  scene.add(dir);
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3));

  // Ground grid
  const grid = new THREE.GridHelper(20, 40, 0x444466, 0x333344);
  scene.add(grid);

  // Axes helper
  scene.add(new THREE.AxesHelper(3));

  clock = new THREE.Clock();

  // Raycaster for click-to-select
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  canvas.addEventListener('click', onCanvasClick);

  const resize = () => {
    const vp = document.getElementById('viewport');
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
}

// ── Load House Model ─────────────────────────────────────────────
async function loadHouseModel() {
  const loader = new FBXLoader();

  document.getElementById('loading-text').textContent = 'Loading house model (this may take a moment)...';

  const fbx = await loader.loadAsync('/models/Models/Objects_Interior(Village)_Demo.fbx');
  houseModel = fbx;

  // FBX models can be very large — normalize scale
  const box = new THREE.Box3().setFromObject(fbx);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Scale so largest dimension is about 10 units
  if (maxDim > 0) {
    const scale = 10 / maxDim;
    fbx.scale.setScalar(scale);
  }

  // Center on origin
  const scaledBox = new THREE.Box3().setFromObject(fbx);
  const center = scaledBox.getCenter(new THREE.Vector3());
  fbx.position.sub(center);
  fbx.position.y -= scaledBox.min.y - center.y; // put on ground

  // Enable shadows
  fbx.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      // Store original material for wireframe toggle
      child.userData.originalMaterial = child.material;
    }
  });

  scene.add(fbx);

  // Parse all objects
  parseObjects(fbx);

  // Fit camera to scene
  const finalBox = new THREE.Box3().setFromObject(fbx);
  const finalCenter = finalBox.getCenter(new THREE.Vector3());
  const finalSize = finalBox.getSize(new THREE.Vector3());
  const maxS = Math.max(finalSize.x, finalSize.y, finalSize.z);
  camera.position.set(finalCenter.x + maxS, finalCenter.y + maxS * 0.7, finalCenter.z + maxS);
  controls.target.copy(finalCenter);
}

// ── Parse Objects from FBX ───────────────────────────────────────
function parseObjects(root) {
  objectEntries = [];

  root.traverse((obj) => {
    // Skip the root itself and non-interesting objects
    if (obj === root) return;
    if (!obj.isMesh && !obj.isGroup && obj.children.length === 0) return;

    let vertexCount = 0;
    if (obj.isMesh && obj.geometry) {
      const pos = obj.geometry.getAttribute('position');
      vertexCount = pos ? pos.count : 0;
    } else if (obj.isGroup || obj.children.length > 0) {
      obj.traverse(c => {
        if (c.isMesh && c.geometry) {
          const pos = c.geometry.getAttribute('position');
          vertexCount += pos ? pos.count : 0;
        }
      });
    }

    // Only add meshes and meaningful groups
    if (obj.isMesh || (obj.children.length > 0 && obj.name)) {
      const bbox = new THREE.Box3().setFromObject(obj);
      const size = bbox.getSize(new THREE.Vector3());

      objectEntries.push({
        name: obj.name || `unnamed_${objectEntries.length}`,
        object3d: obj,
        type: obj.isMesh ? 'mesh' : 'group',
        vertexCount,
        size: `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`,
        materialName: obj.isMesh ? (Array.isArray(obj.material) ? obj.material.map(m => m.name).join(', ') : obj.material?.name || 'default') : '-',
      });
    }
  });

  // Sort by name
  objectEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  console.log(`Parsed ${objectEntries.length} objects from house model`);
}

// ── Build Sidebar ────────────────────────────────────────────────
function buildSidebar() {
  renderObjList(objectEntries);
  document.getElementById('obj-count').textContent = `${objectEntries.length} objects`;

  document.getElementById('search-box').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = objectEntries.filter(o => o.name.toLowerCase().includes(q));
    renderObjList(filtered);
    document.getElementById('obj-count').textContent = `${filtered.length} / ${objectEntries.length} objects`;
  };
}

function renderObjList(entries) {
  const list = document.getElementById('obj-list');
  list.innerHTML = '';

  for (const entry of entries) {
    const div = document.createElement('div');
    div.className = 'obj-item' + (entry === selectedEntry ? ' active' : '') +
      (!entry.object3d.visible ? ' hidden-obj' : '');
    div.dataset.name = entry.name;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = entry.name;
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.flex = '1';
    div.appendChild(nameSpan);

    const typeSpan = document.createElement('span');
    typeSpan.className = `obj-type ${entry.type}`;
    typeSpan.textContent = entry.type === 'mesh' ? `${entry.vertexCount}v` : 'grp';
    div.appendChild(typeSpan);

    div.onclick = () => selectObject(entry);
    list.appendChild(div);
  }
}

// ── Select Object ────────────────────────────────────────────────
let highlightOutline = null;

function selectObject(entry) {
  selectedEntry = entry;

  // Update info panel
  const info = document.getElementById('selected-info');
  info.innerHTML = `
    <strong>${entry.name}</strong><br>
    Type: ${entry.type} | Vertices: ${entry.vertexCount.toLocaleString()}<br>
    Size: ${entry.size}<br>
    Material: ${entry.materialName}
  `;

  // Highlight with bounding box
  if (highlightOutline) scene.remove(highlightOutline);
  const box = new THREE.Box3().setFromObject(entry.object3d);
  highlightOutline = new THREE.Box3Helper(box, 0x4a9eff);
  scene.add(highlightOutline);

  // Focus camera on object
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  controls.target.copy(center);

  // Update list
  document.querySelectorAll('.obj-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === entry.name);
  });
  const active = document.querySelector('.obj-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// ── Click-to-select in viewport ──────────────────────────────────
function onCanvasClick(event) {
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = [];
  if (houseModel) {
    houseModel.traverse(c => { if (c.isMesh && c.visible) meshes.push(c); });
  }
  const hits = raycaster.intersectObjects(meshes, false);

  if (hits.length > 0) {
    const hitObj = hits[0].object;
    const entry = objectEntries.find(e => e.object3d === hitObj || e.object3d === hitObj.parent);
    if (entry) selectObject(entry);
  }
}

// ── Controls ─────────────────────────────────────────────────────
function setupControls() {
  document.getElementById('show-all-btn').onclick = () => {
    isolateMode = false;
    if (houseModel) {
      houseModel.traverse(c => { c.visible = true; });
    }
    document.getElementById('show-all-btn').classList.add('active');
    document.getElementById('isolate-btn').classList.remove('active');
  };

  document.getElementById('isolate-btn').onclick = () => {
    if (!selectedEntry) return;
    isolateMode = true;

    if (houseModel) {
      houseModel.traverse(c => {
        if (c.isMesh) c.visible = false;
      });
      selectedEntry.object3d.traverse(c => {
        c.visible = true;
      });
      // Also show parents
      let parent = selectedEntry.object3d.parent;
      while (parent) {
        parent.visible = true;
        parent = parent.parent;
      }
    }

    document.getElementById('isolate-btn').classList.add('active');
    document.getElementById('show-all-btn').classList.remove('active');
  };

  document.getElementById('wireframe-btn').onclick = () => {
    wireframeMode = !wireframeMode;
    document.getElementById('wireframe-btn').classList.toggle('active', wireframeMode);

    if (houseModel) {
      houseModel.traverse(c => {
        if (c.isMesh) {
          if (wireframeMode) {
            c.material = new THREE.MeshBasicMaterial({
              color: 0x4a9eff,
              wireframe: true,
              transparent: true,
              opacity: 0.5,
            });
          } else {
            c.material = c.userData.originalMaterial || c.material;
          }
        }
      });
    }
  };

  document.getElementById('reset-cam-btn').onclick = () => {
    if (houseModel) {
      const box = new THREE.Box3().setFromObject(houseModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxS = Math.max(size.x, size.y, size.z);
      camera.position.set(center.x + maxS, center.y + maxS * 0.7, center.z + maxS);
      controls.target.copy(center);
    }
  };

  document.getElementById('export-btn').onclick = async () => {
    if (!selectedEntry) {
      alert('Select an object first');
      return;
    }

    const exporter = new GLTFExporter();

    try {
      const result = await new Promise((resolve, reject) => {
        exporter.parse(
          selectedEntry.object3d,
          (gltf) => resolve(gltf),
          (err) => reject(err),
          { binary: true }
        );
      });

      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedEntry.name.replace(/[^a-z0-9_-]/gi, '_')}.glb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed: ' + err.message);
    }
  };
}

// ── Render Loop ──────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ── Init ─────────────────────────────────────────────────────────
async function main() {
  initScene();
  await loadHouseModel();

  document.getElementById('loading-overlay').classList.add('hidden');

  buildSidebar();
  setupControls();
  animate();

  console.log(`House inspector ready. ${objectEntries.length} objects parsed.`);
}

main().catch(err => {
  console.error('Inspector error:', err);
  document.getElementById('loading-overlay').innerHTML =
    `<div style="color:#ff6b6b">Error: ${err.message}</div>`;
});
