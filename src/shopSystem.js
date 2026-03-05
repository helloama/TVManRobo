export class ShopSystem {
  constructor({
    root = null,
    currencyLabel = null,
    inventoryLabel = null,
    itemList = null,
    hintLabel = null,
    onLockChange = null,
    onPurchase = null,
    onStateChange = null,
  }) {
    this.root = root;
    this.currencyLabel = currencyLabel;
    this.inventoryLabel = inventoryLabel;
    this.itemList = itemList;
    this.hintLabel = hintLabel;

    this.onLockChange = onLockChange;
    this.onPurchase = onPurchase;
    this.onStateChange = onStateChange;

    this.currency = 0;
    this.items = [];
    this.inventory = [];
    this.inventorySet = new Set();
    this.isOpen = false;
  }

  configure({ items = [], currency = 0, inventory = [] } = {}) {
    this.items = Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
    this.currency = Math.max(0, Number(currency) || 0);
    this.inventory = Array.from(inventory);
    this.inventorySet = new Set(this.inventory);
    this.render();
    this._emitState();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    if (this.root) this.root.classList.remove('hidden');
    if (this.hintLabel) this.hintLabel.textContent = 'Click an item to purchase. Esc closes shop.';
    if (this.onLockChange) this.onLockChange(true);
    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.root) this.root.classList.add('hidden');
    if (this.onLockChange) this.onLockChange(false);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  setCurrency(value) {
    this.currency = Math.max(0, Number(value) || 0);
    this.render();
    this._emitState();
  }

  addCurrency(delta) {
    this.setCurrency(this.currency + (Number(delta) || 0));
  }

  hasItem(itemId) {
    return this.inventorySet.has(itemId);
  }

  tryPurchase(itemId) {
    const item = this.items.find((entry) => entry.id === itemId);
    if (!item) return false;

    const oneShot = item.oneShot !== false;
    if (oneShot && this.inventorySet.has(item.id)) {
      this._setHint('Already purchased.');
      return false;
    }

    const cost = Math.max(0, Number(item.cost) || 0);
    if (this.currency < cost) {
      this._setHint('Not enough currency.');
      return false;
    }

    this.currency -= cost;
    this.inventory.push(item.id);
    this.inventorySet.add(item.id);

    if (this.onPurchase) this.onPurchase(item);
    this._setHint(`Purchased: ${item.name}`);
    this.render();
    this._emitState();
    return true;
  }

  _setHint(text) {
    if (!this.hintLabel) return;
    this.hintLabel.textContent = text || '';
  }

  _emitState() {
    if (!this.onStateChange) return;
    this.onStateChange({
      currency: this.currency,
      inventory: [...this.inventory],
    });
  }

  render() {
    if (this.currencyLabel) {
      this.currencyLabel.textContent = `${this.currency}`;
    }
    if (this.inventoryLabel) {
      this.inventoryLabel.textContent = `${this.inventory.length}`;
    }
    if (!this.itemList) return;

    this.itemList.innerHTML = '';

    for (const item of this.items) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'shop-item';
      entry.dataset.itemId = item.id;

      const oneShot = item.oneShot !== false;
      const owned = oneShot && this.inventorySet.has(item.id);
      const affordable = this.currency >= (item.cost || 0);

      if (owned) {
        entry.classList.add('owned');
      } else if (!affordable) {
        entry.classList.add('locked');
      }

      entry.innerHTML = `
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-meta">
          <span>${item.description || ''}</span>
          <span>${item.cost} Bits</span>
        </div>
      `;

      entry.disabled = owned;
      entry.addEventListener('click', () => this.tryPurchase(item.id));
      this.itemList.appendChild(entry);
    }
  }
}
