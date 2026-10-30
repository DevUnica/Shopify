(() => {
  if (customElements.get('lista-escolar-bolivar')) return;

  const parseInteger = (value, fallback) => {
    if (String(value).trim() === '') return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
  };

  class ListaEscolarBolivar extends HTMLElement {
    constructor() {
      super();
      this.rows = [];
      this.submitting = false;
      this.modalEl = null;
      this.modalTitleEl = null;
      this.openBtn = null;
      this.launcherMessageEl = null;
      this.triggerCountEl = null;
      this.triggerUnitsEl = null;
      this.triggerTotalEl = null;
      this.scrollLock = null;
      this.lastFocusedEl = null;
    }

    get moneyFormat() {
      return window.FoxTheme?.settings?.moneyFormat || '${{amount}}';
    }

    get cartAddUrl() {
      const url = window.FoxTheme?.routes?.cart_add_url || '/cart/add';
      return url.endsWith('.js') ? url : `${url}.js`;
    }

    get cartUrl() {
      return window.FoxTheme?.routes?.cart_url || '/cart';
    }

    get soldOutLabel() {
      return this.dataset.soldOutLabel || 'Agotado';
    }

    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;

      this.itemsEl = this.querySelector('[data-lista-escolar-items]');
      this.rows = Array.from(this.querySelectorAll('[data-lista-escolar-item]'));
      this.countEl = this.querySelector('[data-lista-escolar-count]');
      this.unitsEl = this.querySelector('[data-lista-escolar-units]');
      this.totalEl = this.querySelector('[data-lista-escolar-total]');
      this.submitEl = this.querySelector('[data-lista-escolar-submit]');
      this.messageEl = this.querySelector('[data-lista-escolar-message]');
      this.restoreEl = this.querySelector('[data-lista-escolar-restore]');
      this.selectAllBtn = this.querySelector('[data-lista-escolar-select-all]');
      this.selectedCountEl = this.querySelector('[data-lista-escolar-selected-count]');
      this.totalCountEl = this.querySelector('[data-lista-escolar-total-count]');
      this.modalEl = this.querySelector('[data-lista-escolar-modal]');
      this.modalTitleEl = this.querySelector('[data-lista-escolar-modal-title]');
      this.openBtn = this.querySelector('[data-lista-escolar-open]');
      this.launcherMessageEl = this.querySelector('[data-lista-escolar-launcher-message]');
      this.triggerCountEl = this.querySelector('[data-lista-escolar-trigger-count]');
      this.triggerUnitsEl = this.querySelector('[data-lista-escolar-trigger-units]');
      this.triggerTotalEl = this.querySelector('[data-lista-escolar-trigger-total]');
      this.scrollLock = null;
      this.lastFocusedEl = null;

      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      this.addEventListener('click', this.handleClick.bind(this), { signal });
      this.addEventListener('change', this.handleChange.bind(this), { signal });
      this.addEventListener('input', this.handleInput.bind(this), { signal });
      this.addEventListener('blur', this.handleBlur.bind(this), { signal, capture: true });

      this.setupModal(signal);

      this.rows.forEach((row) => this.initializeRow(row));

      if (this.totalCountEl) {
        this.totalCountEl.textContent = this.rows.length;
      }

      this.update();
    }

    disconnectedCallback() {
      this.abortController?.abort();
      this.unlockScroll();
    }

    /**
     * Ventana modal del listado.
     * Usa <dialog> nativo (top layer, Esc y foco gestionados por el navegador)
     * con respaldo manual para navegadores sin showModal().
     */
    setupModal(signal) {
      if (!this.modalEl) return;

      this.modalEl.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault();
          this.closeModal();
        },
        { signal }
      );

      this.modalEl.addEventListener(
        'click',
        (event) => {
          if (event.target === this.modalEl) this.closeModal();
        },
        { signal }
      );

      this.modalEl.addEventListener('keydown', (event) => this.trapModalFocus(event), { signal });

      this.modalEl.addEventListener(
        'close',
        () => {
          this.modalEl.classList.remove('is-open');
          this.unlockScroll();
        },
        { signal }
      );

      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Escape' || !this.isModalOpen()) return;
          event.preventDefault();
          this.closeModal();
        },
        { signal }
      );

      if (typeof this.modalEl.showModal !== 'function') {
        this.modalEl.setAttribute('data-lista-escolar-fallback', '');
      }
    }

    isModalOpen() {
      return Boolean(this.modalEl && this.modalEl.hasAttribute('open'));
    }

    openModal() {
      if (!this.modalEl || this.isModalOpen()) return;

      const activeElement = document.activeElement;
      this.lastFocusedEl =
        activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : this.openBtn;
      this.lockScroll();
      this.showMessage('', '');

      if (typeof this.modalEl.showModal === 'function') {
        this.modalEl.showModal();
      } else {
        this.modalEl.setAttribute('open', '');
      }

      this.modalEl.classList.add('is-open');

      const focusTarget = this.modalTitleEl || this.modalEl;
      window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
    }

    closeModal() {
      if (!this.modalEl || !this.isModalOpen()) return;

      this.modalEl.classList.remove('is-open');

      if (typeof this.modalEl.close === 'function' && this.modalEl.open) {
        this.modalEl.close();
      } else {
        this.modalEl.removeAttribute('open');
      }

      this.unlockScroll();

      const focusTarget =
        this.lastFocusedEl && document.contains(this.lastFocusedEl) ? this.lastFocusedEl : this.openBtn;
      this.lastFocusedEl = null;

      if (focusTarget) {
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
    }

    lockScroll() {
      if (this.scrollLock) return;

      this.scrollLock = {
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow
      };

      document.documentElement.classList.add('lista-escolar-scroll-locked');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    unlockScroll() {
      if (!this.scrollLock) return;

      document.documentElement.style.overflow = this.scrollLock.html;
      document.body.style.overflow = this.scrollLock.body;
      document.documentElement.classList.remove('lista-escolar-scroll-locked');
      this.scrollLock = null;
    }

    getModalFocusableElements() {
      if (!this.modalEl) return [];

      const selector =
        "a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])";

      return Array.from(this.modalEl.querySelectorAll(selector)).filter(
        (element) => element.getClientRects().length > 0
      );
    }

    trapModalFocus(event) {
      if (event.key !== 'Tab' || !this.isModalOpen()) return;

      const focusable = this.getModalFocusableElements();

      if (!focusable.length) {
        event.preventDefault();
        this.modalTitleEl?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!this.modalEl.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && (document.activeElement === first || document.activeElement === this.modalEl)) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    initializeRow(row) {
      row._checkbox = row.querySelector('[data-lista-escolar-checkbox]');
      row._quantityInput = row.querySelector('[data-lista-escolar-quantity]');
      row._decreaseBtn = row.querySelector('[data-lista-escolar-decrease]');
      row._increaseBtn = row.querySelector('[data-lista-escolar-increase]');
      row._removeBtn = row.querySelector('[data-lista-escolar-remove]');
      row._variantSelect = row.querySelector('[data-lista-escolar-variant-select]');
      row._lineTotalEl = row.querySelector('[data-lista-escolar-line-total]');
      row._unitPriceEl = row.querySelector('[data-lista-escolar-unit-price]');
      row._priceValEl = row.querySelector('[data-lista-escolar-price-val]');
      row._skuEl = row.querySelector('[data-lista-escolar-sku]');
      row._skuValEl = row.querySelector('[data-lista-escolar-sku-val]');
      row._imageEl = row.querySelector('[data-lista-escolar-image]');
      row._soldoutBadge = row.querySelector('[data-lista-escolar-soldout-badge]');
      row._omittedBadge = row.querySelector('[data-lista-escolar-omitted-badge]');

      const isAvailable = row.dataset.available === 'true';
      const state = {
        min: Math.max(1, parseInteger(row.dataset.min, 1)),
        max: row.dataset.max ? parseInteger(row.dataset.max, null) : null,
        step: Math.max(1, parseInteger(row.dataset.step, 1)),
        price: parseInteger(row.dataset.price, 0),
        available: isAvailable,
        selected: isAvailable,
        variantId: row.dataset.variantId,
        defaultVariantId: row.dataset.variantId,
        defaultQuantity: parseInteger(row.dataset.defaultQuantity, 1)
      };

      if (state.max !== null && !Number.isFinite(state.max)) state.max = null;
      state.defaultQuantity = this.clampQuantity(state, state.defaultQuantity);
      state.quantity = state.defaultQuantity;

      if (row._quantityInput) row._quantityInput.value = state.quantity;
      if (row._quantityInput) row._quantityInput.min = 0;
      if (row._checkbox) {
        row._checkbox.checked = state.selected;
        row._checkbox.disabled = !state.available;
      }

      row._state = state;
    }

    clampQuantity(state, value) {
      let quantity = parseInteger(value, state.min);
      if (quantity === 0) return 0;
      quantity = Math.max(state.min, quantity);
      const maxValidQuantity =
        state.max === null
          ? null
          : state.min + Math.floor(Math.max(0, state.max - state.min) / state.step) * state.step;

      if (maxValidQuantity !== null) {
        quantity = Math.min(maxValidQuantity, quantity);
      }

      if (state.step > 1) {
        const difference = quantity - state.min;
        const remainder = difference % state.step;
        if (remainder !== 0) {
          const roundedUp = quantity + state.step - remainder;
          quantity =
            maxValidQuantity !== null && roundedUp > maxValidQuantity
              ? quantity - remainder
              : roundedUp;
        }
      }

      return Math.max(1, quantity);
    }

    getActiveRows() {
      return this.rows.filter((row) => {
        const state = row._state;
        return state.available && state.selected && state.quantity > 0;
      });
    }

    update() {
      const activeRows = this.getActiveRows();
      const count = activeRows.length;
      const units = activeRows.reduce((total, row) => total + row._state.quantity, 0);
      const total = activeRows.reduce((sum, row) => sum + row._state.price * row._state.quantity, 0);

      this.rows.forEach((row) => {
        const state = row._state;

        if (!state.available) {
          row.classList.add('is-unavailable');
          row.classList.remove('is-omitted', 'is-zero-quantity');
          if (row._checkbox) {
            row._checkbox.checked = false;
            row._checkbox.disabled = true;
          }
          if (row._quantityInput) row._quantityInput.disabled = true;
          if (row._decreaseBtn) row._decreaseBtn.disabled = true;
          if (row._increaseBtn) row._increaseBtn.disabled = true;
          if (row._removeBtn) row._removeBtn.disabled = true;
          if (row._soldoutBadge) row._soldoutBadge.hidden = false;
          if (row._omittedBadge) row._omittedBadge.hidden = true;
          if (row._lineTotalEl) row._lineTotalEl.textContent = this.soldOutLabel;
        } else if (!state.selected) {
          row.classList.add('is-omitted');
          row.classList.remove('is-unavailable', 'is-zero-quantity');
          if (row._checkbox) {
            row._checkbox.checked = false;
            row._checkbox.disabled = false;
          }
          if (row._quantityInput) row._quantityInput.disabled = true;
          if (row._decreaseBtn) row._decreaseBtn.disabled = true;
          if (row._increaseBtn) row._increaseBtn.disabled = true;
          if (row._removeBtn) {
            row._removeBtn.disabled = false;
            row._removeBtn.title = 'Incluir de nuevo en la lista';
          }
          if (row._soldoutBadge) row._soldoutBadge.hidden = true;
          if (row._omittedBadge) row._omittedBadge.hidden = false;
          if (row._lineTotalEl) {
            if (row._omittedBadge) row._omittedBadge.textContent = 'No incluido';
            row._lineTotalEl.innerHTML = '<span class="lista-escolar__omitted-text">No incluido</span>';
          }
        } else {
          row.classList.remove('is-omitted', 'is-unavailable');
          row.classList.toggle('is-zero-quantity', state.quantity === 0);
          if (row._checkbox) {
            row._checkbox.checked = true;
            row._checkbox.disabled = false;
          }
          if (row._quantityInput) {
            row._quantityInput.disabled = false;
            row._quantityInput.min = 0;
          }
          if (row._decreaseBtn) {
            row._decreaseBtn.disabled = state.quantity === 0;
          }
          if (row._increaseBtn) {
            row._increaseBtn.disabled = state.max !== null && state.quantity >= state.max;
          }
          if (row._removeBtn) {
            row._removeBtn.disabled = false;
            row._removeBtn.title = 'Omitir este útil de la lista';
          }
          if (row._soldoutBadge) row._soldoutBadge.hidden = true;
          if (row._omittedBadge) {
            row._omittedBadge.hidden = state.quantity !== 0;
            row._omittedBadge.textContent = 'Cantidad 0: no se agregará';
          }
          if (row._lineTotalEl) {
            row._lineTotalEl.textContent = this.formatMoney(state.price * state.quantity);
          }
        }
      });

      if (this.countEl) this.countEl.textContent = count;
      if (this.selectedCountEl) this.selectedCountEl.textContent = count;
      if (this.unitsEl) this.unitsEl.textContent = units;
      if (this.totalEl) this.totalEl.textContent = this.formatMoney(total);
      if (this.triggerCountEl) this.triggerCountEl.textContent = count;
      if (this.triggerUnitsEl) this.triggerUnitsEl.textContent = units;
      if (this.triggerTotalEl) this.triggerTotalEl.textContent = this.formatMoney(total);
      if (this.submitEl) this.submitEl.disabled = count === 0 || this.submitting;

      const hasModifications = this.rows.some((row) => {
        const s = row._state;
        return (
          (!s.selected && s.available) ||
          s.quantity !== s.defaultQuantity ||
          s.variantId !== s.defaultVariantId
        );
      });
      if (this.restoreEl) this.restoreEl.hidden = !hasModifications;

      if (this.selectAllBtn) {
        const availableRows = this.rows.filter((r) => r._state.available);
        const allSelected = availableRows.length > 0 && availableRows.every((r) => r._state.selected);
        this.selectAllBtn.textContent = allSelected ? 'Deseleccionar todos' : 'Seleccionar todos';
      }
    }

    formatMoney(cents) {
      const formatter = window.FoxTheme?.Currency?.formatMoney;
      if (typeof formatter === 'function') {
        try {
          return formatter(cents, this.moneyFormat);
        } catch (error) {
          // Ignorar y continuar con formateo de respaldo
        }
      }
      const amount = Math.round(cents / 100);
      return `$ ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    }

    showMessage(message, type) {
      this.setMessage(this.messageEl, message, type);

      // El mensaje de la página solo se actualiza con el modal cerrado,
      // así no queda un aviso "huérfano" detrás del modal.
      if (!this.isModalOpen()) {
        this.setMessage(this.launcherMessageEl, message, type);
      }
    }

    setMessage(element, message, type) {
      if (!element) return;

      element.classList.remove('alert--error', 'alert--success', 'alert--warning');
      element.hidden = !message;
      element.textContent = message || '';

      if (message && type) {
        element.classList.add(`alert--${type}`);
      }
    }

    handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('[data-lista-escolar-open]')) {
        event.preventDefault();
        this.openModal();
        return;
      }

      if (target.closest('[data-lista-escolar-close]')) {
        event.preventDefault();
        this.closeModal();
        return;
      }

      const submitButton = target.closest('[data-lista-escolar-submit]');
      if (submitButton) {
        event.preventDefault();
        this.submit();
        return;
      }

      const restoreButton = target.closest('[data-lista-escolar-restore]');
      if (restoreButton) {
        event.preventDefault();
        this.restore();
        return;
      }

      const selectAllBtn = target.closest('[data-lista-escolar-select-all]');
      if (selectAllBtn) {
        event.preventDefault();
        this.toggleSelectAll();
        return;
      }

      const row = target.closest('[data-lista-escolar-item]');
      if (!row || !row._state) return;

      if (target.closest('[data-lista-escolar-increase]')) {
        this.changeQuantity(row, row._state.quantity + row._state.step);
        return;
      }

      if (target.closest('[data-lista-escolar-decrease]')) {
        this.changeQuantity(row, row._state.quantity - row._state.step);
        return;
      }

      if (target.closest('[data-lista-escolar-remove]')) {
        this.toggleRowRemoval(row);
      }
    }

    handleChange(event) {
      const target = event.target;
      if (!target) return;

      const checkbox = target.closest?.('[data-lista-escolar-checkbox]');
      if (checkbox) {
        const row = checkbox.closest('[data-lista-escolar-item]');
        if (row && row._state) {
          this.setRowSelected(row, checkbox.checked);
        }
        return;
      }

      const variantSelect = target.closest?.('[data-lista-escolar-variant-select]');
      if (variantSelect) {
        const row = variantSelect.closest('[data-lista-escolar-item]');
        if (row && row._state) {
          this.changeVariant(row, variantSelect);
        }
        return;
      }

      const input = target.closest?.('[data-lista-escolar-quantity]');
      if (input) {
        this.commitInput(input);
      }
    }

    handleBlur(event) {
      const input = event.target.closest?.('[data-lista-escolar-quantity]');
      if (!input) return;
      this.commitInput(input);
    }

    handleInput(event) {
      const input = event.target.closest?.('[data-lista-escolar-quantity]');
      if (!input) return;

      const row = input.closest('[data-lista-escolar-item]');
      if (!row || !row._state || !row._state.available || !row._state.selected) return;

      const state = row._state;
      const value = parseInteger(input.value, null);
      if (value === 0) {
        state.quantity = 0;
        this.update();
        return;
      }
      if (value === null || value < state.min) return;

      const capped = state.max !== null ? Math.min(value, state.max) : value;
      if (capped !== value) return;
      if (state.step > 1 && (capped - state.min) % state.step !== 0) return;

      state.quantity = capped;
      this.update();
    }

    commitInput(input) {
      const row = input.closest('[data-lista-escolar-item]');
      if (!row || !row._state || !row._state.available) return;

      const state = row._state;
      if (parseInteger(input.value, null) === 0) {
        state.quantity = 0;
        input.value = 0;
        this.update();
        return;
      }
      state.quantity = this.clampQuantity(state, input.value);
      input.value = state.quantity;
      this.update();
    }

    changeQuantity(row, value) {
      const state = row._state;
      if (!state.available || !state.selected) return;

      if (state.quantity === 0 && value > 0) {
        value = state.min;
      } else if (value < state.min) {
        value = 0;
      }

      const quantity = this.clampQuantity(state, value);
      if (quantity === state.quantity) return;

      state.quantity = quantity;
      if (row._quantityInput) row._quantityInput.value = quantity;
      this.update();
    }

    setRowSelected(row, selected) {
      const state = row._state;
      if (!state.available) return;

      if (!selected) {
        const remainingActive = this.rows.filter(
          (candidate) => candidate !== row && candidate._state.available && candidate._state.selected
        ).length;

        if (remainingActive < 1) {
          if (row._checkbox) row._checkbox.checked = true;
          this.showMessage(
            this.dataset.errorMinimum || 'Debes mantener al menos un útil seleccionado en la lista.',
            'warning'
          );
          return;
        }
      }

      state.selected = selected;
      this.showMessage('', '');
      this.update();
    }

    toggleRowRemoval(row) {
      const state = row._state;
      if (!state.available) return;

      if (state.selected) {
        this.setRowSelected(row, false);
      } else {
        this.setRowSelected(row, true);
      }
    }

    toggleSelectAll() {
      const availableRows = this.rows.filter((r) => r._state.available);
      if (availableRows.length === 0) return;

      const allSelected = availableRows.every((r) => r._state.selected);

      if (allSelected) {
        availableRows.forEach((r, index) => {
          r._state.selected = index === 0;
          if (r._checkbox) r._checkbox.checked = index === 0;
        });
        this.showMessage('Se mantuvo un útil seleccionado, ya que la lista requiere al menos uno.', 'warning');
      } else {
        availableRows.forEach((r) => {
          r._state.selected = true;
          if (r._checkbox) r._checkbox.checked = true;
        });
        this.showMessage('', '');
      }

      this.update();
    }

    changeVariant(row, select) {
      const state = row._state;
      const option = select.options[select.selectedIndex];
      if (!option) return;

      const newVariantId = option.value;
      const newPrice = parseInteger(option.dataset.price, state.price);
      const isAvailable = option.dataset.available === 'true';
      const min = Math.max(1, parseInteger(option.dataset.min, 1));
      const step = Math.max(1, parseInteger(option.dataset.step, 1));
      const max = option.dataset.max ? parseInteger(option.dataset.max, null) : null;

      state.variantId = newVariantId;
      state.price = newPrice;
      state.available = isAvailable;
      state.min = min;
      state.step = step;
      state.max = max;

      row.dataset.variantId = newVariantId;
      row.dataset.price = newPrice;
      row.dataset.available = String(isAvailable);

      if (row._priceValEl) {
        row._priceValEl.textContent = this.formatMoney(newPrice);
      }

      if (option.dataset.sku && row._skuValEl) {
        row._skuValEl.textContent = option.dataset.sku;
        if (row._skuEl) row._skuEl.hidden = false;
      } else if (row._skuEl) {
        row._skuEl.hidden = true;
      }

      if (option.dataset.imageSrc && row._imageEl) {
        row._imageEl.src = option.dataset.imageSrc;
        if (option.dataset.imageSrcset) {
          row._imageEl.srcset = option.dataset.imageSrcset;
        }
      }

      if (isAvailable) {
        state.selected = true;
      } else {
        state.selected = false;
      }

      state.quantity = this.clampQuantity(state, state.quantity);
      if (row._quantityInput) {
        row._quantityInput.value = state.quantity;
        row._quantityInput.min = 0;
        row._quantityInput.step = state.step;
        if (state.max !== null) {
          row._quantityInput.max = state.max;
        } else {
          row._quantityInput.removeAttribute('max');
        }
      }

      if (!isAvailable && this.getActiveRows().length === 0) {
        this.showMessage(
          'La variante no está disponible. Selecciona otra variante o incluye otro útil.',
          'warning'
        );
      } else {
        this.showMessage('', '');
      }

      this.update();
    }

    restore() {
      this.rows.forEach((row) => {
        const state = row._state;
        if (state.available) {
          state.selected = true;
        }
        state.quantity = this.clampQuantity(state, state.defaultQuantity);
        if (row._quantityInput) row._quantityInput.value = state.quantity;
        if (row._checkbox) row._checkbox.checked = state.selected;

        if (state.defaultVariantId && row._variantSelect && state.variantId !== state.defaultVariantId) {
          row._variantSelect.value = state.defaultVariantId;
          this.changeVariant(row, row._variantSelect);
        }
      });

      this.update();
      this.showMessage('', '');
    }

    async submit() {
      if (this.submitting) return;

      const activeRows = this.getActiveRows();
      if (!activeRows.length) {
        this.showMessage(
          this.dataset.errorEmpty || 'Debes seleccionar al menos un útil disponible para agregar la lista al carrito.',
          'warning'
        );
        return;
      }

      const items = activeRows.map((row) => ({
        id: Number(row.dataset.variantId || row._state.variantId),
        quantity: row._state.quantity
      }));

      if (
        items.some(
          (item) =>
            !Number.isSafeInteger(item.id) ||
            item.id <= 0 ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1
        )
      ) {
        this.showMessage(
          this.dataset.errorCart || 'Verifica los útiles seleccionados antes de continuar.',
          'error'
        );
        return;
      }

      this.submitting = true;
      this.update();
      this.showMessage('', '');
      this.submitEl?.classList.add('btn--loading');
      this.submitEl?.setAttribute('aria-busy', 'true');

      try {
        const response = await fetch(this.cartAddUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ items })
        });

        let data = null;
        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }

        if (!response.ok || (data && data.status)) {
          const serverError =
            (data && (data.description || data.message)) ||
            this.dataset.errorCart ||
            'No se pudo agregar la lista al carrito. Verifica la disponibilidad.';
          throw new Error(serverError);
        }

        const units = items.reduce((sum, item) => sum + item.quantity, 0);

        // Se cierra el modal para que el carrito quede visible y accesible.
        // El mensaje de confirmación se muestra junto al botón que abre la lista.
        this.closeModal();
        this.showMessage(
          `¡Listo! Se agregaron ${units} ${units === 1 ? 'unidad' : 'unidades'} al carrito.`,
          'success'
        );
        await this.refreshCart(data);
      } catch (error) {
        this.showMessage(
          error?.message || this.dataset.errorCart || 'No se pudo agregar la lista al carrito.',
          'error'
        );
      } finally {
        this.submitting = false;
        this.submitEl?.classList.remove('btn--loading');
        this.submitEl?.removeAttribute('aria-busy');
        this.update();
      }
    }

    async refreshCart(addedData) {
      let cart = null;
      try {
        const response = await fetch(`${this.cartUrl}.js`, {
          headers: { Accept: 'application/json' }
        });
        if (response.ok) {
          cart = await response.json();
          window.FoxTheme?.pubsub?.publish?.(window.FoxTheme.pubsub.PUB_SUB_EVENTS.cartUpdate, { cart });
        }
      } catch (error) {
        // Continuar con los eventos y el drawer
      }

      document.dispatchEvent(
        new CustomEvent('cart:refresh', {
          bubbles: true,
          detail: { open: true }
        })
      );

      if (addedData) {
        document.dispatchEvent(
          new CustomEvent('product-ajax:added', {
            bubbles: true,
            detail: { product: addedData }
          })
        );
      }

      const cartType = this.dataset.cartType || window.FoxTheme?.settings?.cartType;
      const cartDrawer = document.querySelector('cart-drawer');

      if (cartType === 'page' || !cartDrawer) {
        window.location.href = this.cartUrl;
        return;
      }

      if (typeof cartDrawer.show === 'function') {
        cartDrawer.show(this.openBtn || this.submitEl);
      } else if (typeof cartDrawer.open === 'function') {
        cartDrawer.open();
      }
    }
  }

  customElements.define('lista-escolar-bolivar', ListaEscolarBolivar);
})();
