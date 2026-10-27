/* Accessible checkbox menus shared by the merit, allotment and matrix views. */
(function (global) {
  const NON_RAJASTHAN = '__non_rajasthan__';
  const UNREPORTED = '__unreported__';

  function matches(selected, value) {
    if (!selected.size) return true;
    if (selected.has(NON_RAJASTHAN)) {
      return value !== null && value !== undefined && String(value).trim() !== '' &&
        String(value).trim().toLocaleLowerCase() !== 'rajasthan';
    }
    return selected.has(value) || ((value === null || value === undefined || value === '') && selected.has(UNREPORTED));
  }

  class MultiFilter {
    constructor(id, {label, allLabel, onChange, special = false}) {
      this.root = document.getElementById(id);
      this.label = label;
      this.allLabel = allLabel;
      this.onChange = onChange;
      this.special = special;
      this.selected = new Set();
      this.options = [];
      this.root.classList.add('multi-filter');
      this.root.innerHTML = '';

      const title = document.createElement('span');
      title.className = 'filter-label';
      title.textContent = label;
      this.details = document.createElement('details');
      this.details.className = 'multi-select';
      this.summary = document.createElement('summary');
      this.summary.className = 'multi-select-summary';
      this.panel = document.createElement('div');
      this.panel.className = 'multi-select-panel';
      this.search = document.createElement('input');
      this.search.type = 'search';
      this.search.placeholder = 'Find an option';
      this.search.setAttribute('aria-label', `Search ${label} options`);
      this.search.className = 'multi-select-search';
      this.list = document.createElement('div');
      this.list.className = 'multi-select-list';
      this.list.setAttribute('role', 'group');
      this.list.setAttribute('aria-label', `${label} options`);
      const actions = document.createElement('div');
      actions.className = 'multi-select-actions';
      this.selectVisible = document.createElement('button');
      this.selectVisible.type = 'button';
      this.selectVisible.textContent = 'Select shown';
      this.clearButton = document.createElement('button');
      this.clearButton.type = 'button';
      this.clearButton.textContent = 'Clear';
      actions.append(this.selectVisible, this.clearButton);
      this.panel.append(this.search, this.list, actions);
      this.details.append(this.summary, this.panel);
      this.root.append(title, this.details);
      this.search.addEventListener('input', () => this.searchOptions());
      this.selectVisible.addEventListener('click', () => {
        const shown = this.options.filter(option => option.value !== NON_RAJASTHAN && this.visible(option));
        this.selected.delete(NON_RAJASTHAN);
        shown.forEach(option => this.selected.add(option.value));
        this.renderOptions();
        this.onChange();
      });
      this.clearButton.addEventListener('click', () => this.clear());
      this.details.addEventListener('keydown', event => {
        if (event.key === 'Escape') { this.details.open = false; this.summary.focus(); }
      });
      this.updateSummary();
      MultiFilter.instances.push(this);
    }

    static instances = [];

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
      this.renderOptions();
    }

    setSelected(values, notify = false) {
      const allowed = new Set(this.options.map(option => option.value));
      this.selected = new Set(values.map(String).filter(value => allowed.has(value)));
      if (this.selected.has(NON_RAJASTHAN)) this.selected = new Set([NON_RAJASTHAN]);
      this.renderOptions();
      if (notify) this.onChange();
    }

    clear(notify = true) {
      this.selected.clear();
      this.renderOptions();
      if (notify) this.onChange();
    }

    values() { return [...this.selected]; }
    matches(value) { return matches(this.selected, value); }
    visible(option) { return option.label.toLocaleLowerCase().includes(this.search.value.trim().toLocaleLowerCase()); }

    searchOptions() {
      for (const option of this.list.children) {
        option.hidden = !this.visible({label: option.dataset.label});
      }
    }

    renderOptions() {
      this.list.replaceChildren();
      for (const option of this.options) {
        const label = document.createElement('label');
        label.className = option.value === NON_RAJASTHAN ? 'multi-select-option special-option' : 'multi-select-option';
        label.dataset.label = option.label;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option.value;
        checkbox.checked = this.selected.has(option.value);
        const text = document.createElement('span');
        text.textContent = option.label;
        label.append(checkbox, text);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            if (option.value === NON_RAJASTHAN) this.selected.clear();
            else this.selected.delete(NON_RAJASTHAN);
            this.selected.add(option.value);
          } else this.selected.delete(option.value);
          this.renderOptions();
          this.onChange();
        });
        this.list.append(label);
      }
      this.searchOptions();
      this.updateSummary();
    }

    updateSummary() {
      const values = this.values();
      const text = !values.length ? this.allLabel : values[0] === NON_RAJASTHAN ? 'All Except Rajasthan' :
        values.length === 1 ? this.options.find(option => option.value === values[0])?.label || values[0] : `${values.length} selected`;
      this.summary.textContent = text;
      this.summary.title = values.length > 1 ? values.map(value => this.options.find(option => option.value === value)?.label || value).join(', ') : '';
      this.summary.setAttribute('aria-label', `${this.label}: ${text}`);
      this.root.classList.toggle('has-selection', Boolean(values.length));
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', event => {
      for (const filter of MultiFilter.instances) {
        if (!filter.root.contains(event.target)) filter.details.open = false;
      }
    });
  }
  const api = {MultiFilter, matches, NON_RAJASTHAN, UNREPORTED};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.RajasthanFilters = api;
})(typeof window !== 'undefined' ? window : null);
