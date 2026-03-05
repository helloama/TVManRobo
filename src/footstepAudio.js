const WALK_THRESHOLDS = [0.16, 0.64];
const RUN_THRESHOLDS = [0.1, 0.54];

const SURFACE_INTERVALS = {
  wood: [0, 2, 4, 7, 9],
  carpet: [0, 3, 5, 7, 10],
  metal: [0, 2, 5, 9, 12],
  tile: [0, 4, 7, 11],
  wall: [0, 3, 7],
};

export class MusicalFootstepSystem {
  constructor({
    getSurfaceType = null,
    onStep = null,
  } = {}) {
    this.getSurfaceType = getSurfaceType;
    this.onStep = onStep;

    this.audioContext = null;
    this.masterGain = null;
    this.enabled = true;
    this.unlocked = false;

    this.lastAction = null;
    this.prevNormTime = 0;
    this.stepCounter = 0;

    this._unlock = this._unlock.bind(this);
    window.addEventListener('pointerdown', this._unlock, { passive: true });
    window.addEventListener('keydown', this._unlock, { passive: true });
  }

  dispose() {
    window.removeEventListener('pointerdown', this._unlock);
    window.removeEventListener('keydown', this._unlock);
  }

  _unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this._ensureAudioContext();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  _ensureAudioContext() {
    if (this.audioContext) return this.audioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    this.audioContext = new Ctx();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.32;
    this.masterGain.connect(this.audioContext.destination);
    return this.audioContext;
  }

  resetCycle() {
    this.lastAction = null;
    this.prevNormTime = 0;
  }

  update({
    playerState,
    action,
    grounded,
    moving,
    running,
  }) {
    if (!this.enabled || !grounded || !moving || !action) {
      this.resetCycle();
      return;
    }

    const isWalkLike = playerState === 'walk' || playerState === 'run';
    if (!isWalkLike) {
      this.resetCycle();
      return;
    }

    if (this.lastAction !== action) {
      this.lastAction = action;
      this.prevNormTime = 0;
      this.stepCounter = 0;
    }

    const duration = Math.max(0.001, action.getClip()?.duration || 1);
    const normTime = ((action.time % duration) + duration) % duration / duration;
    const thresholds = running ? RUN_THRESHOLDS : WALK_THRESHOLDS;

    for (const threshold of thresholds) {
      if (didCross(this.prevNormTime, normTime, threshold)) {
        this._triggerStep(running);
      }
    }

    this.prevNormTime = normTime;
  }

  _triggerStep(running) {
    const surface = this.getSurfaceType?.() || 'wood';
    const velocityFactor = running ? 1.0 : 0.78;
    this._playSurfaceNote(surface, velocityFactor);
    this.stepCounter += 1;

    if (this.onStep) {
      this.onStep({
        surface,
        running,
        stepCounter: this.stepCounter,
      });
    }
  }

  _playSurfaceNote(surfaceType, velocityFactor = 1) {
    if (!this.unlocked) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this.masterGain) return;

    const bank = SURFACE_INTERVALS[surfaceType] || SURFACE_INTERVALS.wood;
    const interval = bank[this.stepCounter % bank.length];
    const baseMidi = surfaceType === 'metal' ? 64 : surfaceType === 'carpet' ? 55 : 60;
    const midi = baseMidi + interval;
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2 * velocityFactor, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    gain.connect(this.masterGain);

    const osc = ctx.createOscillator();
    osc.type = surfaceType === 'metal' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.16);

    if (surfaceType === 'metal' || surfaceType === 'tile') {
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(frequency * 2.1, now);
      clickGain.gain.setValueAtTime(0.07 * velocityFactor, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      click.connect(clickGain);
      clickGain.connect(this.masterGain);
      click.start(now);
      click.stop(now + 0.06);
    }
  }
}

function didCross(prev, current, threshold) {
  if (current >= prev) {
    return prev < threshold && current >= threshold;
  }
  return prev < threshold || current >= threshold;
}
