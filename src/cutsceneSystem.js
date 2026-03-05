import * as THREE from 'three';
import { gsap } from 'gsap';

export class CutsceneSystem {
  constructor({
    camera,
    dialogueRoot = null,
    dialogueText = null,
    dialogueSpeaker = null,
    onLockChange = null,
    onCutsceneStart = null,
    onCutsceneEnd = null,
  }) {
    this.camera = camera;
    this.dialogueRoot = dialogueRoot;
    this.dialogueText = dialogueText;
    this.dialogueSpeaker = dialogueSpeaker;

    this.onLockChange = onLockChange;
    this.onCutsceneStart = onCutsceneStart;
    this.onCutsceneEnd = onCutsceneEnd;

    this.presets = new Map();
    this.played = new Set();
    this.activeTimeline = null;
    this.activeId = null;
    this._activeResolve = null;
  }

  registerPreset(id, preset) {
    if (!id || !preset) return;
    this.presets.set(id, { ...preset, id });
  }

  registerPresets(presets) {
    if (!presets) return;

    if (Array.isArray(presets)) {
      for (const preset of presets) {
        if (!preset?.id) continue;
        this.registerPreset(preset.id, preset);
      }
      return;
    }

    for (const [id, preset] of Object.entries(presets)) {
      this.registerPreset(id, preset);
    }
  }

  hasPlayed(id) {
    return this.played.has(id);
  }

  get isActive() {
    return this.activeTimeline !== null;
  }

  play(id, context = {}) {
    if (this.activeTimeline) return Promise.resolve(false);

    const preset = this.presets.get(id);
    if (!preset || !Array.isArray(preset.steps) || preset.steps.length === 0) {
      console.warn(`Cutscene "${id}" is missing or has no steps`);
      return Promise.resolve(false);
    }

    if (preset.once && this.played.has(id) && !context.force) {
      return Promise.resolve(false);
    }

    const lookProxy = this._computeInitialLookProxy();
    const applyLook = () => {
      this.camera.lookAt(lookProxy.x, lookProxy.y, lookProxy.z);
    };

    let cursor = 0;

    const timeline = gsap.timeline({ paused: true });
    this.activeTimeline = timeline;
    this.activeId = id;

    timeline.eventCallback('onStart', () => {
      this._setDialogueVisible(true);
      this._setDialogue('', '');

      if (this.onLockChange) this.onLockChange(true, id, preset, context);
      if (this.onCutsceneStart) this.onCutsceneStart(id, preset, context);
    });

    for (const step of preset.steps) {
      const duration = Math.max(step.duration ?? 1.5, 0.05);
      const startAt = step.at ?? cursor;
      const ease = step.ease || preset.ease || 'power2.inOut';
      const camPos = toVec3(step.camPos);
      const lookAt = toVec3(step.lookAt);

      timeline.to(
        this.camera.position,
        {
          x: camPos.x,
          y: camPos.y,
          z: camPos.z,
          duration,
          ease,
        },
        startAt
      );

      timeline.to(
        lookProxy,
        {
          x: lookAt.x,
          y: lookAt.y,
          z: lookAt.z,
          duration,
          ease,
          onUpdate: applyLook,
        },
        startAt
      );

      if (step.dialogue || step.speaker) {
        timeline.add(() => {
          this._setDialogue(step.dialogue || '', step.speaker || preset.defaultSpeaker || '');
        }, startAt + (step.dialogueAt ?? 0));
      }

      cursor = Math.max(cursor, startAt + duration + (step.hold ?? 0));
    }

    timeline.eventCallback('onComplete', () => {
      if (preset.once) {
        this.played.add(id);
      }

      this._setDialogue('', '');
      this._setDialogueVisible(false);

      this.activeTimeline = null;
      this.activeId = null;

      if (this.onLockChange) this.onLockChange(false, id, preset, context);
      if (this.onCutsceneEnd) this.onCutsceneEnd(id, preset, context);

      if (this._activeResolve) {
        this._activeResolve(true);
        this._activeResolve = null;
      }
    });

    timeline.eventCallback('onInterrupt', () => {
      this._setDialogue('', '');
      this._setDialogueVisible(false);

      this.activeTimeline = null;
      this.activeId = null;

      if (this.onLockChange) this.onLockChange(false, id, preset, context);
      if (this.onCutsceneEnd) this.onCutsceneEnd(id, preset, context);

      if (this._activeResolve) {
        this._activeResolve(false);
        this._activeResolve = null;
      }
    });

    applyLook();

    return new Promise((resolve) => {
      this._activeResolve = resolve;
      timeline.play(0);
    });
  }

  skipActive() {
    if (!this.activeTimeline) return;
    this.activeTimeline.progress(1);
  }

  _setDialogueVisible(visible) {
    if (!this.dialogueRoot) return;
    this.dialogueRoot.classList.toggle('hidden', !visible);
  }

  _setDialogue(text, speaker) {
    if (this.dialogueText) {
      this.dialogueText.textContent = text;
    }

    if (this.dialogueSpeaker) {
      this.dialogueSpeaker.textContent = speaker || '';
      this.dialogueSpeaker.style.opacity = speaker ? '1' : '0';
    }
  }

  _computeInitialLookProxy() {
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);
    const lookPos = this.camera.position.clone().add(lookDir.multiplyScalar(5));

    return { x: lookPos.x, y: lookPos.y, z: lookPos.z };
  }
}

function toVec3(source) {
  if (source instanceof THREE.Vector3) return source;
  if (Array.isArray(source)) {
    return new THREE.Vector3(source[0] ?? 0, source[1] ?? 0, source[2] ?? 0);
  }
  if (source && typeof source === 'object') {
    return new THREE.Vector3(source.x ?? 0, source.y ?? 0, source.z ?? 0);
  }
  return new THREE.Vector3();
}
