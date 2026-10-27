/* Search-first, multi-select filters shared by the Rajasthan data views. */
(function (global) {
  const NON_RAJASTHAN = '__non_rajasthan__';
  const UNREPORTED = '__unreported__';

  function matches(selected, value) {
    if (!selected.size) return true;
    if (selected.has(NON_RAJASTHAN)) {
      const domicile = String(value ?? '').trim().toLocaleLowerCase();
      return domicile !== '' && domicile !== 'rajasthan' && domicile !== 'not applicable';
    }
    return selected.has(value) || ((value === null || value === undefined || value === '') && selected.has(UNREPORTED));
  }

  function searchChoices(options, query) {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter(option => {
      const text = `${option.label} ${option.value}`.toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    });
  }

  class MultiFilter {
    static instances = [];

    constructor(id, {label, allLabel, onChange, special = false}) {
      this.root = document.getElementById(id);
      this.label = label;
      this.allLabel = allLabel;
      this.onChange = onChange;
      this.special = special;
      this.selected = new Set();
      this.options = [];
      this.root.classList.add('multi-filter');
      this.root.replaceChildren();

      const title = document.createElement('label');
      title.className = 'filter-label';
      title.htmlFor = `${id}-search`;
      title.textContent = label;
      this.chips = document.createElement('div');
      this.chips.className = 'picker-chips';
      this.control = document.createElement('div');
      this.control.className = 'picker-control';
      this.search = document.createElement('input');
      this.search.id = `${id}-search`;
      this.search.type = 'search';
      this.search.autocomplete = 'off';
      this.search.spellcheck = false;
      this.search.placeholder = `Find ${label.toLocaleLowerCase()}…`;
      this.search.setAttribute('aria-controls', `${id}-options`);
      this.search.setAttribute('aria-expanded', 'false');
      this.toggle = document.createElement('button');
      this.toggle.type = 'button';
      this.toggle.className = 'picker-toggle';
      this.toggle.setAttribute('aria-label', `Browse ${label.toLocaleLowerCase()} options`);
      this.toggle.textContent = '⌄';
      this.control.append(this.search, this.toggle);

      this.popover = document.createElement('div');
      this.popover.className = 'picker-popover';
      this.popover.hidden = true;
      this.count = document.createElement('p');
      this.count.className = 'picker-count';
      this.list = document.createElement('div');
      this.list.id = `${id}-options`;
      this.list.className = 'picker-options';
      this.list.setAttribute('role', 'group');
      this.list.setAttribute('aria-label', `${label} options`);
      const actions = document.createElement('div');
      actions.className = 'picker-actions';
      this.selectVisible = document.createElement('button');
      this.selectVisible.type = 'button';
      this.selectVisible.textContent = 'Select matches';
      this.clearButton = document.createElement('button');
      this.clearButton.type = 'button';
      this.clearButton.textContent = 'Clear selection';
      actions.append(this.selectVisible, this.clearButton);
      this.popover.append(this.count, this.list, actions);
      this.caption = document.createElement('p');
      this.caption.className = 'picker-caption';
      this.root.append(title, this.chips, this.control, this.popover, this.caption);

      this.search.addEventListener('focus', () => this.open());
      this.search.addEventListener('input', () => { this.open(); this.renderOptions(); });
      this.search.addEventListener('keydown', event => {
        if (event.key === 'Escape') { this.close(); this.search.blur(); }
        if (event.key === 'ArrowDown') {
          event.preventDefault(); this.open(); this.list.querySelector('input')?.focus();
        }
        if (event.key === 'Enter') {
          const first = this.list.querySelector('input');
          if (first && !this.popover.hidden) { event.preventDefault(); first.click(); }
        }
      });
      this.toggle.addEventListener('click', () => {
        if (this.popover.hidden) { this.open(); this.search.focus(); }
        else { this.close(); this.toggle.focus(); }
      });
      this.selectVisible.addEventListener('click', () => {
        const values = searchChoices(this.options, this.search.value)
          .map(option => option.value).filter(value => value !== NON_RAJASTHAN);
        if (!values.length) return;
        this.selected.delete(NON_RAJASTHAN);
        values.forEach(value => this.selected.add(value));
        this.search.value = '';
        this.render(); this.search.focus(); this.onChange();
      });
      this.clearButton.addEventListener('click', () => { this.clear(); this.search.focus(); });
      this.root.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !this.popover.hidden) {
          event.preventDefault(); this.close(); this.search.focus();
        }
      });
      this.root.addEventListener('focusout', event => {
        if (!this.root.contains(event.relatedTarget)) this.close();
      });
      this.render();
      MultiFilter.instances.push(this);
    }

    setOptions(values, {preserve = true, labels = {}, sort = true} = {}) {
      const choices = [...new Set(values.filter(value => value !== null && value !== undefined && value !== '').map(String))];
      if (sort) choices.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
      this.options = choices.map(value => ({value, label: labels[value] || value}));
      if (this.special && choices.some(value => value.toLocaleLowerCase() !== 'rajasthan')) {
        this.options.unshift({value: NON_RAJASTHAN, label: 'All Except Rajasthan'});
      }
      if (values.some(value => value === null || value === undefined || value === '')) {
        this.options.push({value: UNREPORTED, label: 'Unreported'});
      }
      const allowed = new Set(this.options.map(option => option.value));
      this.selected = preserve ? new Set([...this.selected].filter(value => allowed.has(value))) : new Set();
      this.search.value = '';
      this.render();
    }

    setSelected(values, notify = false) {
      const allowed = new Set(this.options.map(option => option.value));
      this.selected = new Set(values.map(String).filter(value => allowed.has(value)));
      if (this.selected.has(NON_RAJASTHAN)) this.selected = new Set([NON_RAJASTHAN]);
      this.render();
      if (notify) this.onChange();
    }

    clear(notify = true) {
      this.selected.clear(); this.search.value = ''; this.render();
      if (notify) this.onChange();
    }

    values() { return [...this.selected]; }
    matches(value) { return matches(this.selected, value); }

    open() {
      for (const filter of MultiFilter.instances) if (filter !== this) filter.close();
      this.popover.hidden = false;
      this.root.classList.add('is-open');
      this.search.setAttribute('aria-expanded', 'true');
      this.positionPopover();
      this.renderOptions();
    }

    close() {
      this.popover.hidden = true;
      this.root.classList.remove('is-open');
      this.search.setAttribute('aria-expanded', 'false');
    }

    positionPopover() {
      const rect = this.root.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      this.popover.style.left = `${Math.max(12 - rect.left, Math.min(0, window.innerWidth - 12 - rect.left - width))}px`;
    }

    selectOption(value) {
      if (this.selected.has(value)) this.selected.delete(value);
      else {
        if (value === NON_RAJASTHAN) this.selected.clear();
        else this.selected.delete(NON_RAJASTHAN);
        this.selected.add(value);
      }
      this.search.value = '';
      this.render(); this.search.focus(); this.onChange();
    }

    render() {
      this.renderChips(); this.renderOptions();
      this.caption.textContent = this.selected.size ? `${this.selected.size} selected · type to add more` : this.allLabel;
      this.root.classList.toggle('has-selection', Boolean(this.selected.size));
    }

    renderChips() {
      this.chips.replaceChildren();
      this.chips.hidden = !this.selected.size;
      for (const value of this.selected) {
        const label = this.options.find(option => option.value === value)?.label || value;
        const chip = document.createElement('span');
        chip.className = 'picker-chip';
        const text = document.createElement('span');
        text.textContent = label;
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove ${label} from ${this.label}`);
        remove.addEventListener('click', () => {
          this.selected.delete(value); this.render(); this.onChange();
        });
        chip.append(text, remove); this.chips.append(chip);
      }
    }

    renderOptions() {
      const query = this.search.value;
      const found = searchChoices(this.options, query);
      const shown = query.trim() ? found : [
        ...found.filter(option => this.selected.has(option.value)),
        ...found.filter(option => !this.selected.has(option.value))
      ];
      this.list.replaceChildren();
      this.count.textContent = `${found.length} matching option${found.length === 1 ? '' : 's'}`;
      this.selectVisible.hidden = !query.trim() || !found.some(option => option.value !== NON_RAJASTHAN);
      this.clearButton.disabled = !this.selected.size;
      if (!shown.length) {
        const empty = document.createElement('p');
        empty.className = 'picker-empty';
        empty.textContent = 'No matching options. Try another search.';
        this.list.append(empty);
        return;
      }
      for (const option of shown) {
        const label = document.createElement('label');
        label.className = option.value === NON_RAJASTHAN ? 'picker-option special-option' : 'picker-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.value = option.value;
        checkbox.checked = this.selected.has(option.value);
        const text = document.createElement('span');
        text.textContent = option.label;
        label.append(checkbox, text);
        checkbox.addEventListener('change', () => this.selectOption(option.value));
        this.list.append(label);
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', event => {
      for (const filter of MultiFilter.instances) if (!filter.root.contains(event.target)) filter.close();
    });
    window.addEventListener('resize', () => {
      for (const filter of MultiFilter.instances) if (!filter.popover.hidden) filter.positionPopover();
    });
  }
  const api = {MultiFilter, matches, searchChoices, NON_RAJASTHAN, UNREPORTED};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.RajasthanFilters = api;
})(typeof window !== 'undefined' ? window : null);
