import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RuntimeRetargeter } from './retarget.js';

// ── State ────────────────────────────────────────────────────────
let scene, renderer, camera, controls, clock;
let model, retargeter;
let speed = 1.0;
let isPlaying = true;
const labels = {};

// Pack-based data: [ { packName, clips: [ { name, index } ] } ]
let packs = [];
// Flat list for prev/next navigation: [ { packName, clipIndex, clipName } ]
let flatClips = [];
let currentFlatIndex = -1;

// FBX cache: packName -> { fbx, animations[] }
const fbxCache = new Map();
let referenceFBX = null; // First loaded FBX used as retarget source skeleton

try {
  const saved = localStorage.getItem('tvrobo-anim-labels');
  if (saved) Object.assign(labels, JSON.parse(saved));
} catch {}

// ── Three.js Setup ───────────────────────────────────────────────
function initScene() {
  const canvas = document.getElementById('preview');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  camera.position.set(0, 1, 3);

  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xffd9a0, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(3, 5, 3);
  dir.castShadow = true;
  scene.add(dir);
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3));

  scene.add(new THREE.GridHelper(6, 12, 0x444466, 0x333344));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.ShadowMaterial({ opacity: 0.3 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  clock = new THREE.Clock();

  const resize = () => {
    const vp = document.getElementById('viewport');
    renderer.setSize(vp.clientWidth, vp.clientHeight);
    camera.aspect = vp.clientWidth / vp.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
}

// ── Load Character ───────────────────────────────────────────────
async function loadCharacter() {
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  gltfLoader.setDRACOLoader(dracoLoader);

  const gltf = await gltfLoader.loadAsync('/models/tvmanwelcomenpc-v1.glb');
  model = gltf.scene;
  model.name = 'TVMan';

  model.traverse((child) => {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });

  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  if (height > 0) model.scale.setScalar(1.0 / height);
  const sb = new THREE.Box3().setFromObject(model);
  model.position.y = -sb.min.y;

  scene.add(model);
  window.__model = model;

  const bones = [];
  model.traverse(obj => { if (obj.isBone) bones.push(obj.name); });
  console.log('Model bones:', bones.join(', '));

  dracoLoader.dispose();
}

// ── Scan Animation Packs ─────────────────────────────────────────
async function scanAnimations() {
  const fbxLoader = new FBXLoader();

  let packNames = [];
  try {
    const resp = await fetch('/models/animations/_manifest.json');
    if (resp.ok) {
      const manifest = await resp.json();
      packNames = manifest.packs.map(p => p.name);
    }
  } catch {}

  if (packNames.length === 0) {
    packNames = [
      'Rig_Medium_CombatMelee', 'Rig_Medium_CombatRanged', 'Rig_Medium_General',
      'Rig_Medium_MovementAdvanced', 'Rig_Medium_MovementBasic',
      'Rig_Medium_Simulation', 'Rig_Medium_Special', 'Rig_Medium_Tools',
    ];
  }

  document.getElementById('now-playing').textContent = `Loading ${packNames.length} animation packs...`;

  // Load all packs to discover clips
  for (const packName of packNames) {
    try {
      const fbx = await fbxLoader.loadAsync(`/models/animations/${packName}.fbx`);
      fbxCache.set(packName, { fbx, animations: fbx.animations });

      // Use first loaded FBX as the reference skeleton for retargeting
      if (!referenceFBX) {
        referenceFBX = fbx;
        // Add to scene (invisible) so world matrices can be computed
        scene.add(referenceFBX);
        retargeter = new RuntimeRetargeter(referenceFBX, model);
      }

      const clips = fbx.animations.map((clip, i) => ({ name: clip.name, index: i }));
      packs.push({ packName, clips });
      console.log(`${packName}: ${clips.length} clips`);
    } catch (err) {
      console.warn(`Could not load ${packName}: ${err.message}`);
    }
  }

  // Build flat list
  flatClips = [];
  for (const pack of packs) {
    for (const clip of pack.clips) {
      flatClips.push({ packName: pack.packName, clipIndex: clip.index, clipName: clip.name });
    }
  }

  document.getElementById('now-playing').textContent = `${flatClips.length} clips across ${packs.length} packs`;
}

// ── Build Sidebar ────────────────────────────────────────────────
let searchFilter = '';

function buildSidebar() {
  const nav = document.getElementById('series-nav');
  nav.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'series-btn active';
  allBtn.textContent = 'ALL';
  allBtn.onclick = () => filterByPack(null);
  nav.appendChild(allBtn);

  for (const pack of packs) {
    const btn = document.createElement('button');
    btn.className = 'series-btn';
    btn.textContent = pack.packName.replace('Rig_Medium_', '');
    btn.dataset.pack = pack.packName;
    btn.onclick = () => filterByPack(pack.packName);
    nav.appendChild(btn);
  }

  renderList();
  document.getElementById('anim-count').textContent = `${flatClips.length} clips`;

  document.getElementById('search-box').oninput = (e) => {
    searchFilter = e.target.value.toLowerCase();
    renderList();
  };
}

let activePack = null;

function filterByPack(packName) {
  activePack = packName;
  document.querySelectorAll('.series-btn').forEach(b => {
    b.classList.toggle('active', packName === null ? b.textContent === 'ALL' : b.dataset.pack === packName);
  });
  renderList();
}

function getFilteredClips() {
  return flatClips.filter(c => {
    if (activePack && c.packName !== activePack) return false;
    if (searchFilter) {
      const labelKey = `${c.packName}:${c.clipName}`;
      const label = labels[labelKey] || '';
      if (!c.clipName.toLowerCase().includes(searchFilter) &&
          !c.packName.toLowerCase().includes(searchFilter) &&
          !label.toLowerCase().includes(searchFilter)) return false;
    }
    return true;
  });
}

function renderList() {
  const list = document.getElementById('anim-list');
  list.innerHTML = '';
  const filtered = getFilteredClips();

  let currentPackHeader = null;

  for (const entry of filtered) {
    if (entry.packName !== currentPackHeader && !activePack) {
      currentPackHeader = entry.packName;
      const header = document.createElement('div');
      header.style.cssText = 'padding:6px 12px;font-size:0.7rem;color:#4a9eff;font-weight:bold;border-top:1px solid #333;margin-top:4px;';
      header.textContent = entry.packName.replace('Rig_Medium_', '');
      list.appendChild(header);
    }

    const flatIdx = flatClips.indexOf(entry);
    const labelKey = `${entry.packName}:${entry.clipName}`;
    const div = document.createElement('div');
    div.className = 'anim-item' + (labels[labelKey] ? ' labeled' : '') + (flatIdx === currentFlatIndex ? ' active' : '');
    div.dataset.flatIdx = flatIdx;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = entry.clipName;
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.flex = '1';
    div.appendChild(nameSpan);

    if (labels[labelKey]) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'anim-label';
      labelSpan.textContent = labels[labelKey];
      div.appendChild(labelSpan);
    }

    div.onclick = () => loadAnimation(flatIdx);
    list.appendChild(div);
  }

  document.getElementById('anim-count').textContent =
    `${filtered.length} / ${flatClips.length} clips`;
}

// ── Load & Play Animation ────────────────────────────────────────
let loadingAnim = false;

async function loadAnimation(flatIndex) {
  if (flatIndex < 0 || flatIndex >= flatClips.length || loadingAnim) return;
  loadingAnim = true;
  currentFlatIndex = flatIndex;
  const entry = flatClips[flatIndex];

  document.getElementById('now-playing').textContent = `Loading ${entry.clipName}...`;

  try {
    const cached = fbxCache.get(entry.packName);
    if (!cached) throw new Error(`Pack ${entry.packName} not cached`);

    const clip = cached.animations[entry.clipIndex];

    if (retargeter) {
      retargeter.play(clip, { fadeTime: 0.15 });
    }

    const labelKey = `${entry.packName}:${entry.clipName}`;
    const label = labels[labelKey] ? ` [${labels[labelKey]}]` : '';
    document.getElementById('now-playing').textContent =
      `${entry.clipName}${label} — ${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks`;
    document.getElementById('label-input').value = labels[labelKey] || '';
  } catch (err) {
    document.getElementById('now-playing').textContent = `Error: ${err.message}`;
    console.error(err);
  }

  loadingAnim = false;
  renderList();

  const active = document.querySelector('.anim-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// ── Controls ─────────────────────────────────────────────────────
function setupControls() {
  document.getElementById('prev-btn').onclick = () => {
    const filtered = getFilteredClips();
    if (filtered.length === 0) return;
    const curInFiltered = filtered.findIndex(c => flatClips.indexOf(c) === currentFlatIndex);
    const prev = curInFiltered <= 0 ? filtered.length - 1 : curInFiltered - 1;
    loadAnimation(flatClips.indexOf(filtered[prev]));
  };

  document.getElementById('next-btn').onclick = () => {
    const filtered = getFilteredClips();
    if (filtered.length === 0) return;
    const curInFiltered = filtered.findIndex(c => flatClips.indexOf(c) === currentFlatIndex);
    const next = curInFiltered >= filtered.length - 1 ? 0 : curInFiltered + 1;
    loadAnimation(flatClips.indexOf(filtered[next]));
  };

  document.getElementById('play-btn').onclick = () => {
    isPlaying = !isPlaying;
    if (retargeter && retargeter.currentAction) {
      retargeter.currentAction.paused = !isPlaying;
    }
    document.getElementById('play-btn').innerHTML = isPlaying ? '&#9646;&#9646; Pause' : '&#9654; Play';
  };

  document.getElementById('slower-btn').onclick = () => {
    speed = Math.max(0.1, speed * 0.5);
    if (retargeter && retargeter.currentAction) {
      retargeter.currentAction.setEffectiveTimeScale(speed);
    }
    document.getElementById('speed-display').textContent = `Speed: ${speed.toFixed(2)}x`;
  };

  document.getElementById('faster-btn').onclick = () => {
    speed = Math.min(4, speed * 2);
    if (retargeter && retargeter.currentAction) {
      retargeter.currentAction.setEffectiveTimeScale(speed);
    }
    document.getElementById('speed-display').textContent = `Speed: ${speed.toFixed(2)}x`;
  };

  document.getElementById('assign-btn').onclick = () => {
    if (currentFlatIndex < 0) return;
    const entry = flatClips[currentFlatIndex];
    const labelKey = `${entry.packName}:${entry.clipName}`;
    const label = document.getElementById('label-input').value.trim();
    if (label) {
      labels[labelKey] = label;
    } else {
      delete labels[labelKey];
    }
    localStorage.setItem('tvrobo-anim-labels', JSON.stringify(labels));
    renderList();
  };

  document.getElementById('export-btn').onclick = () => {
    const data = JSON.stringify(labels, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animation-labels.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case 'ArrowLeft': document.getElementById('prev-btn').click(); break;
      case 'ArrowRight': document.getElementById('next-btn').click(); break;
      case ' ': e.preventDefault(); document.getElementById('play-btn').click(); break;
    }
  });
}

// ── Render Loop ──────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  // Update runtime retargeter (advances FBX animation + copies bone rotations)
  if (retargeter) retargeter.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

// ── Init ─────────────────────────────────────────────────────────
async function main() {
  initScene();
  await loadCharacter();

  document.getElementById('loading-overlay').classList.add('hidden');

  await scanAnimations();
  buildSidebar();
  setupControls();
  animate();

  console.log(`Animation previewer ready. ${flatClips.length} clips in ${packs.length} packs.`);
}

main().catch(err => {
  console.error('Previewer error:', err);
  document.getElementById('loading-overlay').innerHTML =
    `<div style="color:#ff6b6b">Error: ${err.message}</div>`;
});
