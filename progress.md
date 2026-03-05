Original prompt: PLEASE IMPLEMENT THIS PLAN: TVManRobo Sprint Plan: Retarget Fix + Mega Room Parkour (Chibi-Robo Feel), including retarget stabilization (GLB pipeline), jump system rewrite (lower jump + no infinite jump + coyote/buffer), data-driven mega room expansion, and parkour routes/platform colliders.

## Work Log
- Initialized progress tracking file.

## TODO
- Reinstall dependencies for local macOS environment and verify build/dev startup.
- Implement retargeting + clip sanitation/validation + hips translation transfer.
- Implement jump queue/coyote/buffer/single-jump lock in controls/main loop.
- Refactor room to data-driven world config and add parkour builder.
- Update camera feel constants.
- Attempt jump.glb replacement; use fallback if conversion cannot be completed.
- Run verification steps and document remaining gaps.

### 2026-03-04 Preflight
- Ran `npm install` to restore local dependencies.
- `npm run build` / `npm run dev` currently fail with shell `Permission denied` on `node_modules/.bin/vite` in this environment.
- Verified build/dev using direct entrypoint instead:
  - `node ./node_modules/vite/bin/vite.js build` ✅
  - `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173` ✅

### 2026-03-04 World + Movement Refactor (in progress)
- Added `src/world/layoutConfig.js` with mega-room dimensions (60x18x46), 5-zone furniture layout (30+ placements), shell accents, and 3 parkour routes (48 total platform nodes).
- Added `src/world/parkourBuilder.js` to generate platform meshes + cuboid collider defs + route marker metadata.
- Refactored `src/room.js` to data-driven API: `createRoom(scene, layout = WORLD_LAYOUT_V2)` and return `{ roomGroup, colliderDefs, dimensions, routeMarkers }`.
- Updated `src/controls.js` to edge-triggered jump queue (no key-repeat jump), lower move/jump values, and tighter camera framing.
- Updated `src/main.js` with coyote time, jump buffer, single-jump lock, stable-ground requirement, and deterministic state transitions.
- Reworked `src/retarget.js` to support optional hips translation transfer with bind-pose delta scaling.
- Reworked `src/player.js` clip pipeline: sanitize tracks (remove scale, keep hips translation only), validate duration/coverage, and resolve clip fallbacks.

### 2026-03-04 Animation Asset + Validation
- Replaced invalid zero-duration `public/models/animations/jump.glb` with a valid non-zero GLB fallback clip (`fall.glb` copy) and backed up original as `jump_static_invalid_backup.glb`.
- Confirmed replacement duration is now ~0.667s (non-zero).

### 2026-03-04 Verification
- Build verification: `node ./node_modules/vite/bin/vite.js build` ✅
- Web game automation runs executed via `$WEB_GAME_CLIENT` with screenshots captured under:
  - `output/web-game/`
  - `output/web-game-gameplay2/`
  - `output/web-game-gameplay3/`
  - `output/web-game-gameplay4/`
  - `output/web-game-gameplay5/`
- Latest capture (`output/web-game-gameplay5`) confirms gameplay HUD + player visible in-world (post-title/menu flow).
- Automation environment reports pointer-lock pageerror:
  - `WrongDocumentError: The root document of this element is not valid for pointer lock.`
  This appears tied to synthetic headless click context, not app startup/build failure.

## Remaining TODO / Suggestions
- Replace fallback jump clip with true `Jump_Full_Short` conversion from `Rig_Medium_MovementBasic.fbx` when a stable FBX->GLB animation export toolchain is available.
- Add camera collision avoidance against nearby furniture to prevent occlusion when orbiting near large surfaces.
- Consider exposing `window.advanceTime(ms)` + `window.render_game_to_text()` for deterministic automation quality.
- Updated `package.json` scripts to invoke Vite via Node entrypoint directly so `npm run dev/build/preview` work in this environment.
- Verified `npm run build` and `npm run dev -- --host 127.0.0.1 --port 5173` now both execute successfully with updated scripts.

### 2026-03-04 Phase 2: Plug & Battery (implemented)
- Added battery HUD in `index.html`:
  - Percent readout (`#energy-percent`)
  - Fill bar (`#energy-bar-fill`) mapped to 0–100%
  - State text (`#energy-state`)
  - Context interaction prompt (`#interact-prompt`)
- Added interact input in `src/controls.js`:
  - Edge-triggered `E` queue (`consumeInteractIntent`) on non-repeat keydown
- Added outlet layout data in `src/world/layoutConfig.js`:
  - 8 wall-mounted outlets distributed across house zones
- Added outlet scene builder in `src/room.js`:
  - Visual outlet meshes (plate/slots/LED)
  - Socket metadata for interaction targeting (`socketPosition`, `normal`, refs)
  - `createRoom(...)` now returns `outlets`
- Added Plug & Battery gameplay loop in `src/main.js`:
  - Tunable constants in `POWER_TUNING` (`maxEnergy`, moving drain, idle drain, recharge rate, interact range, wake threshold, cable sag)
  - Continuous drain model:
    - Moving drains faster
    - Idle drains slower
  - Plug flow:
    - Near outlet + `E` => plug in
    - While plugged: movement/jump locked, xz velocity zeroed, recharge active
    - `E` again => unplug and resume movement
  - Added visible plug-tail cable line between TV-Man and active outlet while charging
  - Depleted behavior:
    - Battery at 0 sets `powerDepleted`
    - Movement and jump are disabled until charged above wake threshold
    - Player enters shutdown animation state while depleted
- Extended `src/player.js` with `PlayerState.SHUTDOWN` and fallback clip resolution.

### 2026-03-04 Phase 2 Verification
- `npm run build` ✅ (Vite production build succeeded)
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (dev server started at `http://127.0.0.1:5173/`)

### 2026-03-04 Phase 5: GSAP Cutscenes (implemented)
- Added GSAP dependency to the project (`gsap` in `package.json` / lockfile).
- Added reusable cutscene engine:
  - New file `src/cutsceneSystem.js`
  - API supports preset registration + playback by id (`registerPresets`, `play`, `hasPlayed`, `skipActive`)
  - Handles camera keyframe motion + look-at interpolation + dialogue box updates.
- Added cutscene preset library:
  - New file `src/cutscenePresets.js`
  - Presets include:
    - `introArrival` (trigger-driven intro sequence at gameplay start)
    - `signalLeak` (interaction-triggered story cutscene in junk/electronics zone)
- During cutscenes:
  - Player input is disabled (`controls.setEnabled(false)`).
  - Camera is controlled by GSAP timeline.
  - Dialogue UI box is shown and updated per key step.
- After cutscenes:
  - Input is restored.
  - Camera control is cleanly resynced to gameplay orbit (`controls.syncOrbitFromCamera(...)`).
- Updated `src/gameState.js` menu flow:
  - `New Game` now enters gameplay directly so intro is handled by GSAP cutscene system.

### 2026-03-04 Phase 4: Cleaning + Happy Points (implemented)
- Added data-driven stain definitions in `src/world/layoutConfig.js`:
  - New `stains` array with multi-zone placements + point values.
- Added interaction-trigger definitions in config:
  - New `storyTriggers` array (data-driven, cutscene-linked).
- Extended room builder (`src/room.js`):
  - New stain decal/interactable generation (`buildStains`)
  - New story trigger marker generation (`buildStoryTriggers`)
  - `createRoom(...)` now returns `stains` and `storyTriggers` in addition to existing world data.
- Added Happy Points gameplay loop in `src/main.js`:
  - Nearest-stain interaction checks on `E`
  - Stain remove/collect flow and score increment
  - Double-collect prevention via `cleaned` state + id set
  - Data-driven spawn consumption from layout config only (no hardcoded stain placements in gameplay loop)
- Added Happy Points UI in `index.html`:
  - Counter value (`#happy-points-value`)
  - Remaining stains text (`#stains-remaining`)
- Added cutscene dialogue UI in `index.html`:
  - `#cutscene-overlay`, `#cutscene-dialogue-box`, speaker + text fields.

### 2026-03-04 Phase 4/5 Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅

### 2026-03-04 Stabilization Pass (post-playtest issues)
- Addressed reported issues: broken leg pose retargeting, hard-to-use camera, overly fast battery drain, hard-to-find outlets, cluttered/overlapping map feel, and rough cutscene flow.

#### Retarget + Animation Stability
- Updated `src/retarget.js` to use local-space bind correction per bone instead of world-parent reconstruction each frame.
  - This removes parent world-order instability that could cause spread/twist artifacts.
  - Bone pairs are now depth-sorted for deterministic updates.
- Changed default hips translation transfer to disabled in `src/retarget.js` and `src/player.js` to avoid exaggerated lower-body offsets.

#### Camera + Input Reliability
- Improved `src/controls.js`:
  - Added drag-look fallback when pointer lock is unavailable/rejected.
  - Added robust pointer-lock request guard.
  - Added drag state reset on disable/blur/mouseup.
  - Keeps existing pointer-lock flow, but no longer blocks camera control if pointer lock fails.

#### Battery + Outlet Usability
- Rebalanced power tuning in `src/main.js`:
  - Moving drain reduced to `1.6%/s` (from `4.4`)
  - Idle drain reduced to `0.28%/s` (from `1.2`)
  - Recharge increased to `36%/s` (from `24`)
  - Interact range increased to `3.4` (from `2.2`)
- Added low-battery guidance prompt to show nearest outlet distance.
- Expanded outlet network in `src/world/layoutConfig.js` with center/spawn-adjacent outlets.
- Enhanced outlet visibility in `src/room.js` and `src/main.js` (added glow ring meshes + stronger highlight glow behavior).

#### Map Cleanup
- Refined furniture placements in `src/world/layoutConfig.js` to reduce dense overlaps and repeated clutter patterns while preserving zone identity.

#### Cutscene Flow Polish
- Shortened and simplified timeline presets in `src/cutscenePresets.js` for clearer, less disruptive transitions.
- Added active cutscene skip with `Esc` in `src/main.js`.
- Added gameplay-start guard in `src/main.js` to safely skip/clear any active cutscene before reinitializing state.
- Improved camera re-sync target after cutscene exit for cleaner return to gameplay control.

### 2026-03-04 Stabilization Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (Vite auto-shifted to `5174` because `5173` was already occupied by a running local session)

### 2026-03-04 Animation Hotfix (leg/arm fly-up on walk)
- Root cause identified in `src/player.js` clip sanitation/validation:
  - Three.js sanitizes animation track node names (`mixamorig:Hips` -> `mixamorigHips`).
  - Validation/filtering was comparing these sanitized names against unsanitized skeleton names, dropping/rejecting most animation tracks.
- Fix implemented:
  - Added normalized bone-name comparison using `THREE.PropertyBinding.sanitizeNodeName`.
  - Applied normalization in `collectBoneNames`, `sanitizeClip`, and `validateClip`.
  - Kept existing retarget runtime and state logic, but now clips retain proper walk limb rotation tracks.

### 2026-03-04 Animation Hotfix Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Retarget Orientation Hotfix (walk pose correction)
- Addressed remaining “arms/legs fly upward” issue after track-name normalization.
- Root cause:
  - Retarget quaternion transfer order was incorrect for bind-space conversion.
  - Bone lookup also depended on exact punctuation in names (`:`), which is not stable across sanitized/loaded node names.
- Fixes in `src/retarget.js`:
  - Switched to normalized bone key mapping via `THREE.PropertyBinding.sanitizeNodeName`.
  - Corrected local rotation transfer formula to:
    - `targetLocal = targetBindLocal * (sourceBindLocal^-1 * sourceLocalAnimated)`
  - Updated hips/head lookup paths to use normalized keys.

### 2026-03-04 Retarget Orientation Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Animation Bind Rebase Fix (walk limbs flying up)
- Root cause identified in `src/player.js` clip pipeline:
  - Animation GLBs (`idle/walk/run/fall/jump`) do not share identical bind/rest transforms.
  - Runtime used `idle.glb` skeleton as canonical source for all clips without rebasing, so some clips were applied in the wrong local basis (legs/arms lifting upward).
- Fix implemented:
  - Added per-clip bind data extraction (`collectBoneDataMap`).
  - Updated `sanitizeClip(...)` to rebase every quaternion keyframe from clip-bind space into canonical-bind space before playback:
    - `q_rebased = q_canonicalBind * inverse(q_clipBind) * q_clipFrame`
  - Added hips position rebase for retained hips translation track:
    - `p_rebased = p_canonicalBind + (p_clipFrame - p_clipBind)`
  - Track names are rewritten to canonical source bone names to keep mixer binding deterministic.
- Result:
  - Retarget runtime remains intact, but now receives clips in a consistent canonical pose basis.

### 2026-03-04 Animation Bind Rebase Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Animation Orientation Pass 2 (first-key reference)
- Additional fix in `src/player.js` to address remaining arm/leg orientation mismatch:
  - Non-idle clips now use each track's first keyed transform as clip reference basis during sanitation/rebase.
  - This avoids relying on GLB node rest transforms that are inconsistent across exported movement clips.
  - Quaternion and hips-position rebasing now anchor to:
    - first keyframe for non-idle clips (`walk/run/jump/fall`)
    - node bind for `idle`
- Intended effect:
  - Remove constant limb orientation offsets (arms/legs rotated in wrong basis) while preserving relative motion.

### 2026-03-04 Animation Orientation Pass 2 Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Phettagotchi Controller Port (orientation + input inversion)
- Ported the movement basis approach from `pet` 3D PvP controller (`src/components/pvp3d/lobby/LocalPlayer.tsx`) into TVMan controls:
  - `src/controls.js` now computes movement from camera world direction + right vector via cross product.
  - Fixed left/right inversion by correcting strafe basis generation.
- Replaced runtime per-frame retarget-copy in `src/player.js` with direct target-skeleton clip playback:
  - Removed dependency on runtime retarget transfer for local gameplay clips.
  - `AnimationMixer` now drives TV-Man model bones directly using sanitized GLB tracks.
  - Clip sanitation now maps track names to target bone names, strips scale tracks, keeps hips translation only, and normalizes keyframe start times.
- Goal of this pass:
  - Eliminate persistent arm/leg orientation drift from retarget-space mismatches.
  - Use the same GLB clip set in a simpler path aligned with the working Phettagotchi setup.

### 2026-03-04 Phettagotchi Port Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Room Layout Overlap Fix (collision-aware placement)
- Added explicit furniture layout tuning config to `src/world/layoutConfig.js`:
  - `furnitureLayout.clearance`
  - `furnitureLayout.wallMargin`
  - `furnitureLayout.candidateStep`
  - `furnitureLayout.candidateRings`
  - `furnitureLayout.verticalOverlapThreshold`
- Updated `src/room.js` furniture build pipeline:
  - Added placement solver that evaluates overlaps against already-placed furniture.
  - Uses candidate-ring search around authored position to find non-overlapping placement.
  - Applies room boundary penalty so meshes stay inside wall bounds.
  - Ignores false-positive overlap when objects are vertically separated (e.g. ceiling fixtures vs floor furniture).
  - Logs auto-adjust summary when items are moved by solver.
- Result:
  - Dense/overlapping furniture authored in config is auto-corrected at room build time instead of rendering stacked.

### 2026-03-04 Room Layout Overlap Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Player Visibility + Jump Height Fix
- Addressed reported invisible avatar issue in `src/player.js`:
  - Direct-play clip sanitation now keeps rotation tracks only.
  - Removed translation-track playback for gameplay clips to prevent rig displacement away from the physics body.
- Reduced jump height tuning in `src/controls.js`:
  - `jumpImpulse` lowered from `2.1` to `1.4`.

### 2026-03-04 Visibility/Jump Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 Avatar Swap to SlotMachineJones VRM + PvP Retarget Path
- Switched gameplay avatar from GLB character to VRM:
  - Added `slotmachinehjones.vrm` to `/public/models/slotmachinehjones.vrm`.
  - `src/player.js` now loads `slotmachinehjones.vrm` via `VRMLoaderPlugin`.
- Added VRM runtime dependency:
  - `@pixiv/three-vrm` in `package.json` / lockfile.
- Replaced direct GLB-on-skeleton playback with PvP-style VRM retargeting in `src/player.js`:
  - GLB clips (`idle/walk/run/jump/fall`) are retargeted to VRM normalized humanoid bones.
  - Uses parent-rest/world correction + rig-rest inverse quaternion path matching the 3D PvP lobby logic.
  - Keeps only hips translation vector track from source clips, avoiding full-rig displacement.
- Kept existing controller/physics/camera flow intact so this remains compatible with current game loop.

### 2026-03-04 VRM Swap Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` because `5173` already in use)

### 2026-03-04 SlotMachineJones Orientation + Layout Cleanup Pass
- Fixed avatar facing/limb orientation alignment in `src/player.js`:
  - Matched 3D PvP lobby orientation flow by applying group yaw offset (`+PI`) in addition to model yaw (`+PI`).
  - Rotation smoothing now targets `targetRotationY + visualYawOffset` to keep walk direction and visual facing consistent.
- Improved VRM retarget source-node resolution in `src/player.js`:
  - Prefer exact named source bones, with normalized fallback lookup.
  - Prioritize bone nodes on normalized-name collisions.
  - Ignore non-useful track properties (`scale`) and keep only quaternion + hips position transfer.
  - Added finger-bone mappings so arm/hand chains are less likely to freeze in partial T-pose.
- Reduced jump height further in `src/controls.js`:
  - `jumpImpulse` lowered from `1.4` to `1.05`.
- Hardened room placement against overlap in `src/room.js` + `src/world/layoutConfig.js`:
  - Increased candidate search radius and spacing for auto placement.
  - Added hard rejection thresholds (`maxAcceptedOverlapArea`, `maxAcceptedBoundaryPenalty`) so unresolved overlapping items are skipped instead of spawned.

### 2026-03-04 Orientation/Layout Pass Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (Vite auto-shifted port when `5173` was already in use)

### 2026-03-04 Chibi-Style Controller Pass (walk/run + movement feel)
- Implemented a Chibi-Robo-inspired movement profile with explicit walk/run states:
  - `src/controls.js`
    - Added run input on `Shift` (`ShiftLeft` / `ShiftRight`).
    - Added tunable walk/run speeds (`walkSpeed`, `runSpeed`) and `getMoveSpeed()`.
    - Added `isRunning` getter for gameplay/animation state logic.
  - `src/player.js`
    - Added `PlayerState.RUNNING` mapped to `run` clip.
    - Replaced hard velocity snapping with damped acceleration/deceleration in `applyMovement(...)`.
    - Added stronger turn response while running for tighter handling.
  - `src/main.js`
    - Movement loop now uses `controls.getMoveSpeed()` and passes `delta` + grounded hint into `player.applyMovement(...)`.
    - Grounded animation selection now uses `RUNNING` when sprinting and `WALKING` otherwise.
- Updated HUD/control hints for new controller:
  - `index.html` settings and gameplay prompt now list `Shift` for running.
  - `src/gameState.js` intro control text now includes run input.
- Power model updated for movement tiers:
  - Added sprint drain tier (`drainRunningPerSec`) and status text.

### 2026-03-04 Chibi Controller Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (auto-shifted to `5174` when `5173` was already occupied)

### 2026-03-04 Chibi Feel Pass 2 (camera + locomotion parity push)
- Added deeper Chibi-style locomotion behavior:
  - `src/controls.js`
    - Retuned camera baseline (`distance`, `phi`, smoothing) for tighter toy-scale framing.
    - Added auto camera recenter behind movement when mouse look is idle.
    - Added camera collision using raycasts against room occluder meshes to reduce wall/furniture clipping.
    - Added movement-axis tracking and intent model:
      - `isRunning` requires forward-biased sprint intent.
      - `isBackpedalIntent` detects backward locomotion intent.
      - `getMoveSpeed()` applies speed shaping for run/walk/strafe/backpedal.
  - `src/player.js`
    - Added backpedal state logic with thresholds similar to arena controller patterns.
    - Backpedal preserves facing direction and uses reduced speed multiplier.
    - Kept acceleration/deceleration damping and integrated backpedal into movement solve.
  - `src/main.js`
    - Wired camera collision occluders from room meshes (`buildCameraOccluders`).
    - Passed backpedal intent into movement solve.
    - Switched grounded animation selection to use real planar velocity and intent:
      - idle vs walk vs run now resolved by speed + sprint + backpedal state.
    - Camera follow now uses active movement direction (or velocity fallback) for smoother behind-player behavior.

### 2026-03-04 Chibi Feel Pass 2 Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (served at `http://127.0.0.1:5173/` in this run)

### 2026-03-04 Chibi Core Systems Expansion (Climb + Day Cycle + Tools)
- Added climbable traversal primitives and runtime climbing state:
  - `src/world/layoutConfig.js`
    - New data-driven `climbables` definitions (cord/ladder style anchors).
  - `src/room.js`
    - New `buildClimbables(...)` builder with tagged climb meshes and matching static colliders.
    - `createRoom(...)` now returns `climbables`.
  - `src/main.js`
    - Added climb detection (proximity + forward raycast to tagged climb meshes).
    - `E` now enters climbing when in range; while climbing gravity is disabled and player is snapped to climb surface normal.
    - `W/S` controls vertical climb motion; top-of-climb exits back to gameplay.
    - Climb state integrates with movement lock/jump rules and interact prompts.

- Added Time-of-Day cycle with forced day-end transition:
  - `src/main.js`
    - Added cycle timer (`5 min real-time = 12 in-game hours`) with UI updates.
    - Added day-end transition state that:
      - disables input,
      - fades to black,
      - shows cycle tally popup (Happy Points earned + running total),
      - resets player to base spawn and restores gameplay.
  - `index.html`
    - Added time HUD (`clock`, `cycle`, `remaining`), fade overlay, and cycle summary popup.

- Added tool inventory + equipped interaction model:
  - `src/controls.js`
    - Added primary action click intent queue and climb-axis input helper.
  - `index.html`
    - Added Tab-open tool inventory overlay UI and equipped tool HUD.
  - `src/main.js`
    - Added unlockable tool registry + equip state.
    - `Tab` toggles tool menu and selection; equipped tool displayed on HUD.
    - Added center-screen interaction raycaster that checks target set by equipped tool:
      - `Toothbrush` -> `stain` meshes
      - `Syringe` -> `water` meshes
    - Added click-based tool interactions and rewards.

- Added water interactables for syringe tool:
  - `src/world/layoutConfig.js`
    - New data-driven `waters` placements.
  - `src/room.js`
    - New `buildWaters(...)`; `createRoom(...)` now returns `waters`.
  - `src/main.js`
    - Added water cleanup collection logic and visuals.

- Controller/camera integration updates:
  - `src/main.js`
    - Camera occluder extraction now excludes water decals.
    - State gating now accounts for cutscene/day-transition/tool-menu/climbing modes.
    - Prompt logic updated for climbing and tool-based click interactions.

### 2026-03-04 Core Systems Expansion Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅ (served at `http://127.0.0.1:5173/` in this run)

### 2026-03-04 Chibi-Vision + NPC Dialogue + Shop + Pushables
- Implemented toggleable first-person "Chibi-Vision" camera mode (`Z`):
  - New module: `src/firstPersonCamera.js`.
  - Snaps camera to player head/eyes via `player.getHeadWorldPosition(...)`.
  - Hides player mesh while active, restores mesh on exit.
  - Disables movement/jump while active (look-only mouse pan).
  - Smoothly interpolates camera back to third-person follow pose on exit.
- Extended player API in `src/player.js`:
  - Added `getHeadWorldPosition(out)` for first-person head anchoring.
  - Added `setVisualVisible(visible)` for mesh visibility toggles.

- Implemented modular NPC state machine + dialogue tree system:
  - New module: `src/npcSystem.js`.
  - States: `Idle`, `Walking`, `Talking`.
  - JSON dialogue tree with branching choices and optional currency rewards.
  - Character-by-character (typewriter) dialogue rendering.
  - Player can interact near NPC with `E`; player faces NPC on talk start; movement/input locks during dialogue.

- Implemented shop interface with currency + inventory transactions:
  - New module: `src/shopSystem.js`.
  - Computer-style shop overlay UI with item list, costs, and purchase status.
  - Global economy state exposed as `window.Currency` and `window.Inventory`.
  - Purchases subtract currency and add item IDs to inventory.
  - Added purchasables including `Battery Upgrade 1` (+20 max battery when bought).

- Implemented pushable physics blocks (Rapier):
  - Added dynamic pushable block factory in `src/physics.js`: `createPushableBlockBody(...)`.
  - Added pushable meshes/data to world config and room build.
  - Added heavy push behavior in `src/main.js`:
    - High-friction, high-damping bodies.
    - Side-contact movement impulse from player movement direction.
    - Horizontal speed clamp to keep blocks heavy/slow.

- Expanded data-driven room config + scene builders:
  - `src/world/layoutConfig.js` now includes `npcs`, `shopTerminals`, and `pushables` data.
  - `src/room.js` now builds/returns:
    - NPC meshes + metadata
    - Shop terminal interactables (+ static colliders)
    - Pushable meshes + metadata
  - `createRoom(...)` return payload extended with `npcs`, `shopTerminals`, `pushables`.

- Integrated systems into `src/main.js`:
  - Added state gating so cutscene/day-transition/tool-menu/first-person/NPC/shop states do not conflict.
  - Added terminal proximity + `E` to open shop; `P` hotkey for shop toggle.
  - Added `E` conversation advancement and Esc close/cancel behavior.
  - Added shop terminal visual highlight updates.
  - Added economy HUD updates and prompt priority updates.

- Updated `index.html`:
  - Added NPC dialogue overlay UI (speaker/text/choices/hint).
  - Added shop overlay UI (currency/inventory/item list/hint).
  - Added HUD economy counters (Bits + inventory count).
  - Added first-person indicator and settings text for `Z` and shop controls.
  - Fixed non-screen overlay hide behavior by adding `.hidden` handling for day fade/summary/fpv indicator.

### 2026-03-04 Verification (post-integration)
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅
- Playwright web-game client run ✅
  - Screenshot artifact: `output/web-game-phase-next/shot-0.png`

### Notes / Follow-up
- The Playwright client currently maps only a limited key set, so automated verification mainly captured title/menu flow in this pass.
- Manual gameplay pass is recommended next for tuning:
  - first-person look sensitivity,
  - NPC interaction radii,
  - pushable impulse strength/damping,
  - shop economy pacing relative to Happy Point gain.

### 2026-03-04 Chibi-Copter + Footsteps + Carry/Throw + Room Streaming
- Added glide/hover mechanic (Chibi-Copter feel) to gameplay loop in `src/main.js`:
  - New tuning: `GLIDE_TUNING` (`maxFallSpeed`, `horizontalControlBoost`, `speedMultiplier`, `drainPerSec`).
  - While airborne and holding Space, player enters glide state.
  - Downward fall speed is clamped for float descent.
  - Horizontal air control is increased while gliding.
  - Battery drains continuously while gliding.
  - Added animation state support: `PlayerState.GLIDING` in `src/player.js` (fallbacks to fall clip pipeline).

- Added dynamic musical footsteps system:
  - New module: `src/footstepAudio.js`.
  - Triggers step notes on walk/run animation cycle thresholds (normalized clip timing).
  - Uses Web Audio API procedural synth notes (surface-dependent pitch banks).
  - Surface detection via downward raycast and `mesh.userData.surface`.
  - Added surface tagging in `src/room.js` for shell + furniture/pushable/grabbable meshes.

- Added carrying and throwing system:
  - New grabbable data in world config (`grabbables`).
  - New room builder output in `src/room.js`: grabbable meshes + metadata.
  - New physics helper in `src/physics.js`: `createGrabbableBody(...)` and removal helper.
  - In `src/main.js`:
    - `E` near grabbable picks up and reparents object to player carry anchor bone (`Head` fallback in `src/player.js`).
    - Carrying reduces movement speed (`CARRY_TUNING.speedMultiplier`).
    - Pressing `E` again detaches and throws with forward impulse via Rapier rigid body.

- Added room transition / level streaming system:
  - Added second layout + room map in `src/world/layoutConfig.js`:
    - `WORLD_LAYOUT_UPPER`
    - `WORLD_LAYOUTS` (`mainFloor`, `upperFloor`)
  - Added `roomTransitions` trigger config and parser in `src/room.js`.
  - Refactored room load flow in `src/main.js`:
    - `loadRoomLayout(roomKey)` now unloads current room group, disposes geometries/material textures, removes old static colliders, loads next room, and rebuilds collider bodies.
    - Trigger-zone enter initiates fade-to-black transition, loads target room, teleports player to configured spawn, and restores control.
  - Added collider lifecycle management in `src/physics.js`:
    - `createRoomColliders(...)` now returns created bodies.
    - `removeRoomColliders(...)` removes previous room static bodies.

- Added dynamic actor rebuild lifecycle for streamed rooms:
  - Pushables and grabbables are destroyed/recreated on room load.
  - NPC system now supports room-dependent NPC replacement via `setNpcs(...)`.

- Updated UI/control copy in `index.html` + `src/gameState.js`:
  - Added glide mention (hold Space in air) and carry interaction wording.

### 2026-03-04 Verification (post-feature implementation)
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5173` ✅
- Playwright web-game client run ✅
  - Screenshot artifact: `output/web-game-phase-glide/shot-0.png`

### Notes
- Automated Playwright action payloads still mostly exercise menu/title flow; manual in-game tuning pass is still recommended for:
  - glide feel and battery drain rates,
  - carry throw impulse/mass,
  - room transition trigger sizing,
  - footstep pitch/volume balance by surface.
- Post-transition battery freeze tweak applied and re-verified:
  - `npm run build` ✅
  - `npm run dev -- --host 127.0.0.1 --port 5173` ✅

### 2026-03-04 Popup Stuck Fix
- Fixed stuck `Cycle Complete` popup bleeding into menu/title.
- `src/gameState.js`:
  - `setPhase(...)` now force-hides transient non-`.screen` gameplay overlays (`day-fade-overlay`, `day-summary-popup`, `tool-inventory`, `npc-dialogue-overlay`, `shop-overlay`) and resets opacity/visibility.
- `src/main.js`:
  - In non-gameplay branch, force-hide day fade/summary and reset `dayTransitionActive`.
- Verification:
  - `npm run build` ✅
  - `npm run dev -- --host 127.0.0.1 --port 5173` ✅
- Fixed `New Game` click blocked by hidden overlays:
  - Root cause: `#shop-overlay` had `pointer-events: auto;` with higher specificity than `.screen.hidden`, so hidden shop UI intercepted clicks.
  - Fix in `index.html`: `.screen.hidden { pointer-events: none !important; }`
  - Re-verified with Playwright that clicking `New Game` transitions to gameplay HUD.

### 2026-03-05 Map Polish Pass (Realism + Layout Cleanup)
- Tightened furniture placement acceptance in `src/world/layoutConfig.js`:
  - `clearance`, `wallMargin`, candidate search radius, and strict overlap/boundary thresholds were increased/reduced to reject cramped placements.
- Added a new data-driven decor layer in `src/world/layoutConfig.js` (`decor`):
  - Zone rugs, wall panels, clutter presets, and clutter spawn zones.
  - Deterministic seed-based placement tuning per room.
  - Added dedicated decor overrides for `WORLD_LAYOUT_UPPER` with smaller upstairs bounds and lower prop counts.
- Refined furniture staging to reduce repeated/clustered center-room congestion:
  - Reworked lounge layouts (main + upper) to remove the densest center-piece stack and spread seating/focal props more logically.
  - Reduced clutter spawn counts across all zones to keep paths readable.

- Implemented decor generation pipeline in `src/room.js`:
  - New `buildDecor(...)` pass runs after furniture + parkour placement.
  - Added overlap-safe clutter spawning using 2D occupancy from furniture and parkour collider footprints.
  - Added deterministic seeded random placement utilities and weighted module selection.
  - Added shape support for decor modules (`box`, `cylinder`, `sphere`, `torus`) with cached geometry/material reuse.
  - Exposed `window.__decorItems` and returned `decorItems` from `createRoom(...)`.
  - Build logs now include decor prop counts.

### 2026-03-05 Verification
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5181` ✅
- `npm run dev -- --host 127.0.0.1 --port 5185` ✅
- Additional visual automation captures (Playwright web-game client):
  - `output/web-game-map-polish4/shot-1.png`
  - `output/web-game-map-polish5/shot-0.png`

### Notes
- Automation still has partial title/menu click flakiness in this project flow, so captures are useful for regression snapshots but not fully reliable for reaching active gameplay every run.

### 2026-03-05 Map Polish Pass 3 (Anchors + Phase-Based Parkour Visibility)
- Implemented strict anchor-slot furniture placement with zero auto-drift for major pieces:
  - Added `furnitureAnchors` data to both `WORLD_LAYOUT_V2` and `WORLD_LAYOUT_UPPER` in `src/world/layoutConfig.js`.
  - Tagged major furniture entries with `anchor` ids (sleep/study/lounge/kitchen/junk zones).
  - Refined lounge anchor positions to break up the oversized center cluster and push large seating to cleaner side anchors.
- Extended room builder (`src/room.js`) for anchor-aware furniture resolution:
  - Added `resolveFurnitureEntry(...)` to map `anchor` ids to explicit slot transforms.
  - Added `evaluateLockedFurniturePlacement(...)` for locked anchor objects (metrics computed, no relocation).
  - Preserved overlap/boundary gating while keeping anchored pieces deterministic.
  - `createRoom(...)` now exports and stores `parkourGroup` for runtime phase toggling.
- Added phase-driven parkour visibility in `src/main.js`:
  - Tracked `parkourGroup` from room load.
  - Added `syncParkourVisibility()` and phase cache (`lastParkourPhase`).
  - Parkour visuals now hide during non-gameplay phases and reappear automatically during gameplay.

### 2026-03-05 Verification (Pass 3)
- `npm run build` ✅
- `npm run dev -- --host 127.0.0.1 --port 5190` ✅
- Playwright snapshot run (menu/title visual sanity):
  - `output/web-game-map-pass3/shot-0.png`

### 2026-03-05 Lounge Anchor Tuning (Edge Push)
- Per request, pushed oversized lounge anchors farther toward room edges:
  - Main floor: moved `lounge_left` / `lounge_right` outward and nudged `lounge_table` forward.
  - Upper floor: moved `upper_lounge_sofa` farther left/back edge and adjusted `upper_lounge_table` center offset.
- File updated: `src/world/layoutConfig.js`.
- Verification: `npm run build` ✅
