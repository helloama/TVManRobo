import * as THREE from 'three';
import { gsap } from 'gsap';
import { createScene } from './scene.js';
import { setupLighting } from './lighting.js';
import { createRoom } from './room.js';
import { WORLD_LAYOUTS } from './world/layoutConfig.js';
import {
  initPhysics,
  createPlayerBody,
  createPushableBlockBody,
  createGrabbableBody,
  createRoomColliders,
  removeRoomColliders,
  removeDynamicBody,
  stepPhysics,
  castGroundRay,
} from './physics.js';
import { Player, PlayerState } from './player.js';
import { ThirdPersonControls } from './controls.js';
import { setupResizeHandler } from './utils.js';
import { GameStateManager, GamePhase } from './gameState.js';
import { CutsceneSystem } from './cutsceneSystem.js';
import { CUTSCENE_PRESETS } from './cutscenePresets.js';
import { FirstPersonCameraMode } from './firstPersonCamera.js';
import { NPCSystem } from './npcSystem.js';
import { ShopSystem } from './shopSystem.js';
import { MusicalFootstepSystem } from './footstepAudio.js';

const POWER_TUNING = {
  maxEnergy: 100,
  drainRunningPerSec: 2.25,
  drainMovingPerSec: 1.6,
  drainIdlePerSec: 0.28,
  rechargePerSec: 36,
  interactRange: 3.4,
  wakeThreshold: 5,
  cableSag: 0.42,
};

const CLEANING_TUNING = {
  stainBaseOpacity: 0.76,
  stainHighlightOpacity: 0.95,
  stainInteractPadding: 0.2,
  waterBaseOpacity: 0.62,
  waterHighlightOpacity: 0.9,
  storyTriggerBaseGlow: 0.45,
  storyTriggerHighlightGlow: 0.95,
};

const CLIMB_TUNING = {
  interactRange: 1.15,
  climbSpeed: 1.95,
  snapOffset: 0.38,
  topExitBoost: 0.62,
};

const DAY_CYCLE_TUNING = {
  realSecondsPerHalfDay: 5 * 60,
  inGameHoursPerCycle: 12,
  dayStartHour: 18,
  fadeDuration: 0.65,
  summaryDuration: 1.8,
};

const TOOL_DEFS = [
  {
    id: 'toothbrush',
    label: 'Toothbrush',
    interaction: 'stain',
    description: 'Scrub stains and grime.',
    unlockedByDefault: true,
  },
  {
    id: 'syringe',
    label: 'Syringe',
    interaction: 'water',
    description: 'Siphon water spills.',
    unlockedByDefault: true,
  },
];

const SHOP_ITEMS = [
  {
    id: 'battery_upgrade_1',
    name: 'Battery Upgrade 1',
    description: '+20 max battery capacity.',
    cost: 60,
    oneShot: true,
  },
  {
    id: 'helicopter_rotor',
    name: 'Helicopter Rotor',
    description: 'Unlocks future high-air traversal module.',
    cost: 90,
    oneShot: true,
  },
  {
    id: 'signal_map',
    name: 'Signal Mapper',
    description: 'Highlights story hotspots in future builds.',
    cost: 45,
    oneShot: true,
  },
];

const PUSHABLE_TUNING = {
  contactPadding: 0.2,
  minPushDot: 0.24,
  impulsePerSecond: 3.7,
  maxPlanarSpeed: 1.4,
  yTolerance: 1.4,
};

const GLIDE_TUNING = {
  maxFallSpeed: -1.25,
  horizontalControlBoost: 1.38,
  speedMultiplier: 0.92,
  drainPerSec: 3.6,
};

const CARRY_TUNING = {
  interactRange: 1.35,
  speedMultiplier: 0.82,
  throwImpulse: 3.9,
  upwardThrowImpulse: 1.1,
  holdOffset: new THREE.Vector3(0.05, 0.2, 0.2),
};

async function main() {
  await initPhysics();

  const { scene, renderer, camera } = createScene();
  setupResizeHandler(renderer, camera);

  let roomGroup = null;
  let parkourGroup = null;
  let dimensions = null;
  let roomColliderBodies = [];
  let currentRoomKey = 'mainFloor';
  let syncParkourVisibility = () => {};

  const routeMarkers = [];
  const outlets = [];
  const stains = [];
  const waters = [];
  const climbables = [];
  const storyTriggers = [];
  const npcs = [];
  const shopTerminals = [];
  const pushables = [];
  const grabbables = [];
  const roomTransitions = [];

  const replaceArray = (target, source = []) => {
    target.length = 0;
    target.push(...source);
  };

  const loadRoomLayout = async (roomKey) => {
    const layout = WORLD_LAYOUTS[roomKey] || WORLD_LAYOUTS.mainFloor;
    if (!layout) {
      throw new Error(`Unknown room layout key: ${roomKey}`);
    }

    if (roomGroup) {
      scene.remove(roomGroup);
      disposeObjectTree(roomGroup);
      roomGroup = null;
    }

    if (roomColliderBodies.length > 0) {
      removeRoomColliders(roomColliderBodies);
      roomColliderBodies = [];
    }

    const roomContext = await createRoom(scene, layout);
    roomGroup = roomContext.roomGroup;
    parkourGroup = roomContext.parkourGroup || roomGroup.getObjectByName('parkour_platforms') || null;
    dimensions = roomContext.dimensions || null;
    roomColliderBodies = createRoomColliders(roomContext.colliderDefs || []);

    if (dimensions) {
      const maxDim = Math.max(dimensions.width, dimensions.depth);
      camera.far = Math.max(camera.far, maxDim * 4);
      camera.updateProjectionMatrix();
    }

    replaceArray(routeMarkers, roomContext.routeMarkers || []);
    replaceArray(outlets, roomContext.outlets || []);
    replaceArray(stains, roomContext.stains || []);
    replaceArray(waters, roomContext.waters || []);
    replaceArray(climbables, roomContext.climbables || []);
    replaceArray(storyTriggers, roomContext.storyTriggers || []);
    replaceArray(npcs, roomContext.npcs || []);
    replaceArray(shopTerminals, roomContext.shopTerminals || []);
    replaceArray(pushables, roomContext.pushables || []);
    replaceArray(grabbables, roomContext.grabbables || []);
    replaceArray(roomTransitions, roomContext.roomTransitions || []);

    currentRoomKey = roomKey;
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
    window.__parkourGroup = parkourGroup;

    syncParkourVisibility();
  };

  await loadRoomLayout(currentRoomKey);

  setupLighting(scene, dimensions);

  if (dimensions) {
    const maxDim = Math.max(dimensions.width, dimensions.depth);
    camera.far = maxDim * 4;
    camera.updateProjectionMatrix();
  }

  const player = new Player(scene);
  await player.load();
  player.group.visible = false;
  window.__player = player;

  const spawnPos = { x: 0, y: 1.5, z: -8 };
  const { rigidBody } = createPlayerBody(spawnPos);
  player.setRigidBody(rigidBody);

  const gsm = new GameStateManager(camera);
  let lastParkourPhase = null;
  syncParkourVisibility = () => {
    if (!parkourGroup) return;
    const phase = gsm.phase;
    if (phase === lastParkourPhase) return;
    lastParkourPhase = phase;

    // Keep traversal surfaces hidden in menu/title, visible during active play.
    parkourGroup.visible = phase === GamePhase.GAMEPLAY;
  };
  let controls = null;
  let cameraOccluders = buildCameraOccluders(roomGroup);
  const cameraFollowDir = new THREE.Vector3();

  let pushableActors = [];
  let grabbableActors = [];

  const COYOTE_TIME = 0.12;
  const JUMP_BUFFER_TIME = 0.1;

  let coyoteTimer = 0;
  let jumpBufferTimer = 0;
  let hasConsumedAirJump = false;
  let groundedFrames = 0;
  let isGroundedRaw = false;
  let isGroundedStable = false;

  let batteryEnergy = POWER_TUNING.maxEnergy;
  let powerDepleted = false;
  let isPluggedIn = false;
  let activeOutlet = null;
  let nearestOutlet = null;
  let nearestOutletDist = Infinity;

  let happyPoints = 0;
  const cleanedStainIds = new Set();
  let nearestStain = null;
  let nearestStainDist = Infinity;

  let nearestStoryTrigger = null;
  let nearestStoryTriggerDist = Infinity;

  let nearestNpc = null;
  let nearestNpcDist = Infinity;
  let nearestShopTerminal = null;
  let nearestShopTerminalDist = Infinity;
  let activeShopTerminal = null;
  let nearestGrabbable = null;
  let nearestGrabbableDist = Infinity;
  let carriedActor = null;

  let nearestClimbable = null;
  let nearestClimbableDist = Infinity;
  let isClimbing = false;
  let activeClimbable = null;
  const activeClimbNormal = new THREE.Vector3(0, 0, 1);
  let isGliding = false;

  let isCutsceneActive = false;
  let dayTransitionActive = false;
  let roomTransitionActive = false;
  let isNpcDialogueActive = false;
  let introCutsceneQueued = false;
  let introCutscenePlayed = false;

  let cycleRemaining = DAY_CYCLE_TUNING.realSecondsPerHalfDay;
  let cycleIndex = 1;
  let cycleHappyPoints = 0;
  let lifetimeHappyPoints = 0;

  const unlockedTools = new Set(
    TOOL_DEFS.filter((tool) => tool.unlockedByDefault).map((tool) => tool.id)
  );
  let equippedToolId = TOOL_DEFS.find((tool) => tool.unlockedByDefault)?.id || TOOL_DEFS[0].id;
  let isToolMenuOpen = false;
  let aimingStain = null;
  let aimingWater = null;

  const energyPercentEl = document.getElementById('energy-percent');
  const energyFillEl = document.getElementById('energy-bar-fill');
  const energyStateEl = document.getElementById('energy-state');
  const happyPointsValueEl = document.getElementById('happy-points-value');
  const stainsRemainingEl = document.getElementById('stains-remaining');
  const interactPromptEl = document.getElementById('interact-prompt');
  const toolHudLabelEl = document.getElementById('tool-hud-name');
  const timeClockEl = document.getElementById('tod-clock');
  const timeRemainingEl = document.getElementById('tod-remaining');
  const cycleLabelEl = document.getElementById('tod-cycle');
  const dayFadeEl = document.getElementById('day-fade-overlay');
  const daySummaryEl = document.getElementById('day-summary-popup');
  const daySummaryCycleEl = document.getElementById('day-summary-cycle');
  const daySummaryEarnedEl = document.getElementById('day-summary-earned');
  const daySummaryTotalEl = document.getElementById('day-summary-total');
  const toolInventoryEl = document.getElementById('tool-inventory');
  const toolListEl = document.getElementById('tool-list');
  const toolHintEl = document.getElementById('tool-inventory-hint');
  const currencyValueEl = document.getElementById('currency-value');
  const inventoryCountEl = document.getElementById('inventory-count');
  const fpvIndicatorEl = document.getElementById('fpv-indicator');

  const npcDialogueRootEl = document.getElementById('npc-dialogue-overlay');
  const npcSpeakerEl = document.getElementById('npc-dialogue-speaker');
  const npcTextEl = document.getElementById('npc-dialogue-text');
  const npcChoicesEl = document.getElementById('npc-dialogue-choices');
  const npcHintEl = document.getElementById('npc-dialogue-hint');

  const shopRootEl = document.getElementById('shop-overlay');
  const shopCurrencyEl = document.getElementById('shop-currency');
  const shopInventoryEl = document.getElementById('shop-inventory-count');
  const shopItemListEl = document.getElementById('shop-item-list');
  const shopHintEl = document.getElementById('shop-hint');

  const plugCable = createPlugCable(scene, 12);
  const interactionRaycaster = new THREE.Raycaster();
  const interactionNdc = new THREE.Vector2(0, 0);
  const powerStats = {
    maxEnergy: POWER_TUNING.maxEnergy,
    batteryUpgradePurchased: false,
  };
  const economyState = {
    currency: 0,
    inventory: [],
  };

  let firstPersonMode = null;
  let npcSystem = null;
  let shopSystem = null;
  let footstepSystem = null;

  const setInteractPrompt = (text = '', visible = false) => {
    if (!interactPromptEl) return;
    interactPromptEl.textContent = text;
    interactPromptEl.classList.toggle('visible', visible);
  };

  const isGameplayControlLocked = () => (
    isToolMenuOpen
    || isCutsceneActive
    || dayTransitionActive
    || roomTransitionActive
    || isNpcDialogueActive
    || firstPersonMode?.isActive
    || firstPersonMode?.isTransitioning
    || shopSystem?.isOpen
  );

  const refreshControlLock = () => {
    if (!controls) return;
    controls.setEnabled(!isGameplayControlLocked());
  };

  const updateEconomyHud = () => {
    if (currencyValueEl) {
      currencyValueEl.textContent = `${economyState.currency}`;
    }
    if (inventoryCountEl) {
      inventoryCountEl.textContent = `${economyState.inventory.length}`;
    }
  };

  const setFirstPersonHud = (visible) => {
    if (!fpvIndicatorEl) return;
    fpvIndicatorEl.classList.toggle('hidden', !visible);
  };

  const getToolDef = (toolId) => TOOL_DEFS.find((tool) => tool.id === toolId) || TOOL_DEFS[0];

  const updateToolHud = () => {
    if (!toolHudLabelEl) return;
    const toolDef = getToolDef(equippedToolId);
    toolHudLabelEl.textContent = toolDef?.label || 'None';
  };

  const renderToolInventory = () => {
    if (!toolListEl) return;
    toolListEl.innerHTML = '';

    for (const tool of TOOL_DEFS) {
      const button = document.createElement('button');
      button.className = 'tool-entry';
      button.dataset.toolId = tool.id;

      const unlocked = unlockedTools.has(tool.id);
      if (!unlocked) button.classList.add('locked');
      if (tool.id === equippedToolId) button.classList.add('selected');

      button.innerHTML = `
        <div class="tool-entry-title">${tool.label}${unlocked ? '' : ' (Locked)'}</div>
        <div class="tool-entry-desc">${tool.description}</div>
      `;

      button.disabled = !unlocked;
      button.addEventListener('click', () => {
        if (!unlocked) return;
        equippedToolId = tool.id;
        updateToolHud();
        renderToolInventory();
        setToolMenuOpen(false);
      });

      toolListEl.appendChild(button);
    }
  };

  const setToolMenuOpen = (open) => {
    if (isToolMenuOpen === open) return;
    isToolMenuOpen = open;
    if (toolInventoryEl) {
      toolInventoryEl.classList.toggle('hidden', !isToolMenuOpen);
    }

    if (toolHintEl) {
      toolHintEl.textContent = isToolMenuOpen
        ? 'Select a tool, or press Tab to close'
        : 'Press Tab to equip tools';
    }

    if (isToolMenuOpen) {
      renderToolInventory();
      setInteractPrompt('Tool menu open', true);
    } else if (!dayTransitionActive && !isCutsceneActive) {
      setInteractPrompt('', false);
    }

    refreshControlLock();
  };

  const updateTimeHud = () => {
    const safeRemaining = Math.max(0, cycleRemaining);

    if (timeRemainingEl) {
      const mm = Math.floor(safeRemaining / 60);
      const ss = Math.floor(safeRemaining % 60);
      timeRemainingEl.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
    }

    if (cycleLabelEl) {
      cycleLabelEl.textContent = `Cycle ${cycleIndex}`;
    }

    if (timeClockEl) {
      const progress = 1 - (safeRemaining / DAY_CYCLE_TUNING.realSecondsPerHalfDay);
      const hoursAdvanced = progress * DAY_CYCLE_TUNING.inGameHoursPerCycle;
      let clockHour = DAY_CYCLE_TUNING.dayStartHour + hoursAdvanced;
      while (clockHour >= 24) clockHour -= 24;
      const hour = Math.floor(clockHour);
      const minute = Math.floor((clockHour - hour) * 60);
      timeClockEl.textContent = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  };

  const updateEnergyHud = () => {
    const pct = Math.round((batteryEnergy / powerStats.maxEnergy) * 100);

    if (energyPercentEl) {
      energyPercentEl.textContent = `${pct}%`;
    }

    if (energyFillEl) {
      energyFillEl.style.width = `${pct}%`;
      energyFillEl.style.filter = pct <= 15
        ? 'saturate(1.15) brightness(1.05)'
        : 'saturate(1.1)';
    }

    if (energyStateEl) {
      if (isPluggedIn) {
        energyStateEl.textContent = `Status: Recharging (+${POWER_TUNING.rechargePerSec.toFixed(0)}%/s)`;
      } else if (powerDepleted) {
        energyStateEl.textContent = 'Status: Shutdown (Battery Empty)';
      } else if (isGliding) {
        energyStateEl.textContent = `Status: Gliding (-${GLIDE_TUNING.drainPerSec.toFixed(1)}%/s)`;
      } else if (isClimbing && Math.abs(controls?.getClimbAxis?.() ?? 0) > 0.01) {
        energyStateEl.textContent = `Status: Climbing (-${POWER_TUNING.drainMovingPerSec.toFixed(1)}%/s)`;
      } else if (controls?.isRunning) {
        energyStateEl.textContent = `Status: Sprinting (-${POWER_TUNING.drainRunningPerSec.toFixed(1)}%/s)`;
      } else if (controls?.isMoving) {
        energyStateEl.textContent = `Status: Draining (-${POWER_TUNING.drainMovingPerSec.toFixed(1)}%/s)`;
      } else {
        energyStateEl.textContent = `Status: Idle Drain (-${POWER_TUNING.drainIdlePerSec.toFixed(1)}%/s)`;
      }
    }
  };

  const updateHappyHud = () => {
    if (happyPointsValueEl) {
      happyPointsValueEl.textContent = `${happyPoints}`;
    }

    if (stainsRemainingEl) {
      const remaining = Math.max(0, stains.length - cleanedStainIds.size);
      stainsRemainingEl.textContent = `${remaining} stains left`;
    }
  };

  const updateOutletVisuals = () => {
    for (const outlet of outlets) {
      const plateMat = outlet.mesh?.material;
      const ledMat = outlet.led?.material;
      const ringMat = outlet.ring?.material;

      if (plateMat && 'emissiveIntensity' in plateMat) {
        plateMat.emissiveIntensity = 0.05;
      }
      if (ledMat && 'emissiveIntensity' in ledMat) {
        ledMat.emissiveIntensity = 0.35;
      }
      if (ringMat && 'emissiveIntensity' in ringMat) {
        ringMat.emissiveIntensity = 0.35;
      }

      if (outlet === nearestOutlet && nearestOutletDist <= POWER_TUNING.interactRange) {
        if (plateMat && 'emissiveIntensity' in plateMat) {
          plateMat.emissiveIntensity = 0.32;
        }
        if (ledMat && 'emissiveIntensity' in ledMat) {
          ledMat.emissiveIntensity = 0.85;
        }
        if (ringMat && 'emissiveIntensity' in ringMat) {
          ringMat.emissiveIntensity = 0.95;
        }
      }

      if (outlet === activeOutlet) {
        if (plateMat && 'emissiveIntensity' in plateMat) {
          plateMat.emissiveIntensity = 0.6;
        }
        if (ledMat && 'emissiveIntensity' in ledMat) {
          ledMat.emissiveIntensity = 1.0;
        }
        if (ringMat && 'emissiveIntensity' in ringMat) {
          ringMat.emissiveIntensity = 1.15;
        }
      }
    }
  };

  const updateStainVisuals = () => {
    for (const stain of stains) {
      if (!stain.mesh || stain.cleaned) continue;

      const mat = stain.mesh.material;
      if (!mat || !('opacity' in mat)) continue;

      const isNear = stain === nearestStain
        && nearestStainDist <= stain.interactRadius + CLEANING_TUNING.stainInteractPadding;
      const isAimed = stain === aimingStain;
      mat.opacity = (isNear || isAimed)
        ? CLEANING_TUNING.stainHighlightOpacity
        : CLEANING_TUNING.stainBaseOpacity;
    }
  };

  const updateWaterVisuals = () => {
    for (const water of waters) {
      if (!water.mesh || water.cleared) continue;
      const mat = water.mesh.material;
      if (!mat || !('opacity' in mat)) continue;
      const isAimed = water === aimingWater;
      mat.opacity = isAimed
        ? CLEANING_TUNING.waterHighlightOpacity
        : CLEANING_TUNING.waterBaseOpacity;
    }
  };

  const updateStoryTriggerVisuals = () => {
    for (const trigger of storyTriggers) {
      const mat = trigger.orb?.material;
      if (!mat || !('emissiveIntensity' in mat)) continue;

      if (trigger.used) {
        mat.emissiveIntensity = 0.18;
        continue;
      }

      const isNear = trigger === nearestStoryTrigger && nearestStoryTriggerDist <= trigger.radius;
      mat.emissiveIntensity = isNear
        ? CLEANING_TUNING.storyTriggerHighlightGlow
        : CLEANING_TUNING.storyTriggerBaseGlow;
    }
  };

  const updateShopTerminalVisuals = () => {
    for (const terminal of shopTerminals) {
      const mat = terminal.screen?.material;
      if (!mat || !('emissiveIntensity' in mat)) continue;

      mat.emissiveIntensity = 0.5;
      const nearActive = terminal === nearestShopTerminal
        && nearestShopTerminalDist <= terminal.interactRadius;
      if (nearActive) {
        mat.emissiveIntensity = 0.9;
      }
      if (terminal === activeShopTerminal && shopSystem?.isOpen) {
        mat.emissiveIntensity = 1.15;
      }
    }
  };

  const updateNearestOutlet = (playerPos) => {
    nearestOutlet = null;
    nearestOutletDist = Infinity;

    for (const outlet of outlets) {
      const d = horizontalDistance(playerPos, outlet.socketPosition);
      if (d < nearestOutletDist) {
        nearestOutletDist = d;
        nearestOutlet = outlet;
      }
    }
  };

  const updateNearestStain = (playerPos) => {
    nearestStain = null;
    nearestStainDist = Infinity;

    for (const stain of stains) {
      if (stain.cleaned) continue;

      const d = horizontalDistance(playerPos, stain.position);
      if (d < nearestStainDist) {
        nearestStainDist = d;
        nearestStain = stain;
      }
    }
  };

  const updateNearestStoryTrigger = (playerPos) => {
    nearestStoryTrigger = null;
    nearestStoryTriggerDist = Infinity;

    for (const trigger of storyTriggers) {
      if (trigger.once && trigger.used) continue;

      const d = horizontalDistance(playerPos, trigger.position);
      if (d < nearestStoryTriggerDist) {
        nearestStoryTriggerDist = d;
        nearestStoryTrigger = trigger;
      }
    }
  };

  const updateNearestNpc = (playerPos) => {
    if (!npcSystem) {
      nearestNpc = null;
      nearestNpcDist = Infinity;
      return;
    }
    const nearest = npcSystem.getNearestNpc(playerPos);
    nearestNpc = nearest.npc;
    nearestNpcDist = nearest.distance;
  };

  const updateNearestShopTerminal = (playerPos) => {
    nearestShopTerminal = null;
    nearestShopTerminalDist = Infinity;

    for (const terminal of shopTerminals) {
      const d = horizontalDistance(playerPos, terminal.position);
      if (d < nearestShopTerminalDist) {
        nearestShopTerminal = terminal;
        nearestShopTerminalDist = d;
      }
    }
  };

  const updateNearestGrabbable = (playerPos) => {
    nearestGrabbable = null;
    nearestGrabbableDist = Infinity;

    for (const actor of grabbableActors) {
      if (actor === carriedActor) continue;
      const d = horizontalDistance(playerPos, actor.mesh.position);
      if (d < nearestGrabbableDist) {
        nearestGrabbable = actor;
        nearestGrabbableDist = d;
      }
    }
  };

  const getActiveRoomTransition = (playerPos) => {
    for (const trigger of roomTransitions) {
      if (trigger.box.containsPoint(playerPos)) {
        return trigger;
      }
    }
    return null;
  };

  const updateNearestClimbable = (playerPos) => {
    nearestClimbable = null;
    nearestClimbableDist = Infinity;

    for (const climbable of climbables) {
      const dx = playerPos.x - climbable.position.x;
      const dz = playerPos.z - climbable.position.z;
      const horizontal = Math.max(
        0,
        Math.hypot(dx, dz) - Math.max(climbable.radius, climbable.width * 0.45)
      );
      const yPenalty = playerPos.y < climbable.baseY
        ? climbable.baseY - playerPos.y
        : playerPos.y > climbable.topY
          ? playerPos.y - climbable.topY
          : 0;
      const d = Math.hypot(horizontal, yPenalty * 0.7);
      if (d < nearestClimbableDist) {
        nearestClimbableDist = d;
        nearestClimbable = climbable;
      }
    }
  };

  const getClimbableRayHit = (playerPos) => {
    if (climbables.length === 0) return null;

    const origin = playerPos.clone().add(new THREE.Vector3(0, 0.45, 0));
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() < 1e-6) return null;
    direction.normalize();

    interactionRaycaster.set(origin, direction);
    interactionRaycaster.far = CLIMB_TUNING.interactRange + 0.35;
    const hits = interactionRaycaster.intersectObjects(
      climbables.map((entry) => entry.mesh),
      false
    );
    if (hits.length === 0) return null;

    const first = hits[0];
    const climbable = climbables.find((entry) => entry.mesh === first.object);
    if (!climbable) return null;

    const normal = first.face?.normal
      ? first.face.normal.clone().transformDirection(first.object.matrixWorld).normalize()
      : climbable.normal.clone();

    return {
      climbable,
      point: first.point.clone(),
      normal,
      distance: first.distance,
    };
  };

  const getAimedInteractionTarget = (playerPos) => {
    aimingStain = null;
    aimingWater = null;

    const toolDef = getToolDef(equippedToolId);
    const list = toolDef.interaction === 'stain' ? stains : waters;
    const meshes = list
      .filter((entry) => !(entry.cleaned || entry.cleared))
      .map((entry) => entry.mesh)
      .filter(Boolean);
    if (meshes.length === 0) return null;

    interactionRaycaster.setFromCamera(interactionNdc, camera);
    interactionRaycaster.far = 3.6;
    const hits = interactionRaycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;

    const best = hits[0];
    const distanceToPlayer = horizontalDistance(playerPos, best.point);
    if (distanceToPlayer > 2.2) return null;

    if (toolDef.interaction === 'stain') {
      const stain = stains.find((entry) => entry.mesh === best.object);
      if (!stain || stain.cleaned) return null;
      aimingStain = stain;
      return { type: 'stain', entry: stain };
    }

    const water = waters.find((entry) => entry.mesh === best.object);
    if (!water || water.cleared) return null;
    aimingWater = water;
    return { type: 'water', entry: water };
  };

  const collectStain = (stain) => {
    if (!stain || stain.cleaned || cleanedStainIds.has(stain.id)) return;

    stain.cleaned = true;
    cleanedStainIds.add(stain.id);
    const points = stain.points ?? 10;
    happyPoints += points;
    cycleHappyPoints += points;
    shopSystem?.addCurrency(points);

    if (stain.mesh) {
      const mat = stain.mesh.material;
      if (mat && 'opacity' in mat) {
        gsap.to(mat, {
          opacity: 0.05,
          duration: 0.22,
          ease: 'power1.out',
        });
      }

      gsap.to(stain.mesh.scale, {
        x: 0.08,
        y: 0.08,
        z: 0.08,
        duration: 0.24,
        ease: 'power1.out',
        onComplete: () => {
          stain.mesh.visible = false;
        },
      });
    }

    updateHappyHud();
  };

  const collectWater = (water) => {
    if (!water || water.cleared) return;

    water.cleared = true;
    const points = water.points ?? 8;
    happyPoints += points;
    cycleHappyPoints += points;
    shopSystem?.addCurrency(points);

    if (water.mesh) {
      const mat = water.mesh.material;
      if (mat && 'opacity' in mat) {
        gsap.to(mat, {
          opacity: 0.05,
          duration: 0.22,
          ease: 'power1.out',
        });
      }

      gsap.to(water.mesh.scale, {
        x: 0.07,
        y: 0.07,
        z: 0.07,
        duration: 0.24,
        ease: 'power1.out',
        onComplete: () => {
          water.mesh.visible = false;
        },
      });
    }

    updateHappyHud();
  };

  const resetStains = () => {
    cleanedStainIds.clear();
    for (const stain of stains) {
      stain.cleaned = false;
      if (!stain.mesh) continue;
      stain.mesh.visible = true;
      stain.mesh.scale.set(1, 1, 1);
      const mat = stain.mesh.material;
      if (mat && 'opacity' in mat) {
        mat.opacity = CLEANING_TUNING.stainBaseOpacity;
      }
    }
  };

  const resetWaters = () => {
    for (const water of waters) {
      water.cleared = false;
      if (!water.mesh) continue;
      water.mesh.visible = true;
      water.mesh.scale.set(1, 1, 1);
      const mat = water.mesh.material;
      if (mat && 'opacity' in mat) {
        mat.opacity = CLEANING_TUNING.waterBaseOpacity;
      }
    }
  };

  const resetStoryTriggers = () => {
    for (const trigger of storyTriggers) {
      trigger.used = false;
      const mat = trigger.orb?.material;
      if (mat && 'emissiveIntensity' in mat) {
        mat.emissiveIntensity = CLEANING_TUNING.storyTriggerBaseGlow;
      }
    }
  };

  const clearPushableActors = () => {
    for (const actor of pushableActors) {
      removeDynamicBody(actor.rigidBody);
      actor.rigidBody = null;
    }
    pushableActors = [];
  };

  const clearGrabbableActors = () => {
    for (const actor of grabbableActors) {
      removeDynamicBody(actor.rigidBody);
      actor.rigidBody = null;
      actor.mesh?.parent?.remove(actor.mesh);
      if (actor.mesh) {
        actor.mesh.position.copy(actor.position);
        actor.mesh.quaternion.identity();
      }
    }
    grabbableActors = [];
    carriedActor = null;
  };

  const rebuildDynamicRoomActors = () => {
    clearPushableActors();
    clearGrabbableActors();

    pushableActors = pushables.map((entry) => {
      const { rigidBody: blockBody } = createPushableBlockBody({
        position: entry.position,
        size: entry.size,
        mass: entry.mass,
        friction: entry.friction,
        linearDamping: entry.linearDamping,
        angularDamping: entry.angularDamping,
      });
      return {
        ...entry,
        rigidBody: blockBody,
        halfSize: entry.size.clone().multiplyScalar(0.5),
      };
    });

    grabbableActors = grabbables.map((entry) => {
      const { rigidBody: body } = createGrabbableBody({
        position: entry.position,
        size: entry.size,
        mass: entry.mass,
      });
      return {
        ...entry,
        rigidBody: body,
      };
    });

    window.__pushableActors = pushableActors;
    window.__grabbableActors = grabbableActors;
  };

  const pickUpGrabbable = (actor) => {
    if (!actor || carriedActor) return false;
    carriedActor = actor;

    if (actor.rigidBody) {
      removeDynamicBody(actor.rigidBody);
      actor.rigidBody = null;
    }

    const anchor = player.getCarryAnchorNode();
    if (!anchor) {
      carriedActor = null;
      return false;
    }

    anchor.add(actor.mesh);
    actor.mesh.position.copy(CARRY_TUNING.holdOffset);
    actor.mesh.quaternion.identity();
    return true;
  };

  const throwCarried = () => {
    if (!carriedActor) return false;

    const actor = carriedActor;
    carriedActor = null;
    const worldPos = actor.mesh.getWorldPosition(new THREE.Vector3());
    const worldQuat = actor.mesh.getWorldQuaternion(new THREE.Quaternion());
    roomGroup.add(actor.mesh);
    actor.mesh.position.copy(worldPos);
    actor.mesh.quaternion.copy(worldQuat);

    const { rigidBody: body } = createGrabbableBody({
      position: actor.mesh.position,
      size: actor.size,
      mass: actor.mass,
    });
    actor.rigidBody = body;

    const throwDir = camera.getWorldDirection(_tmpVecA).setY(0);
    if (throwDir.lengthSq() < 1e-6) {
      player.getForwardVector(throwDir);
    } else {
      throwDir.normalize();
    }

    const impulse = throwDir.multiplyScalar(CARRY_TUNING.throwImpulse);
    actor.rigidBody.applyImpulse(
      { x: impulse.x, y: CARRY_TUNING.upwardThrowImpulse, z: impulse.z },
      true
    );
    return true;
  };

  const beginRoomTransition = async (transition) => {
    if (!transition || roomTransitionActive) return;
    roomTransitionActive = true;

    if (isClimbing) exitClimbState(false);
    if (isPluggedIn) unplugFromOutlet();
    if (shopSystem?.isOpen) {
      shopSystem.close();
      activeShopTerminal = null;
    }
    if (npcSystem?.isConversationActive) npcSystem.cancelConversation('transition');
    if (firstPersonMode?.isActive) {
      firstPersonMode.exitTo(null, null, 0.01);
    } else if (firstPersonMode?.isTransitioning) {
      firstPersonMode.cancelTransition();
      player.setVisualVisible(true);
      setFirstPersonHud(false);
    }
    if (carriedActor) throwCarried();

    setToolMenuOpen(false);
    refreshControlLock();
    setInteractPrompt('', false);

    if (dayFadeEl) {
      dayFadeEl.classList.remove('hidden');
      dayFadeEl.style.opacity = '0';
      dayFadeEl.style.visibility = 'visible';
      await gsap.to(dayFadeEl, {
        autoAlpha: 1,
        duration: 0.35,
        ease: 'power2.out',
      });
    }

    const targetRoom = transition.targetRoom || currentRoomKey;
    const targetSpawn = transition.targetSpawn || new THREE.Vector3(0, 1.5, 0);
    await loadRoomLayout(targetRoom);
    rebuildDynamicRoomActors();
    cameraOccluders = buildCameraOccluders(roomGroup);
    controls?.setCameraCollisionMeshes(cameraOccluders);
    npcSystem?.setNpcs?.(npcs);

    rigidBody.setTranslation(targetSpawn, true);
    rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rigidBody.setGravityScale(1, true);
    player.syncFromPhysics();

    if (controls && player.group) {
      const orbitTarget = player.group.position.clone().setY(player.group.position.y + 0.42);
      controls.syncOrbitFromCamera(orbitTarget);
    }

    if (dayFadeEl) {
      await gsap.to(dayFadeEl, {
        autoAlpha: 0,
        duration: 0.35,
        ease: 'power1.inOut',
      });
      dayFadeEl.classList.add('hidden');
    }

    roomTransitionActive = false;
    refreshControlLock();
  };

  const applyPlayerPushToPushables = (playerPos, moveDir, delta) => {
    if (!moveDir || pushableActors.length === 0) return;

    for (const actor of pushableActors) {
      if (!actor.rigidBody) continue;
      const bodyPos = actor.rigidBody.translation();
      const blockPos = _tmpVecA.set(bodyPos.x, bodyPos.y, bodyPos.z);
      const halfXZ = Math.max(actor.halfSize.x, actor.halfSize.z);
      const contactRange = halfXZ + 0.42 + PUSHABLE_TUNING.contactPadding;
      const dist = horizontalDistance(playerPos, blockPos);
      if (dist > contactRange) continue;

      if (Math.abs(playerPos.y - bodyPos.y) > PUSHABLE_TUNING.yTolerance) continue;

      _tmpVecB.set(blockPos.x - playerPos.x, 0, blockPos.z - playerPos.z);
      const dirLenSq = _tmpVecB.lengthSq();
      if (dirLenSq < 1e-6) continue;
      _tmpVecB.multiplyScalar(1 / Math.sqrt(dirLenSq));

      const pushDot = moveDir.dot(_tmpVecB);
      if (pushDot < PUSHABLE_TUNING.minPushDot) continue;

      const impulseStrength = PUSHABLE_TUNING.impulsePerSecond * pushDot * delta;
      _tmpVecC.copy(moveDir).multiplyScalar(impulseStrength);

      actor.rigidBody.applyImpulse(
        { x: _tmpVecC.x, y: 0, z: _tmpVecC.z },
        true
      );

      const vel = actor.rigidBody.linvel();
      const planarSpeed = Math.hypot(vel.x, vel.z);
      if (planarSpeed > PUSHABLE_TUNING.maxPlanarSpeed) {
        const scale = PUSHABLE_TUNING.maxPlanarSpeed / planarSpeed;
        actor.rigidBody.setLinvel(
          { x: vel.x * scale, y: vel.y, z: vel.z * scale },
          true
        );
      }
    }
  };

  const syncPushablesFromPhysics = () => {
    for (const actor of pushableActors) {
      if (!actor.mesh || !actor.rigidBody) continue;
      const t = actor.rigidBody.translation();
      const r = actor.rigidBody.rotation();
      actor.mesh.position.set(t.x, t.y, t.z);
      actor.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }

    for (const actor of grabbableActors) {
      if (!actor.mesh || !actor.rigidBody) continue;
      if (actor === carriedActor) continue;
      const t = actor.rigidBody.translation();
      const r = actor.rigidBody.rotation();
      actor.mesh.position.set(t.x, t.y, t.z);
      actor.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  };

  const plugIntoOutlet = (outlet) => {
    isPluggedIn = true;
    activeOutlet = outlet;
    jumpBufferTimer = 0;

    setInteractPrompt('Plugged in — Press E to unplug', true);
  };

  const unplugFromOutlet = () => {
    isPluggedIn = false;
    activeOutlet = null;
    plugCable.line.visible = false;
  };

  const snapPositionToClimbable = (climbable, yValue, normal) => {
    const clampedY = clamp(yValue, climbable.baseY + 0.22, climbable.topY + 0.06);
    const anchor = climbable.position.clone();
    const outward = normal.clone().setY(0);
    if (outward.lengthSq() < 1e-6) {
      outward.copy(climbable.normal);
    }
    outward.normalize();

    const radial = Math.max(climbable.radius, climbable.width * 0.45) + CLIMB_TUNING.snapOffset;
    anchor.addScaledVector(outward, radial);
    anchor.y = clampedY;
    return anchor;
  };

  const exitClimbState = (boostUp = false) => {
    if (!isClimbing) return;
    isClimbing = false;
    activeClimbable = null;
    rigidBody.setGravityScale(1, true);
    const vel = rigidBody.linvel();
    rigidBody.setLinvel({ x: 0, y: boostUp ? CLIMB_TUNING.topExitBoost : vel.y, z: 0 }, true);
  };

  const enterClimbState = (climbHit) => {
    if (!climbHit?.climbable) return;
    activeClimbable = climbHit.climbable;
    activeClimbNormal.copy(climbHit.normal).setY(0);
    if (activeClimbNormal.lengthSq() < 1e-6) {
      activeClimbNormal.copy(activeClimbable.normal);
    }
    activeClimbNormal.normalize();

    isClimbing = true;
    jumpBufferTimer = 0;
    coyoteTimer = 0;
    hasConsumedAirJump = true;
    rigidBody.setGravityScale(0, true);
    rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

    const pos = rigidBody.translation();
    const snapped = snapPositionToClimbable(
      activeClimbable,
      pos.y,
      activeClimbNormal
    );
    rigidBody.setTranslation(snapped, true);
    player.targetRotationY = Math.atan2(-activeClimbNormal.x, -activeClimbNormal.z);
    setInteractPrompt('Climbing: W/S move, E to drop', true);
  };

  const updateClimbing = (delta) => {
    if (!isClimbing || !activeClimbable) return;
    const verticalAxis = controls.getClimbAxis();
    const pos = rigidBody.translation();
    const desiredY = pos.y + verticalAxis * CLIMB_TUNING.climbSpeed * delta;

    const snapped = snapPositionToClimbable(activeClimbable, desiredY, activeClimbNormal);
    rigidBody.setTranslation(snapped, true);
    rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

    const nearTop = snapped.y >= activeClimbable.topY - 0.05;
    if (verticalAxis > 0 && nearTop) {
      exitClimbState(true);
      return;
    }

    player.setState(Math.abs(verticalAxis) > 0.01 ? PlayerState.WALKING : PlayerState.IDLE);
  };

  const beginDayCycleTransition = () => {
    if (dayTransitionActive) return;
    dayTransitionActive = true;

    const cycleEarned = cycleHappyPoints;
    lifetimeHappyPoints += cycleEarned;

    if (shopSystem?.isOpen) {
      shopSystem.close();
      activeShopTerminal = null;
    }
    if (npcSystem?.isConversationActive) npcSystem.cancelConversation('day-end');
    if (firstPersonMode?.isActive) {
      firstPersonMode.exitTo(null, null, 0.01);
    } else if (firstPersonMode?.isTransitioning) {
      firstPersonMode.cancelTransition();
      player.setVisualVisible(true);
      setFirstPersonHud(false);
    }
    if (isPluggedIn) unplugFromOutlet();
    if (isClimbing) exitClimbState(false);
    if (carriedActor) throwCarried();
    setToolMenuOpen(false);
    refreshControlLock();

    if (daySummaryCycleEl) daySummaryCycleEl.textContent = `Cycle ${cycleIndex} Complete`;
    if (daySummaryEarnedEl) daySummaryEarnedEl.textContent = `Happy Points Earned: +${cycleEarned}`;
    if (daySummaryTotalEl) daySummaryTotalEl.textContent = `Session Total: ${lifetimeHappyPoints}`;
    if (daySummaryEl) daySummaryEl.classList.remove('hidden');
    if (dayFadeEl) dayFadeEl.classList.remove('hidden');

    const resetCycleState = () => {
      cycleIndex += 1;
      cycleRemaining = DAY_CYCLE_TUNING.realSecondsPerHalfDay;
      cycleHappyPoints = 0;
      batteryEnergy = powerStats.maxEnergy;
      powerDepleted = false;
      rigidBody.setTranslation(spawnPos, true);
      rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (player.group) {
        const lookTarget = player.group.position.clone().setY(player.group.position.y + 0.42);
        controls?.syncOrbitFromCamera(lookTarget);
      }
      updateTimeHud();
    };

    if (!dayFadeEl) {
      resetCycleState();
      if (daySummaryEl) daySummaryEl.classList.add('hidden');
      dayTransitionActive = false;
      refreshControlLock();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        if (dayFadeEl) dayFadeEl.classList.add('hidden');
        if (daySummaryEl) daySummaryEl.classList.add('hidden');
        dayTransitionActive = false;
        refreshControlLock();
      },
    });

    tl.to(dayFadeEl, {
      autoAlpha: 1,
      duration: DAY_CYCLE_TUNING.fadeDuration,
      ease: 'power2.out',
    })
      .to({}, { duration: DAY_CYCLE_TUNING.summaryDuration })
      .add(() => {
        resetCycleState();
      })
      .to(dayFadeEl, {
        autoAlpha: 0,
        duration: DAY_CYCLE_TUNING.fadeDuration,
        ease: 'power1.inOut',
      });
  };

  const computeThirdPersonPose = () => {
    if (!controls || !player.group) return null;

    const followDistance = 3.85;
    const lookTarget = player.group.position
      .clone()
      .setY(player.group.position.y + 0.42)
      .add(controls.targetOffset);

    const offsetX = followDistance * Math.sin(controls.phi) * Math.sin(controls.theta);
    const offsetY = followDistance * Math.cos(controls.phi);
    const offsetZ = followDistance * Math.sin(controls.phi) * Math.cos(controls.theta);

    const position = new THREE.Vector3(
      lookTarget.x + offsetX,
      lookTarget.y + offsetY,
      lookTarget.z + offsetZ
    );

    return { position, lookTarget };
  };

  const exitFirstPersonMode = () => {
    if (!firstPersonMode?.isActive) return;
    const pose = computeThirdPersonPose();
    if (pose) {
      firstPersonMode.exitTo(pose.position, pose.lookTarget, 0.36);
    } else {
      firstPersonMode.exitTo(null, null, 0.01);
    }
    refreshControlLock();
  };

  firstPersonMode = new FirstPersonCameraMode({
    camera,
    canvas: renderer.domElement,
    getHeadPosition: (out) => player.getHeadWorldPosition(out),
    onEnter: () => {
      player.setVisualVisible(false);
      setFirstPersonHud(true);
    },
    onExit: () => {
      player.setVisualVisible(true);
      setFirstPersonHud(false);
    },
  });

  shopSystem = new ShopSystem({
    root: shopRootEl,
    currencyLabel: shopCurrencyEl,
    inventoryLabel: shopInventoryEl,
    itemList: shopItemListEl,
    hintLabel: shopHintEl,
    onLockChange: (locked) => {
      if (locked) {
        setToolMenuOpen(false);
        if (npcSystem?.isConversationActive) npcSystem.cancelConversation('shop-open');
        exitFirstPersonMode();
      }
      refreshControlLock();
    },
    onPurchase: (item) => {
      if (item.id === 'battery_upgrade_1' && !powerStats.batteryUpgradePurchased) {
        powerStats.batteryUpgradePurchased = true;
        powerStats.maxEnergy += 20;
        batteryEnergy = Math.min(batteryEnergy + 20, powerStats.maxEnergy);
      }
    },
    onStateChange: ({ currency, inventory }) => {
      economyState.currency = currency;
      economyState.inventory = inventory;
      updateEconomyHud();
      window.Currency = economyState.currency;
      window.Inventory = [...economyState.inventory];
    },
  });
  shopSystem.configure({ items: SHOP_ITEMS, currency: 0, inventory: [] });

  npcSystem = new NPCSystem({
    npcDefs: npcs,
    dialogueRoot: npcDialogueRootEl,
    dialogueSpeaker: npcSpeakerEl,
    dialogueText: npcTextEl,
    dialogueChoices: npcChoicesEl,
    dialogueHint: npcHintEl,
    onLockChange: (locked) => {
      isNpcDialogueActive = locked;
      if (locked) {
        setToolMenuOpen(false);
        if (shopSystem?.isOpen) {
          shopSystem.close();
          activeShopTerminal = null;
        }
        exitFirstPersonMode();
      }
      refreshControlLock();
    },
    onCurrencyAward: (amount) => {
      if (amount > 0) {
        shopSystem?.addCurrency(amount);
      }
    },
  });

  const surfaceRaycaster = new THREE.Raycaster();
  const getSurfaceTypeAtPlayer = () => {
    if (!roomGroup) return 'wood';
    const pos = player.getPosition();
    surfaceRaycaster.set(
      _tmpVecA.set(pos.x, pos.y + 0.35, pos.z),
      _tmpVecB.set(0, -1, 0)
    );
    surfaceRaycaster.far = 2.4;
    const hits = surfaceRaycaster.intersectObject(roomGroup, true);
    for (const hit of hits) {
      const obj = hit.object;
      const surface = obj?.userData?.surface;
      if (surface) return surface;
    }
    return 'wood';
  };

  footstepSystem = new MusicalFootstepSystem({
    getSurfaceType: getSurfaceTypeAtPlayer,
  });
  window.__footstepSystem = footstepSystem;

  updateEconomyHud();
  setFirstPersonHud(false);
  rebuildDynamicRoomActors();
  window.__npcSystem = npcSystem;
  window.__shopSystem = shopSystem;
  window.Currency = economyState.currency;
  window.Inventory = [...economyState.inventory];

  const cutsceneSystem = new CutsceneSystem({
    camera,
    dialogueRoot: document.getElementById('cutscene-overlay'),
    dialogueText: document.getElementById('cutscene-dialogue-text'),
    dialogueSpeaker: document.getElementById('cutscene-speaker'),
    onLockChange: (locked) => {
      isCutsceneActive = locked;
      jumpBufferTimer = 0;

      if (locked) {
        setToolMenuOpen(false);
        if (shopSystem?.isOpen) {
          shopSystem.close();
          activeShopTerminal = null;
        }
        if (npcSystem?.isConversationActive) npcSystem.cancelConversation('cutscene');
        exitFirstPersonMode();
      }
      refreshControlLock();

      if (locked) {
        setInteractPrompt('', false);
      } else if (controls && player.group) {
        const followTarget = player.group.position.clone();
        controls.syncOrbitFromCamera(followTarget);
      }
    },
  });
  cutsceneSystem.registerPresets(CUTSCENE_PRESETS);
  window.__cutsceneSystem = cutsceneSystem;

  window.addEventListener('keydown', (e) => {
    if (!cutsceneSystem.isActive) return;
    if (e.code === 'Escape') {
      cutsceneSystem.skipActive();
      e.preventDefault();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Tab') return;
    if (gsm.phase !== GamePhase.GAMEPLAY) return;
    if (dayTransitionActive || roomTransitionActive || isCutsceneActive || isNpcDialogueActive || shopSystem?.isOpen || firstPersonMode?.isActive) return;
    e.preventDefault();
    setToolMenuOpen(!isToolMenuOpen);
  });

  window.addEventListener('keydown', (e) => {
    if (gsm.phase !== GamePhase.GAMEPLAY) return;

    if (e.code === 'KeyE' && !e.repeat) {
      if (npcSystem?.isConversationActive) {
        npcSystem.advanceConversation();
        e.preventDefault();
        return;
      }
      if (shopSystem?.isOpen) {
        shopSystem.close();
        activeShopTerminal = null;
        e.preventDefault();
        return;
      }
    }

    if (e.code === 'Escape') {
      if (shopSystem?.isOpen) {
        shopSystem.close();
        activeShopTerminal = null;
        e.preventDefault();
        return;
      }
      if (npcSystem?.isConversationActive) {
        npcSystem.cancelConversation('escape');
        e.preventDefault();
        return;
      }
    }

    if (e.code === 'KeyP') {
      if (dayTransitionActive || roomTransitionActive || isCutsceneActive || isNpcDialogueActive || isClimbing || isPluggedIn) return;
      e.preventDefault();
      setToolMenuOpen(false);
      exitFirstPersonMode();
      if (!shopSystem?.isOpen) {
        activeShopTerminal = nearestShopTerminalDist <= (nearestShopTerminal?.interactRadius ?? 0)
          ? nearestShopTerminal
          : null;
      } else {
        activeShopTerminal = null;
      }
      shopSystem?.toggle();
      return;
    }

    if (e.code === 'KeyZ') {
      if (firstPersonMode?.isTransitioning || dayTransitionActive || roomTransitionActive || isCutsceneActive || shopSystem?.isOpen || isNpcDialogueActive) {
        return;
      }

      e.preventDefault();
      if (firstPersonMode?.isActive) {
        exitFirstPersonMode();
        return;
      }

      if (isToolMenuOpen || isPluggedIn || powerDepleted || isClimbing) return;
      setToolMenuOpen(false);
      firstPersonMode?.enter();
      refreshControlLock();
    }
  });

  const playCutscene = (id, context = {}) => cutsceneSystem.play(id, context);

  const tryPlayStoryTrigger = (trigger) => {
    if (!trigger || !trigger.cutsceneId) return;
    if (trigger.once && trigger.used) return;

    playCutscene(trigger.cutsceneId, { triggerId: trigger.id })
      .then((played) => {
        if (played && trigger.once) {
          trigger.used = true;
        }
      });
  };

  gsm.onRevealPlayer = () => {
    player.group.visible = true;
    player.group.position.set(spawnPos.x, 0, spawnPos.z);
  };

  gsm.onGameplayStart = async () => {
    if (cutsceneSystem.isActive) {
      cutsceneSystem.skipActive();
    }

    if (npcSystem?.isConversationActive) npcSystem.cancelConversation('restart');
    if (shopSystem?.isOpen) {
      shopSystem.close();
      activeShopTerminal = null;
    }
    if (firstPersonMode?.isActive) {
      firstPersonMode.exitTo(null, null, 0.01);
    }
    firstPersonMode?.cancelTransition();
    player.setVisualVisible(true);
    setFirstPersonHud(false);

    if (currentRoomKey !== 'mainFloor') {
      roomTransitionActive = true;
      await loadRoomLayout('mainFloor');
      cameraOccluders = buildCameraOccluders(roomGroup);
      controls?.setCameraCollisionMeshes(cameraOccluders);
      npcSystem?.setNpcs?.(npcs);
      roomTransitionActive = false;
    }

    player.group.visible = true;
    rigidBody.setTranslation(spawnPos, true);
    rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

    coyoteTimer = 0;
    jumpBufferTimer = 0;
    hasConsumedAirJump = false;
    groundedFrames = 0;
    isGroundedRaw = false;
    isGroundedStable = false;

    batteryEnergy = powerStats.maxEnergy;
    powerDepleted = false;
    isPluggedIn = false;
    activeOutlet = null;
    nearestOutlet = null;
    nearestOutletDist = Infinity;
    nearestStain = null;
    nearestStainDist = Infinity;
    nearestClimbable = null;
    nearestClimbableDist = Infinity;
    nearestStoryTrigger = null;
    nearestStoryTriggerDist = Infinity;
    nearestNpc = null;
    nearestNpcDist = Infinity;
    nearestShopTerminal = null;
    nearestShopTerminalDist = Infinity;
    activeShopTerminal = null;
    nearestGrabbable = null;
    nearestGrabbableDist = Infinity;
    isCutsceneActive = false;
    dayTransitionActive = false;
    roomTransitionActive = false;
    isNpcDialogueActive = false;
    isClimbing = false;
    isGliding = false;
    activeClimbable = null;
    carriedActor = null;

    happyPoints = 0;
    lifetimeHappyPoints = 0;
    cycleHappyPoints = 0;
    cycleIndex = 1;
    cycleRemaining = DAY_CYCLE_TUNING.realSecondsPerHalfDay;
    resetStains();
    resetWaters();
    resetStoryTriggers();
    powerStats.maxEnergy = POWER_TUNING.maxEnergy;
    powerStats.batteryUpgradePurchased = false;
    shopSystem?.configure({ items: SHOP_ITEMS, currency: 0, inventory: [] });
    rebuildDynamicRoomActors();
    footstepSystem?.resetCycle();

    if (!controls) {
      controls = new ThirdPersonControls(camera, renderer.domElement, rigidBody);
      const lookInit = new THREE.Vector3(spawnPos.x, 0.72, spawnPos.z);
      controls.cameraLookTarget.copy(lookInit);
      controls.cameraTarget.copy(lookInit);
      controls.setCameraCollisionMeshes(cameraOccluders);
    }
    setToolMenuOpen(false);
    refreshControlLock();
    rigidBody.setGravityScale(1, true);

    updateEnergyHud();
    updateHappyHud();
    updateEconomyHud();
    updateToolHud();
    updateTimeHud();
    setInteractPrompt('', false);

    if (!introCutscenePlayed && !introCutsceneQueued) {
      introCutsceneQueued = true;
      setTimeout(() => {
        introCutsceneQueued = false;
        if (cutsceneSystem.isActive) return;
        playCutscene('introArrival', { source: 'gameplay_start' }).then((played) => {
          if (played) introCutscenePlayed = true;
        });
      }, 420);
    }
  };

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.classList.add('hidden');
  gsm.setPhase(GamePhase.TITLE);
  syncParkourVisibility();

  updateEnergyHud();
  updateHappyHud();
  updateEconomyHud();
  updateToolHud();
  updateTimeHud();
  renderToolInventory();
  updateOutletVisuals();
  updateStainVisuals();
  updateWaterVisuals();
  updateStoryTriggerVisuals();
  updateShopTerminalVisuals();

  const clock = new THREE.Clock();

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = Math.min(clock.getDelta(), 0.05);
    syncParkourVisibility();

    if (gsm.phase === GamePhase.GAMEPLAY && controls) {
      npcSystem?.update(delta);
      const preStepPos = player.getPosition();
      updateNearestOutlet(preStepPos);
      updateNearestStain(preStepPos);
      updateNearestClimbable(preStepPos);
      updateNearestStoryTrigger(preStepPos);
      updateNearestNpc(preStepPos);
      updateNearestShopTerminal(preStepPos);
      updateNearestGrabbable(preStepPos);

      const transitionCandidate = (
        !roomTransitionActive
        && !dayTransitionActive
        && !isCutsceneActive
      ) ? getActiveRoomTransition(preStepPos) : null;

      if (transitionCandidate && !isNpcDialogueActive && !shopSystem?.isOpen) {
        beginRoomTransition(transitionCandidate);
      }

      if (!dayTransitionActive && !roomTransitionActive) {
        cycleRemaining = Math.max(0, cycleRemaining - delta);
        if (cycleRemaining <= 0) {
          beginDayCycleTransition();
        }
      }

      const interactPressed = controls.consumeInteractIntent();
      const primaryActionPressed = controls.consumePrimaryActionIntent();
      const climbHit = getClimbableRayHit(preStepPos);
      const climbableCandidate = climbHit
        ?? (nearestClimbable && nearestClimbableDist <= CLIMB_TUNING.interactRange
          ? { climbable: nearestClimbable, normal: nearestClimbable.normal, point: nearestClimbable.position }
          : null);

      const canUseWorldInteractions =
        !isCutsceneActive
        && !dayTransitionActive
        && !roomTransitionActive
        && !isToolMenuOpen
        && !isNpcDialogueActive
        && !firstPersonMode?.isActive
        && !firstPersonMode?.isTransitioning
        && !shopSystem?.isOpen;

      if (interactPressed) {
        if (npcSystem?.isConversationActive) {
          npcSystem.advanceConversation();
        } else if (shopSystem?.isOpen) {
          shopSystem.close();
          activeShopTerminal = null;
        } else if (isClimbing) {
          exitClimbState(false);
        } else if (canUseWorldInteractions && nearestNpc && nearestNpcDist <= nearestNpc.interactRadius) {
          const npcPos = nearestNpc.getWorldPosition(_tmpVecA);
          const dx = npcPos.x - preStepPos.x;
          const dz = npcPos.z - preStepPos.z;
          if (Math.hypot(dx, dz) > 1e-4) {
            player.targetRotationY = Math.atan2(-dx, -dz);
          }
          npcSystem.startConversation(nearestNpc);
        } else if (
          canUseWorldInteractions
          && nearestShopTerminal
          && nearestShopTerminalDist <= nearestShopTerminal.interactRadius
        ) {
          activeShopTerminal = nearestShopTerminal;
          shopSystem?.open();
        } else if (carriedActor) {
          throwCarried();
        } else if (
          canUseWorldInteractions
          && nearestGrabbable
          && nearestGrabbableDist <= CARRY_TUNING.interactRange
        ) {
          pickUpGrabbable(nearestGrabbable);
        } else if (canUseWorldInteractions && climbableCandidate && !powerDepleted && !isPluggedIn) {
          enterClimbState(climbableCandidate);
        } else if (isPluggedIn) {
          unplugFromOutlet();
        } else if (powerDepleted && !isClimbing) {
          if (nearestOutlet && nearestOutletDist <= POWER_TUNING.interactRange) {
            plugIntoOutlet(nearestOutlet);
          }
        } else if (
          nearestStoryTrigger &&
          nearestStoryTriggerDist <= nearestStoryTrigger.radius &&
          !(nearestStoryTrigger.once && nearestStoryTrigger.used)
        ) {
          tryPlayStoryTrigger(nearestStoryTrigger);
        } else if (nearestOutlet && nearestOutletDist <= POWER_TUNING.interactRange) {
          plugIntoOutlet(nearestOutlet);
        }
      }

      if (primaryActionPressed && canUseWorldInteractions && !powerDepleted && !isPluggedIn && !isClimbing) {
        const aimed = getAimedInteractionTarget(preStepPos);
        if (aimed?.type === 'stain') {
          collectStain(aimed.entry);
        } else if (aimed?.type === 'water') {
          collectWater(aimed.entry);
        }
      }

      const preVel = rigidBody.linvel();
      const glideAllowed = (
        !isClimbing
        && !isPluggedIn
        && !powerDepleted
        && !dayTransitionActive
        && !roomTransitionActive
        && !isCutsceneActive
        && !isToolMenuOpen
        && !isNpcDialogueActive
        && !shopSystem?.isOpen
        && !firstPersonMode?.isActive
        && !firstPersonMode?.isTransitioning
        && !isGroundedStable
        && preVel.y < -0.08
      );
      isGliding = glideAllowed && controls.isJumpHeld && batteryEnergy > 0.1;

      if (isGliding && preVel.y < GLIDE_TUNING.maxFallSpeed) {
        rigidBody.setLinvel(
          { x: preVel.x, y: GLIDE_TUNING.maxFallSpeed, z: preVel.z },
          true
        );
      }

      if (isPluggedIn) {
        batteryEnergy += POWER_TUNING.rechargePerSec * delta;
      } else if (roomTransitionActive) {
        // Freeze battery during streaming transitions.
      } else {
        const climbingMotion = isClimbing && Math.abs(controls.getClimbAxis()) > 0.01;
        const movingNow = climbingMotion || controls.isMoving;
        const drainRate = isGliding
          ? GLIDE_TUNING.drainPerSec
          : !climbingMotion && controls.isRunning
            ? POWER_TUNING.drainRunningPerSec
            : movingNow
              ? POWER_TUNING.drainMovingPerSec
              : POWER_TUNING.drainIdlePerSec;
        batteryEnergy -= drainRate * delta;
      }
      batteryEnergy = clamp(batteryEnergy, 0, powerStats.maxEnergy);

      if (batteryEnergy <= 0) {
        powerDepleted = true;
      } else if (powerDepleted && batteryEnergy >= POWER_TUNING.wakeThreshold) {
        powerDepleted = false;
      }

      const canMove = !isCutsceneActive
        && !isPluggedIn
        && !powerDepleted
        && !dayTransitionActive
        && !roomTransitionActive
        && !isToolMenuOpen
        && !isClimbing
        && !isNpcDialogueActive
        && !firstPersonMode?.isActive
        && !firstPersonMode?.isTransitioning
        && !shopSystem?.isOpen;
      const moveDir = canMove ? controls.getMovementDirection() : null;

      if (canMove && controls.consumeJumpIntent()) {
        jumpBufferTimer = JUMP_BUFFER_TIME;
      } else if (canMove) {
        jumpBufferTimer = Math.max(0, jumpBufferTimer - delta);
      } else {
        jumpBufferTimer = 0;
      }

      if (isClimbing) {
        coyoteTimer = 0;
      } else if (isGroundedRaw) {
        coyoteTimer = COYOTE_TIME;
      } else {
        coyoteTimer = Math.max(0, coyoteTimer - delta);
      }

      let jumpedThisFrame = false;
      const canJump =
        canMove &&
        jumpBufferTimer > 0 &&
        (isGroundedStable || coyoteTimer > 0) &&
        !hasConsumedAirJump;

      if (canJump) {
        player.jump(controls.jumpImpulse);
        player.setState(PlayerState.JUMPING);

        jumpBufferTimer = 0;
        coyoteTimer = 0;
        hasConsumedAirJump = true;
        groundedFrames = 0;
        isGroundedStable = false;
        jumpedThisFrame = true;
      }

      if (isClimbing) {
        updateClimbing(delta);
      } else if (canMove) {
        let moveSpeed = controls.getMoveSpeed();
        if (isGliding) {
          moveSpeed *= GLIDE_TUNING.speedMultiplier;
        }
        if (carriedActor) {
          moveSpeed *= CARRY_TUNING.speedMultiplier;
        }
        player.applyMovement(moveDir, moveSpeed, delta, {
          grounded: isGroundedStable,
          backpedalIntent: controls.isBackpedalIntent,
          airControlMultiplier: isGliding ? GLIDE_TUNING.horizontalControlBoost : 1,
        });
      } else {
        const vel = rigidBody.linvel();
        if (isPluggedIn || isCutsceneActive) {
          rigidBody.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
        } else {
          rigidBody.setLinvel({ x: vel.x * 0.55, y: vel.y, z: vel.z * 0.55 }, true);
        }
      }

      if (canMove && moveDir) {
        applyPlayerPushToPushables(preStepPos, moveDir, delta);
      }

      stepPhysics();
      player.syncFromPhysics();
      syncPushablesFromPhysics();

      const postStepPos = player.getPosition();
      const groundDist = castGroundRay(postStepPos, 1.2);
      isGroundedRaw = !isClimbing && groundDist !== null && groundDist < 0.72;

      groundedFrames = isGroundedRaw
        ? Math.min(groundedFrames + 1, 6)
        : 0;
      isGroundedStable = groundedFrames >= 2;

      const vel = rigidBody.linvel();
      const planarSpeed = Math.hypot(vel.x, vel.z);
      const landed = !isClimbing && isGroundedStable && !jumpedThisFrame && vel.y <= 0.1;

      if (landed) {
        hasConsumedAirJump = false;
      }

      if (powerDepleted) {
        player.setState(PlayerState.SHUTDOWN);
      } else if (
        dayTransitionActive
        || roomTransitionActive
        || isToolMenuOpen
        || isNpcDialogueActive
        || firstPersonMode?.isActive
        || firstPersonMode?.isTransitioning
        || shopSystem?.isOpen
      ) {
        player.setState(PlayerState.IDLE);
      } else if (isPluggedIn || isCutsceneActive) {
        player.setState(PlayerState.IDLE);
      } else if (isClimbing) {
        const climbAxis = controls.getClimbAxis();
        player.setState(Math.abs(climbAxis) > 0.01 ? PlayerState.WALKING : PlayerState.IDLE);
      } else if (isGliding) {
        player.setState(PlayerState.GLIDING);
      } else if (isGroundedStable) {
        const shouldMoveAnim = !!moveDir && planarSpeed > 0.24;
        if (shouldMoveAnim) {
          const runThreshold = controls.walkSpeed * 1.14;
          const shouldRunAnim = controls.isRunning
            && planarSpeed >= runThreshold
            && !player.isBackpedaling;
          player.setState(shouldRunAnim ? PlayerState.RUNNING : PlayerState.WALKING);
        } else {
          player.setState(PlayerState.IDLE);
        }
      } else if (vel.y < -0.5) {
        player.setState(PlayerState.FALLING);
      } else {
        player.setState(PlayerState.JUMPING);
      }

      player.update(delta);
      footstepSystem?.update({
        playerState: player.currentState,
        action: player.currentAction,
        grounded: isGroundedStable,
        moving: !!moveDir && planarSpeed > 0.18,
        running: controls.isRunning && planarSpeed > controls.walkSpeed * 1.05,
      });

      const visualPos = player.group
        ? player.group.position.clone().setY(player.group.position.y + 0.42)
        : postStepPos;

      if (!isCutsceneActive) {
        if (firstPersonMode?.isActive || firstPersonMode?.isTransitioning) {
          const fpState = firstPersonMode.update(delta);
          if (fpState === 'transition-complete') {
            const orbitTarget = player.group
              ? player.group.position.clone().setY(player.group.position.y + 0.42)
              : postStepPos;
            controls.syncOrbitFromCamera(orbitTarget);
            refreshControlLock();
          }
        } else {
          let followDir = null;
          if (moveDir) {
            followDir = moveDir;
          } else if (planarSpeed > 0.22) {
            cameraFollowDir.set(vel.x, 0, vel.z).normalize();
            followDir = cameraFollowDir;
          }
          controls.updateCamera(visualPos, delta, followDir);
        }
      }

      const aimedToolTarget = (
        !isToolMenuOpen
        && !isCutsceneActive
        && !dayTransitionActive
        && !roomTransitionActive
        && !isPluggedIn
        && !powerDepleted
        && !isClimbing
        && !isNpcDialogueActive
        && !firstPersonMode?.isActive
        && !firstPersonMode?.isTransitioning
        && !shopSystem?.isOpen
      )
        ? getAimedInteractionTarget(postStepPos)
        : null;

      if (isPluggedIn && activeOutlet && player.group) {
        const cableFrom = player.group.position.clone().add(new THREE.Vector3(0, 0.42, 0));
        const cableTo = activeOutlet.socketPosition.clone();
        updatePlugCable(plugCable, cableFrom, cableTo, POWER_TUNING.cableSag);
      } else {
        plugCable.line.visible = false;
      }

      if (dayTransitionActive) {
        setInteractPrompt('', false);
      } else if (roomTransitionActive) {
        setInteractPrompt('Transitioning room...', true);
      } else if (isCutsceneActive) {
        setInteractPrompt('', false);
      } else if (firstPersonMode?.isActive) {
        setInteractPrompt('First-person active (Z to return)', true);
      } else if (shopSystem?.isOpen) {
        setInteractPrompt('Shop open (Esc / P / E to close)', true);
      } else if (isNpcDialogueActive) {
        setInteractPrompt('Talking... (E continue)', true);
      } else if (isToolMenuOpen) {
        setInteractPrompt('Tool menu open (Tab to close)', true);
      } else if (isClimbing) {
        setInteractPrompt('Climbing: W/S move, E to drop', true);
      } else if (isGliding) {
        setInteractPrompt('Gliding... release Space to drop', true);
      } else if (isPluggedIn) {
        setInteractPrompt('Plugged in — Press E to unplug', true);
      } else if (powerDepleted) {
        if (nearestOutlet && nearestOutletDist <= POWER_TUNING.interactRange) {
          setInteractPrompt('Press E near outlet to recharge', true);
        } else {
          setInteractPrompt('Battery depleted — get close to an outlet and press E', true);
        }
      } else if (aimedToolTarget?.type === 'stain') {
        setInteractPrompt(`Click to scrub stain (+${aimedToolTarget.entry.points} Happy)`, true);
      } else if (aimedToolTarget?.type === 'water') {
        setInteractPrompt(`Click to siphon spill (+${aimedToolTarget.entry.points} Happy)`, true);
      } else if (climbableCandidate && nearestClimbableDist <= CLIMB_TUNING.interactRange) {
        setInteractPrompt('Press E to climb', true);
      } else if (carriedActor) {
        setInteractPrompt('Carrying item — Press E to throw', true);
      } else if (nearestGrabbable && nearestGrabbableDist <= CARRY_TUNING.interactRange) {
        setInteractPrompt('Press E to pick up object', true);
      } else if (nearestNpc && nearestNpcDist <= nearestNpc.interactRadius) {
        setInteractPrompt(`Press E to talk to ${nearestNpc.name}`, true);
      } else if (
        nearestShopTerminal
        && nearestShopTerminalDist <= nearestShopTerminal.interactRadius
      ) {
        setInteractPrompt(nearestShopTerminal.prompt || 'Press E to open shop', true);
      } else if (transitionCandidate) {
        setInteractPrompt(transitionCandidate.prompt || 'Transitioning...', true);
      } else if (
        nearestStoryTrigger &&
        nearestStoryTriggerDist <= nearestStoryTrigger.radius &&
        !(nearestStoryTrigger.once && nearestStoryTrigger.used)
      ) {
        setInteractPrompt(nearestStoryTrigger.prompt || 'Press E to inspect', true);
      } else if (nearestOutlet && nearestOutletDist <= POWER_TUNING.interactRange) {
        setInteractPrompt('Press E near outlet to recharge', true);
      } else if (batteryEnergy <= 25 && nearestOutlet) {
        setInteractPrompt(`Low battery: nearest outlet ${nearestOutletDist.toFixed(1)}m`, true);
      } else {
        setInteractPrompt('', false);
      }

      updateOutletVisuals();
      updateStainVisuals();
      updateWaterVisuals();
      updateStoryTriggerVisuals();
      updateShopTerminalVisuals();
      updateEnergyHud();
      updateHappyHud();
      updateEconomyHud();
      updateToolHud();
      updateTimeHud();
    } else {
      gsm.update(delta);
      footstepSystem?.resetCycle();

      if (daySummaryEl) daySummaryEl.classList.add('hidden');
      if (dayFadeEl) dayFadeEl.classList.add('hidden');
      dayTransitionActive = false;

      if (player.group.visible) {
        player.update(delta);
      }

      plugCable.line.visible = false;
    }

    renderer.render(scene, camera);
  }

  gameLoop();
}

function createPlugCable(scene, segments = 12) {
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    points.push(new THREE.Vector3());
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffe08a });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  return { line, points };
}

function updatePlugCable(cable, from, to, sag = 0.35) {
  const { line, points } = cable;

  for (let i = 0; i < points.length; i += 1) {
    const t = i / (points.length - 1);
    points[i].lerpVectors(from, to, t);
    points[i].y -= Math.sin(Math.PI * t) * sag;
  }

  line.geometry.setFromPoints(points);
  line.visible = true;
}

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();

function disposeObjectTree(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (Array.isArray(obj.material)) {
      for (const mat of obj.material) disposeMaterial(mat);
    } else if (obj.material) {
      disposeMaterial(obj.material);
    }
  });
}

function disposeMaterial(mat) {
  if (!mat) return;
  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (value && value.isTexture) {
      value.dispose();
    }
  }
  mat.dispose?.();
}

function buildCameraOccluders(roomGroup) {
  const occluders = [];
  if (!roomGroup) return occluders;

  roomGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    const name = obj.name || '';

    if (name.startsWith('stain_')) return;
    if (name.startsWith('water_')) return;
    if (name.startsWith('story_trigger_')) return;
    if (name.startsWith('outlet_')) return;

    occluders.push(obj);
  });

  return occluders;
}

main().catch((err) => {
  console.error('Failed to start TVRoboPhetta:', err);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.innerHTML = `<div style="color:#ff6b6b; font-family: 'Fredoka', sans-serif;">Error: ${err.message}</div>`;
  }
});
