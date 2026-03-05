import * as THREE from 'three';

export const NPCState = Object.freeze({
  IDLE: 'Idle',
  WALKING: 'Walking',
  TALKING: 'Talking',
});

export class NPCActor {
  constructor(def) {
    this.id = def.id;
    this.name = def.name || def.id || 'Toy';
    this.group = def.group;
    this.interactRadius = def.interactRadius ?? 2;
    this.walkSpeed = def.walkSpeed ?? 0.45;
    this.state = NPCState.IDLE;
    this.dialogue = def.dialogue || null;

    this._baseY = this.group?.position?.y ?? 0;
    this._elapsed = Math.random() * 10;
    this._patrolPoints = (def.patrol || [])
      .map((point) => new THREE.Vector3(point[0] ?? 0, this._baseY, point[2] ?? 0));
    this._patrolIndex = 0;
  }

  getWorldPosition(out = new THREE.Vector3()) {
    if (this.group) {
      this.group.getWorldPosition(out);
      return out;
    }
    return out.set(0, 0, 0);
  }

  setTalking(talking) {
    if (talking) {
      this.state = NPCState.TALKING;
      return;
    }
    this.state = this._patrolPoints.length >= 2 ? NPCState.WALKING : NPCState.IDLE;
  }

  update(delta) {
    if (!this.group) return;

    this._elapsed += delta;

    if (this.state !== NPCState.TALKING && this._patrolPoints.length >= 2) {
      const target = this._patrolPoints[this._patrolIndex];
      const pos = this.group.position;
      const toTarget = target.clone().sub(pos);
      const dist = Math.hypot(toTarget.x, toTarget.z);

      if (dist <= 0.08) {
        this._patrolIndex = (this._patrolIndex + 1) % this._patrolPoints.length;
      } else {
        this.state = NPCState.WALKING;
        toTarget.y = 0;
        toTarget.normalize();
        pos.addScaledVector(toTarget, this.walkSpeed * delta);
        this.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
      }
    } else if (this.state !== NPCState.TALKING) {
      this.state = NPCState.IDLE;
    }

    const bobAmp = this.state === NPCState.WALKING ? 0.04 : 0.02;
    this.group.position.y = this._baseY + (Math.sin(this._elapsed * 3.3) * bobAmp);
  }
}

export class NPCSystem {
  constructor({
    npcDefs = [],
    dialogueRoot = null,
    dialogueSpeaker = null,
    dialogueText = null,
    dialogueChoices = null,
    dialogueHint = null,
    onLockChange = null,
    onCurrencyAward = null,
  }) {
    this.npcs = npcDefs.map((def) => new NPCActor(def));

    this.dialogueRoot = dialogueRoot;
    this.dialogueSpeaker = dialogueSpeaker;
    this.dialogueText = dialogueText;
    this.dialogueChoices = dialogueChoices;
    this.dialogueHint = dialogueHint;

    this.onLockChange = onLockChange;
    this.onCurrencyAward = onCurrencyAward;

    this.activeConversation = null;
    this._typingElapsed = 0;
    this._visibleChars = 0;
    this._charsPerSecond = 42;
    this._fullText = '';
    this._pendingCloseReason = '';
  }

  setNpcs(npcDefs = []) {
    const hadConversation = this.isConversationActive;
    if (hadConversation) {
      this.cancelConversation('npc-reset');
    }
    this.npcs = npcDefs.map((def) => new NPCActor(def));
  }

  get isConversationActive() {
    return this.activeConversation !== null;
  }

  update(delta) {
    for (const npc of this.npcs) {
      npc.update(delta);
    }

    if (!this.activeConversation) return;

    if (this._visibleChars < this._fullText.length) {
      this._typingElapsed += delta * this._charsPerSecond;
      const nextVisible = Math.min(
        this._fullText.length,
        Math.floor(this._typingElapsed)
      );
      if (nextVisible !== this._visibleChars) {
        this._visibleChars = nextVisible;
        this._refreshDialogueText();
      }
    }
  }

  getNearestNpc(playerPos) {
    let bestNpc = null;
    let bestDist = Infinity;

    for (const npc of this.npcs) {
      const npcPos = npc.getWorldPosition(_tmpA);
      const dist = horizontalDistance(playerPos, npcPos);
      if (dist < bestDist) {
        bestDist = dist;
        bestNpc = npc;
      }
    }

    return { npc: bestNpc, distance: bestDist };
  }

  startConversation(npc, { onStart = null, onEnd = null } = {}) {
    if (!npc || !npc.dialogue || this.activeConversation) return false;

    const startNode = npc.dialogue.start || Object.keys(npc.dialogue.nodes || {})[0];
    if (!startNode) return false;

    npc.setTalking(true);
    this.activeConversation = {
      npc,
      nodeId: startNode,
      onEnd,
    };

    this._showDialogue(true);
    if (this.onLockChange) this.onLockChange(true, npc);
    if (onStart) onStart(npc);

    this._applyNode(startNode);
    return true;
  }

  advanceConversation() {
    const conv = this.activeConversation;
    if (!conv) return false;

    if (this._visibleChars < this._fullText.length) {
      this._visibleChars = this._fullText.length;
      this._refreshDialogueText();
      this._setHint('Choose a response');
      return true;
    }

    const node = this._getCurrentNode();
    if (!node) {
      this._endConversation('missing-node');
      return true;
    }

    if (Array.isArray(node.choices) && node.choices.length > 0) {
      this._setHint('Select a choice');
      return true;
    }

    if (node.next) {
      this._applyNode(node.next);
      return true;
    }

    this._endConversation(node.endReason || 'done');
    return true;
  }

  choose(index) {
    const conv = this.activeConversation;
    if (!conv) return;

    if (this._visibleChars < this._fullText.length) {
      this._visibleChars = this._fullText.length;
      this._refreshDialogueText();
      return;
    }

    const node = this._getCurrentNode();
    const choices = Array.isArray(node?.choices) ? node.choices : [];
    const choice = choices[index];
    if (!choice) return;

    const reward = Number(choice.grantCurrency ?? 0);
    if (reward > 0 && this.onCurrencyAward) {
      this.onCurrencyAward(reward, conv.npc, node, choice);
    }

    if (choice.next) {
      this._applyNode(choice.next);
      return;
    }

    this._endConversation(choice.endReason || 'done');
  }

  cancelConversation(reason = 'cancelled') {
    if (!this.activeConversation) return;
    this._endConversation(reason);
  }

  _getCurrentNode() {
    const conv = this.activeConversation;
    if (!conv) return null;
    return conv.npc.dialogue?.nodes?.[conv.nodeId] || null;
  }

  _applyNode(nodeId) {
    const conv = this.activeConversation;
    if (!conv) return;

    const node = conv.npc.dialogue?.nodes?.[nodeId];
    if (!node) {
      this._endConversation('missing-node');
      return;
    }

    conv.nodeId = nodeId;

    const reward = Number(node.grantCurrency ?? 0);
    if (reward > 0 && this.onCurrencyAward) {
      this.onCurrencyAward(reward, conv.npc, node, null);
    }

    this._fullText = String(node.text || '');
    this._typingElapsed = 0;
    this._visibleChars = 0;

    const speaker = node.speaker || conv.npc.name;
    if (this.dialogueSpeaker) {
      this.dialogueSpeaker.textContent = speaker;
    }

    this._refreshDialogueText();
    this._renderChoices(node.choices || []);

    if (node.end === true && !node.next && (!node.choices || node.choices.length === 0)) {
      this._pendingCloseReason = node.endReason || 'done';
    } else {
      this._pendingCloseReason = '';
    }
  }

  _renderChoices(choices) {
    if (!this.dialogueChoices) return;
    this.dialogueChoices.innerHTML = '';

    if (!Array.isArray(choices) || choices.length === 0) {
      this._setHint('Press E to continue');
      return;
    }

    this._setHint('Select a response');
    choices.forEach((choice, idx) => {
      const button = document.createElement('button');
      button.className = 'npc-choice';
      button.type = 'button';
      button.textContent = choice.label || choice.text || `Choice ${idx + 1}`;
      button.addEventListener('click', () => this.choose(idx));
      this.dialogueChoices.appendChild(button);
    });
  }

  _refreshDialogueText() {
    if (this.dialogueText) {
      this.dialogueText.textContent = this._fullText.slice(0, this._visibleChars);
    }

    if (this._visibleChars >= this._fullText.length && this._pendingCloseReason) {
      this._endConversation(this._pendingCloseReason);
    }
  }

  _setHint(text) {
    if (!this.dialogueHint) return;
    this.dialogueHint.textContent = text || '';
  }

  _showDialogue(visible) {
    if (!this.dialogueRoot) return;
    this.dialogueRoot.classList.toggle('hidden', !visible);
  }

  _endConversation(reason) {
    const conv = this.activeConversation;
    if (!conv) return;

    conv.npc.setTalking(false);
    this.activeConversation = null;
    this._fullText = '';
    this._typingElapsed = 0;
    this._visibleChars = 0;
    this._pendingCloseReason = '';

    if (this.dialogueText) this.dialogueText.textContent = '';
    if (this.dialogueChoices) this.dialogueChoices.innerHTML = '';
    this._setHint('');
    this._showDialogue(false);

    if (this.onLockChange) this.onLockChange(false, conv.npc);
    if (conv.onEnd) conv.onEnd(reason, conv.npc);
  }
}

const _tmpA = new THREE.Vector3();

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}
