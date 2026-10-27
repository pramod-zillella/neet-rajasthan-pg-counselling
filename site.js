(async function () {
  const kind = document.body.dataset.page;
  if (!kind) return;

  const byId = id => document.getElementById(id);
  const {MultiFilter} = window.RajasthanFilters;
  const searchEl = byId('search-filter');
  const countEl = byId('result-count');
  const hintEl = byId('table-hint');
  const headEl = byId('table-head');
  const bodyEl = byId('table-body');
  const sourceEl = byId('source-list');
  const dialog = byId('pdf-dialog');
  const frame = byId('pdf-frame');
  const ranges = {
    minRank: byId('min-rank'), maxRank: byId('max-rank'),
    minAir: byId('min-air'), maxAir: byId('max-air')
  };
  const state = { documents: [], rows: [], filtered: [], rendered: 0, sortKey: '', direction: 1, token: 0 };
  const cache = new Map();
  const pageParams = new URLSearchParams(location.search);
  const requestedRounds = (pageParams.get('round') || '').split(',').filter(Boolean);
  const requestedYears = (pageParams.get('year') || '2025').split(',').filter(year => ['2024','2025'].includes(year));
  const yearFilter = new MultiFilter('year-filter', {label:'Exam year', allLabel:'All years', onChange:() => {
    searchEl.value = '';
    Object.values(ranges).forEach(control => { control.value = ''; });
    Object.values(filters).filter(Boolean).forEach(filter => filter.clear(false));
    loadYears();
  }});
  yearFilter.setOptions(['2024','2025']);
  yearFilter.setSelected(requestedYears);
  const roundFilter = new MultiFilter('round-filter', {label:'Round', allLabel:kind === 'merit' ? 'All rounds' : 'All recovered rounds', onChange:applyFilters});
  const makeFilter = (id,label,allLabel,special=false) => byId(id) ? new MultiFilter(id,{label,allLabel,special,onChange:applyFilters}) : null;
  const filters = {
    college:makeFilter('college-filter','College','All colleges'),
    course:makeFilter('course-filter','Course','All courses'),
    seat_type:makeFilter('seat-filter','Allotted seat type','All seat types'),
    domicile:makeFilter('domicile-filter','Domicile','All domiciles',true),
    considered_category:makeFilter('category-filter','Provisional considered category','All categories'),
    service_status:makeFilter('service-filter','Service / non-service','All service statuses')
  };
  const activeYears = () => yearFilter.values().length ? yearFilter.values() : ['2025','2024'];
  const yearLabel = () => activeYears().length === 1 ? activeYears()[0] : '2024-2025';

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => value === null || value === undefined || value === '' ? '—' : typeof value === 'number' ? value.toLocaleString('en-US') : safe(value);
  const roundKey = round => /special/i.test(round) ? 'special-stray' : /stray/i.test(round) ? 'stray' : /round\s*1/i.test(round) ? 'round-1' : /round\s*2/i.test(round) ? 'round-2' : 'round-3';
  const roundOrder = {'round-1':1,'round-2':2,'round-3':3,'stray':4,'special-stray':5};

  function columns() {
    const years = activeYears();
    const has2024 = years.includes('2024'), has2025 = years.includes('2025');
    const commonMerit = [
      ['year','Year'],
      ['round','Round'], ['registration_id','Registration ID'],
      ...(has2024 ? [['list_serial','List no.']] : []),
      ['state_merit_rank','State merit'],
      ...(has2025 ? [['neet_pg_air','NEET-PG AIR']] : []),
      ['domicile','Domicile'], ['filled_category','Filled category'],
      ['considered_category','Provisional considered category'],
      ['service_status','Service / non-service'],
      ...(has2025 ? [['neet_marks','NEET marks'],['bonus_marks','Bonus marks'],['total_marks','Total marks']] : []),
      ['pdf_page','Source PDF']
    ];
    const commonAllot = [
      ['year','Year'],
      ['round','Round'], ['registration_id','Registration ID'],
      ...(has2024 ? [['list_serial','List no.']] : []),
      ['merit_number','Merit no.'],
      ...(has2025 ? [['neet_pg_air','NEET-PG AIR']] : []),
      ['college','Allotted college'], ['course','Allotted course'],
      ['seat_type','Allotted seat type'], ['domicile','Domicile'],
      ['considered_category','Provisional considered category'],
      ['service_status','Service / non-service'],
      ...(has2025 ? [['allotment_status','Allotment status']] : []),
      ['pdf_page','Source PDF']
    ];
    return kind === 'merit' ? commonMerit : commonAllot;
  }

  function docFor(row) {
    return state.documents.find(doc => doc.year === row.year && doc.kind === kind && doc.roundKey === roundKey(row.round));
  }

  function sourceLink(row) {
    const doc = docFor(row);
    return doc?.path ? `${doc.path}#page=${row.pdf_page}` : doc?.archiveUrl || '';
  }

  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('year', yearFilter.values().length ? yearFilter.values().join(',') : 'all');
    if (!roundFilter.values().length) url.searchParams.delete('round');
    else url.searchParams.set('round', roundFilter.values().join(','));
    for (const [key,filter] of Object.entries(filters)) {
      url.searchParams.delete(key);
      if (filter) filter.values().forEach(value => url.searchParams.append(key,value));
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function updateSelects(preferredRounds = [], preferredFilters = {}) {
    const years = activeYears().map(Number);
    const docs = state.documents.filter(doc => years.includes(doc.year) && doc.kind === kind).sort((a,b) => a.order - b.order);
    const labels = new Map(docs.map(doc => [doc.roundKey, doc.round.replace(' — revised eligible list', '')]));
    roundFilter.setOptions([...labels.keys()], {labels:Object.fromEntries(labels),preserve:false,sort:false});
    roundFilter.setSelected(preferredRounds);
    const rows = state.rows;
    for (const [key,filter] of Object.entries(filters)) if (filter) {
      filter.setOptions(rows.map(row => row[key]), {preserve:false});
      filter.setSelected(preferredFilters[key] || []);
    }
    for (const control of [ranges.minAir, ranges.maxAir]) {
      control.disabled = !years.includes(2025);
      if (!years.includes(2025)) control.value = '';
    }
    hintEl.textContent = years.length === 2
      ? 'Showing both exam years. The 2024 records have no published AIR; compare ranks within each year and round.'
      : years[0] === 2024
      ? (kind === 'merit' ? '2024 has state merit only; AIR is not in these PDFs.' : '2024 Round 1 uses combined merit; later rounds use state merit after weightage. AIR is not shown.')
      : (kind === 'merit' ? '2025 shows both state merit and NEET-PG AIR.' : '2025 AIR comes from the matching round-specific merit list; Round 3 allotment coverage is incomplete.');
    updateUrl();
  }

  function renderSources() {
    const years = activeYears().map(Number);
    const docs = state.documents.filter(doc => years.includes(doc.year) && doc.kind === kind).sort((a,b) => b.year - a.year || a.order - b.order);
    sourceEl.innerHTML = docs.map(doc => `<article class="source-item">
      <div><h3>${doc.year} · ${safe(doc.round)}</h3><p>${safe(doc.date)} · ${doc.pages ? fmt(doc.pages) + ' PDF pages' : 'PDF not locally verified'}${doc.entries ? ' · ' + fmt(doc.entries) + ' source rows' : ''}</p><p class="source-note">${safe(doc.note)}</p></div>
      <div class="source-actions">${doc.path ? `<button type="button" class="button outline" data-preview="${safe(doc.path)}" data-title="${safe(doc.year + ' · ' + doc.round)}">Preview PDF</button><a href="${safe(doc.path)}" target="_blank" rel="noopener" class="button outline">Open PDF ↗</a>` : `<a href="${safe(doc.archiveUrl)}" target="_blank" rel="noopener noreferrer" class="button outline">Archived source ↗</a>`}<details><summary>Provenance</summary><p><a href="${safe(doc.archiveUrl || doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">${doc.archiveUrl ? 'Archive copy' : 'Public source copy'} ↗</a></p>${doc.sha256 ? `<p>SHA-256: <code>${safe(doc.sha256)}</code></p>` : '<p>Complete local copy not verified.</p>'}</details></div>
    </article>`).join('');
  }

  function buildHead() {
    headEl.innerHTML = '<tr>' + columns().map(([key,label]) => {
      if (key === 'pdf_page') return `<th scope="col">${safe(label)}</th>`;
      const aria = state.sortKey === key ? (state.direction === 1 ? 'ascending' : 'descending') : 'none';
      const arrow = state.sortKey === key ? (state.direction === 1 ? ' ↑' : ' ↓') : '';
      return `<th scope="col" aria-sort="${aria}"><button class="sort-button" type="button" data-sort="${key}">${safe(label)}${arrow}</button></th>`;
    }).join('') + '</tr>';
  }

  function appendRows() {
    if (state.rendered >= state.filtered.length) return;
    const more = state.filtered.slice(state.rendered, state.rendered + 120);
    const markup = more.map(row => `<tr>${columns().map(([key]) => {
      if (key === 'pdf_page') {
        const url = sourceLink(row);
        return `<td><a href="${safe(url)}" target="_blank" rel="noopener" aria-label="Open source PDF page ${row.pdf_page}">p. ${fmt(row.pdf_page)} ↗</a></td>`;
      }
      const numeric = ['list_serial','state_merit_rank','merit_number','neet_pg_air','neet_marks','bonus_marks','total_marks'].includes(key);
      return `<td class="${numeric ? 'numeric' : ''}${key === 'college' || key === 'course' ? ' descriptive' : ''}">${fmt(row[key])}</td>`;
    }).join('')}</tr>`).join('');
    bodyEl.insertAdjacentHTML('beforeend', markup);
    state.rendered += more.length;
  }

  function applyFilters() {
    const q = searchEl.value.trim().toLocaleLowerCase();
    const rankKey = kind === 'merit' ? 'state_merit_rank' : 'merit_number';
    const minRank = ranges.minRank.value ? Number(ranges.minRank.value) : null;
    const maxRank = ranges.maxRank.value ? Number(ranges.maxRank.value) : null;
    const minAir = ranges.minAir.value ? Number(ranges.minAir.value) : null;
    const maxAir = ranges.maxAir.value ? Number(ranges.maxAir.value) : null;
    state.filtered = state.rows.filter(row => {
      if (!roundFilter.matches(roundKey(row.round))) return false;
      if (q && ![row.registration_id,row.college,row.course,row.domicile,row.considered_category,row.service_status,row.seat_type].filter(Boolean).some(v => String(v).toLocaleLowerCase().includes(q))) return false;
      if (Object.entries(filters).some(([key,filter]) => filter && !filter.matches(row[key]))) return false;
      if (minRank !== null && (row[rankKey] === null || row[rankKey] < minRank)) return false;
      if (maxRank !== null && (row[rankKey] === null || row[rankKey] > maxRank)) return false;
      if (minAir !== null && (row.neet_pg_air === null || row.neet_pg_air < minAir)) return false;
      if (maxAir !== null && (row.neet_pg_air === null || row.neet_pg_air > maxAir)) return false;
      return true;
    });
    if (state.sortKey) {
      const key = state.sortKey;
      const factor = state.direction;
      state.filtered.sort((a,b) => {
        const va = a[key], vb = b[key];
        if (va === null || va === undefined || va === '') return vb === null || vb === undefined || vb === '' ? 0 : 1;
        if (vb === null || vb === undefined || vb === '') return -1;
        const value = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, {numeric:true});
        return factor * value;
      });
    } else {
      state.filtered.sort((a,b) => b.year - a.year || roundOrder[roundKey(a.round)] - roundOrder[roundKey(b.round)] || (a[rankKey] ?? 99999999) - (b[rankKey] ?? 99999999));
    }
    state.rendered = 0;
    bodyEl.innerHTML = '';
    buildHead();
    if (!state.filtered.length) bodyEl.innerHTML = `<tr><td colspan="${columns().length}" class="empty-cell">No records match these filters. Try another round or clear a filter.</td></tr>`;
    else appendRows();
    countEl.textContent = `${state.filtered.length.toLocaleString()} of ${state.rows.length.toLocaleString()} records`;
    byId('download-csv').disabled = !state.filtered.length;
    updateUrl();
  }

  function exportCsv() {
    const keys = columns().map(([key]) => key).filter(key => key !== 'pdf_page').concat(['pdf_page','source_pdf_url']);
    const escapeCsv = value => {
      let cell = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(cell)) cell = "'" + cell;
      return `"${cell.replaceAll('"','""')}"`;
    };
    const lines = [keys.map(escapeCsv).join(',')];
    for (const row of state.filtered) {
      lines.push(keys.map(key => escapeCsv(key === 'source_pdf_url' ? new URL(sourceLink(row), location.href).href : row[key])).join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {type:'text/csv;charset=utf-8'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rajasthan-neet-pg-${yearLabel()}-${kind}-filtered.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function loadYears(preferredRounds = [], preferredFilters = {}) {
    const token = ++state.token;
    countEl.textContent = 'Loading records…';
    bodyEl.innerHTML = '';
    try {
      const years = activeYears().sort((a,b) => Number(b) - Number(a));
      await Promise.all(years.map(async year => {
        const key = `${year}-${kind}`;
        if (!cache.has(key)) {
          const response = await fetch(`data/${key}.json`);
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${key}`);
          cache.set(key, await response.json());
        }
      }));
      if (token !== state.token) return;
      state.rows = years.flatMap(year => cache.get(`${year}-${kind}`));
      state.sortKey = '';
      state.direction = 1;
      updateSelects(preferredRounds, preferredFilters);
      renderSources();
      applyFilters();
    } catch (error) {
      countEl.textContent = 'Records unavailable';
      bodyEl.innerHTML = `<tr><td class="empty-cell">Could not load the table. Please refresh, or download the <a href="data/Rajasthan-NEET-PG-2024-2025-filterable.xlsx">Excel workbook</a>.</td></tr>`;
      console.error('Unable to load records', error);
    }
  }

  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) appendRows(); }, {rootMargin:'300px'});
  observer.observe(byId('scroll-sentinel'));
  searchEl.addEventListener('input', applyFilters);
  for (const control of Object.values(ranges)) control.addEventListener('input', applyFilters);
  headEl.addEventListener('click', event => {
    const button = event.target.closest('[data-sort]');
    if (!button) return;
    if (state.sortKey === button.dataset.sort) state.direction *= -1;
    else { state.sortKey = button.dataset.sort; state.direction = 1; }
    applyFilters();
  });
  byId('reset-filters').addEventListener('click', () => {
    roundFilter.clear(false); searchEl.value = '';
    Object.values(filters).filter(Boolean).forEach(filter => filter.clear(false));
    Object.values(ranges).forEach(control => { control.value = ''; });
    applyFilters();
  });
  byId('download-csv').addEventListener('click', exportCsv);
  sourceEl.addEventListener('click', event => {
    const button = event.target.closest('[data-preview]');
    if (!button) return;
    frame.src = button.dataset.preview;
    byId('dialog-title').textContent = button.dataset.title;
    byId('dialog-open').href = button.dataset.preview;
    dialog.showModal();
  });
  byId('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => frame.removeAttribute('src'));

  try {
    const response = await fetch('data/documents.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.documents = (await response.json()).documents;
    const savedSelections = Object.fromEntries(Object.keys(filters).map(key => [key,pageParams.getAll(key)]));
    await loadYears(requestedRounds,savedSelections);
  } catch (error) {
    countEl.textContent = 'Source register unavailable';
    console.error('Unable to load source register', error);
  }
})();
