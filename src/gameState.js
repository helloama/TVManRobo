import * as THREE from 'three';

export const GamePhase = {
  LOADING: 'loading',
  TITLE: 'title',
  MENU: 'menu',
  SETTINGS: 'settings',
  INTRO: 'intro',
  GAMEPLAY: 'gameplay',
};

const SAVE_KEY = 'tvrobophetta_save';

// Camera flythrough keyframes for the intro sequence
const INTRO_STEPS = [
  {
    camPos: new THREE.Vector3(10, 11, 8),
    lookAt: new THREE.Vector3(0, 2, 0),
    duration: 4,
    text: "Welcome to Phetta's House...",
  },
  {
    camPos: new THREE.Vector3(-8, 4, 3),
    lookAt: new THREE.Vector3(0, 2, -2),
    duration: 3.5,
    text: "A cozy home where even the smallest robot\ncan make a big difference.",
  },
  {
    camPos: new THREE.Vector3(2, 2.5, 6),
    lookAt: new THREE.Vector3(0, 0.8, 3),
    duration: 3,
    text: "Meet TV Man \u2014 the newest helper robot.",
    showPlayer: true,
  },
  {
    camPos: new THREE.Vector3(0, 2.5, 7),
    lookAt: new THREE.Vector3(0, 0.8, 3),
    duration: 3.5,
    text: "His mission: bring happiness to everyone in the house!",
  },
  {
    camPos: new THREE.Vector3(0, 3, 8),
    lookAt: new THREE.Vector3(0, 1, 3),
    duration: 3,
    text: "WASD move  \u00b7  Shift run  \u00b7  Space jump/glide  \u00b7  E interact/carry  \u00b7  Tab tools",
  },
];

export class GameStateManager {
  constructor(camera) {
    this.camera = camera;
    this.phase = GamePhase.LOADING;

    // Title orbit
    this.titleAngle = 0;

    // Intro state
    this.introStep = 0;
    this.introElapsed = 0;
    this.introFromPos = new THREE.Vector3();
    this.introFromLook = new THREE.Vector3();
    this.introCurrentLook = new THREE.Vector3(0, 5, 0);
    this.playerRevealed = false;

    // Callbacks — set by main.js
    this.onRevealPlayer = null;
    this.onGameplayStart = null;

    // Internal handlers
    this._titleHandler = null;

    this._initMenuClicks();
    this._initKeyHandler();
  }

  // ── Phase transitions ──────────────────────────────────────────

  setPhase(phase) {
    this.phase = phase;

    // Hide every screen overlay
    for (const el of document.querySelectorAll('.screen')) {
      el.classList.add('hidden');
    }

    // Safety reset for transient gameplay overlays that are not `.screen`.
    const transientOverlayIds = [
      'day-fade-overlay',
      'day-summary-popup',
      'tool-inventory',
      'npc-dialogue-overlay',
      'shop-overlay',
    ];
    for (const id of transientOverlayIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.add('hidden');
      // Explicit style reset avoids partially-visible GSAP states.
      el.style.opacity = '';
      el.style.visibility = '';
    }

    switch (phase) {
      case GamePhase.TITLE:
        this._show('title-screen');
        this._listenTitle();
        break;

      case GamePhase.MENU:
        this._removeTitle();
        this._show('menu-screen');
        this._updateContinue();
        break;

      case GamePhase.SETTINGS:
        this._show('settings-screen');
        break;

      case GamePhase.INTRO:
        this._show('intro-overlay');
        this._beginIntro();
        break;

      case GamePhase.GAMEPLAY:
        this._show('gameplay-hud');
        if (!this.playerRevealed) {
          this.playerRevealed = true;
          if (this.onRevealPlayer) this.onRevealPlayer();
        }
        if (this.onGameplayStart) this.onGameplayStart();
        break;
    }
  }

  // ── Per-frame update (called from game loop) ───────────────────

  update(delta) {
    switch (this.phase) {
      case GamePhase.TITLE:
      case GamePhase.MENU:
      case GamePhase.SETTINGS:
        this._orbitCamera(delta);
        break;
      case GamePhase.INTRO:
        this._tickIntro(delta);
        break;
    }
  }

  // ── Title camera orbit ─────────────────────────────────────────

  _orbitCamera(delta) {
    this.titleAngle += delta * 0.1;
    const r = 16, h = 10;
    this.camera.position.set(
      Math.sin(this.titleAngle) * r,
      h,
      Math.cos(this.titleAngle) * r
    );
    this.camera.lookAt(0, 2, 0);
  }

  // ── Title "Press Any Key" listener ─────────────────────────────

  _listenTitle() {
    this._removeTitle();

    this._titleHandler = () => {
      if (this.phase === GamePhase.TITLE) this.setPhase(GamePhase.MENU);
    };
    // Small delay prevents the same click that showed the title from advancing
    setTimeout(() => {
      window.addEventListener('keydown', this._titleHandler);
      window.addEventListener('click', this._titleHandler);
    }, 800);
  }

  _removeTitle() {
    if (this._titleHandler) {
      window.removeEventListener('keydown', this._titleHandler);
      window.removeEventListener('click', this._titleHandler);
      this._titleHandler = null;
    }
  }

  // ── Menu click handling ────────────────────────────────────────

  _initMenuClicks() {
    document.addEventListener('click', (e) => {
      // Click anywhere during intro → skip
      if (this.phase === GamePhase.INTRO) {
        this._skipIntro();
        return;
      }

      const item = e.target.closest('[data-action]');
      if (!item || item.classList.contains('disabled')) return;

      switch (item.dataset.action) {
        case 'new-game':
          this.setPhase(GamePhase.GAMEPLAY);
          break;
        case 'continue':
          if (this.hasSaveData()) {
            this.playerRevealed = true;
            if (this.onRevealPlayer) this.onRevealPlayer();
            this.setPhase(GamePhase.GAMEPLAY);
          }
          break;
        case 'settings':
          this.setPhase(GamePhase.SETTINGS);
          break;
        case 'back':
          this.setPhase(GamePhase.MENU);
          break;
      }
    });
  }

  _initKeyHandler() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.phase === GamePhase.INTRO) this._skipIntro();
        else if (this.phase === GamePhase.SETTINGS) this.setPhase(GamePhase.MENU);
      }
    });
  }

  _updateContinue() {
    const btn = document.getElementById('btn-continue');
    if (btn) btn.classList.toggle('disabled', !this.hasSaveData());
  }

  // ── Intro camera sequence ──────────────────────────────────────

  _beginIntro() {
    this.introStep = 0;
    this.introElapsed = 0;
    this.playerRevealed = false;

    this.introFromPos.copy(this.camera.position);
    this.introFromLook.set(0, 2, 0);
    this.introCurrentLook.set(0, 2, 0);

    this._showIntroText();
  }

  _tickIntro(delta) {
    if (this.introStep >= INTRO_STEPS.length) {
      this.setPhase(GamePhase.GAMEPLAY);
      return;
    }

    const step = INTRO_STEPS[this.introStep];
    this.introElapsed += delta;

    const t = Math.min(this.introElapsed / step.duration, 1);
    // Smooth ease-in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Lerp camera position & look target
    this.camera.position.lerpVectors(this.introFromPos, step.camPos, ease);
    this.introCurrentLook.lerpVectors(this.introFromLook, step.lookAt, ease);
    this.camera.lookAt(this.introCurrentLook);

    // Reveal player at the right moment
    if (step.showPlayer && !this.playerRevealed && t > 0.3) {
      this.playerRevealed = true;
      if (this.onRevealPlayer) this.onRevealPlayer();
    }

    // Advance to next keyframe
    if (t >= 1) {
      this.introFromPos.copy(step.camPos);
      this.introFromLook.copy(step.lookAt);
      this.introStep++;
      this.introElapsed = 0;
      this._showIntroText();
    }
  }

  _showIntroText() {
    const textEl = document.getElementById('intro-text');
    const boxEl = document.getElementById('intro-text-box');
    if (!textEl || !boxEl) return;

    if (this.introStep >= INTRO_STEPS.length) {
      boxEl.style.opacity = '0';
      return;
    }

    // Fade out → swap text → fade in
    boxEl.style.opacity = '0';
    setTimeout(() => {
      textEl.textContent = INTRO_STEPS[this.introStep].text;
      boxEl.style.opacity = '1';
    }, 300);
  }

  _skipIntro() {
    if (this.phase !== GamePhase.INTRO) return;
    this.setPhase(GamePhase.GAMEPLAY);
  }

  // ── Helpers ────────────────────────────────────────────────────

  _show(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  // ── Save / Load (localStorage) ─────────────────────────────────

  hasSaveData() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  saveGame(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      ...data,
      timestamp: Date.now(),
    }));
  }

  loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
