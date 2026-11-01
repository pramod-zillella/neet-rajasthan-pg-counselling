(async function () {
  const byId = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => value === null || value === undefined || value === '' ? '—' : typeof value === 'number' ? value.toLocaleString('en-IN') : safe(value);
  const params = new URLSearchParams(location.search);
  const state = {all:[], filtered:[], rendered:0, sortKey:'state_merit_rank', direction:1};
  const columns = [
    ['state_merit_rank','State rank'],['neet_pg_air','NEET-PG AIR'],['registration_id','Registration ID'],
    ['domicile','Domicile'],['service_status','Service'],
    ['mcc_college','MCC allotted college'],['mcc_course','MCC allotted course'],['mcc_quota','MCC quota'],
    ['mcc_allotted_category','MCC seat category'],['state_college','Rajasthan allotted college'],
    ['state_course','Rajasthan allotted course'],['state_seat_type','Rajasthan seat type'],
    ['merit_pdf_page','Merit source'],['mcc_pdf_page','MCC source'],['state_pdf_page','Rajasthan source']
  ];
  const {MultiFilter} = window.RajasthanFilters;
  const filterSpecs = [
    ['domicile','domicile-filter','Domicile','All domiciles',true],
    ['mcc_match','mcc-match-filter','MCC Round 1 result','All MCC statuses',false],
    ['service_status','service-filter','Service / non-service','All service statuses',false],
    ['mcc_quota','mcc-quota-filter','MCC quota','All MCC quotas',false],
    ['mcc_college','mcc-college-filter','MCC college','All MCC colleges',false],
    ['mcc_course','mcc-course-filter','MCC course','All MCC courses',false],
    ['state_match','state-match-filter','Rajasthan Round 1 result','All Rajasthan statuses',false],
    ['state_seat_type','state-type-filter','Rajasthan seat type','All seat types',false]
  ];
  const filters = Object.fromEntries(filterSpecs.map(([key,id,label,allLabel,special]) => [key,new MultiFilter(id,{label,allLabel,special,onChange:applyFilters})]));
  const search = byId('search-filter');
  const minRank = byId('min-rank'), maxRank = byId('max-rank');

  function updateUrl() {
    const url = new URL(location.href);
    for (const [key,filter] of Object.entries(filters)) {
      url.searchParams.delete(key);
      filter.values().forEach(value => url.searchParams.append(key,value));
    }
    history.replaceState(null,'',url.pathname + url.search + url.hash);
  }

  function buildHead() {
    byId('table-head').innerHTML = '<tr>' + columns.map(([key,label]) => {
      if (key.endsWith('_pdf_page')) return `<th scope="col">${safe(label)}</th>`;
      const active = state.sortKey === key;
      return `<th scope="col" aria-sort="${active ? state.direction === 1 ? 'ascending' : 'descending' : 'none'}"><button type="button" class="sort-button" data-sort="${key}">${safe(label)}${active ? state.direction === 1 ? ' ↑' : ' ↓' : ''}</button></th>`;
    }).join('') + '</tr>';
  }

  function sourceCell(row,key) {
    const page = row[key];
    if (!page) return '<td>—</td>';
    const kind = key === 'merit_pdf_page' ? 'merit' : key === 'mcc_pdf_page' ? 'mcc' : 'allotment';
    return `<td><a href="documents/2026/${kind}/round-1.pdf#page=${page}" target="_blank" rel="noopener" aria-label="Open ${kind} source PDF page ${page}">p. ${fmt(page)} ↗</a></td>`;
  }

  function appendRows() {
    if (state.rendered >= state.filtered.length) return;
    const more = state.filtered.slice(state.rendered,state.rendered + 100);
    byId('table-body').insertAdjacentHTML('beforeend',more.map(row => `<tr>${columns.map(([key]) => key.endsWith('_pdf_page') ? sourceCell(row,key) : `<td class="${['state_merit_rank','neet_pg_air'].includes(key) ? 'numeric' : ''}${key.includes('college') || key.includes('course') ? ' descriptive' : ''}">${fmt(row[key])}</td>`).join('')}</tr>`).join(''));
    state.rendered += more.length;
  }

  function applyFilters() {
    const q = search.value.trim().toLocaleLowerCase();
    const lo = minRank.value ? Number(minRank.value) : null;
    const hi = maxRank.value ? Number(maxRank.value) : null;
    state.filtered = state.all.filter(row => {
      if (Object.entries(filters).some(([key,filter]) => !filter.matches(row[key]))) return false;
      if (lo !== null && row.state_merit_rank < lo || hi !== null && row.state_merit_rank > hi) return false;
      return !q || [row.state_merit_rank,row.neet_pg_air,row.registration_id,row.mcc_college,row.mcc_course,row.mcc_quota,row.state_college,row.state_course].filter(value => value !== null && value !== undefined).some(value => String(value).toLocaleLowerCase().includes(q));
    });
    const key = state.sortKey, dir = state.direction;
    state.filtered.sort((a,b) => {
      const av=a[key], bv=b[key];
      if (av === null || av === undefined || av === '') return bv === null || bv === undefined || bv === '' ? 0 : 1;
      if (bv === null || bv === undefined || bv === '') return -1;
      return dir * (typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv),undefined,{numeric:true}));
    });
    state.rendered = 0;
    byId('table-body').innerHTML = '';
    buildHead();
    if (state.filtered.length) appendRows();
    else byId('table-body').innerHTML = `<tr><td colspan="${columns.length}" class="empty-cell">No candidates match these filters. Clear a selection or change the search.</td></tr>`;
    byId('result-count').textContent = `${state.filtered.length.toLocaleString('en-IN')} of ${state.all.length.toLocaleString('en-IN')} candidates`;
    byId('table-hint').textContent = `${state.filtered.filter(row=>row.mcc_college).length.toLocaleString('en-IN')} shown candidates have an MCC Round 1 allotment; ${state.filtered.filter(row=>row.mcc_college && row.state_college).length.toLocaleString('en-IN')} also appear in Rajasthan's indicative allotment.`;
    byId('download-csv').disabled = !state.filtered.length;
    updateUrl();
  }

  function defaults() {
    Object.values(filters).forEach(filter=>filter.clear(false));
    filters.domicile.setSelected(['Rajasthan']);
    filters.mcc_match.setSelected(['MCC Round 1 allotment']);
    search.value = ''; minRank.value = ''; maxRank.value = '';
    applyFilters();
  }

  function exportCsv() {
    const keys = columns.map(([key])=>key).filter(key=>!key.endsWith('_pdf_page'));
    const headers = [...keys,'Merit source PDF','MCC source PDF','Rajasthan source PDF'];
    const escape = value => {
      let cell = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(cell)) cell = "'" + cell;
      return `"${cell.replaceAll('"','""')}"`;
    };
    const source = (kind,page) => page ? new URL(`documents/2026/${kind}/round-1.pdf#page=${page}`,location.href).href : '';
    const lines = [headers.map(escape).join(',')];
    for (const row of state.filtered) lines.push([...keys.map(key=>row[key]),source('merit',row.merit_pdf_page),source('mcc',row.mcc_pdf_page),source('allotment',row.state_pdf_page)].map(escape).join(','));
    const url = URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');link.href=url;link.download='rajasthan-mcc-2026-round-1-filtered.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  search.addEventListener('input',applyFilters);
  [minRank,maxRank].forEach(control=>control.addEventListener('input',applyFilters));
  byId('reset-filters').addEventListener('click',defaults);
  byId('download-csv').addEventListener('click',exportCsv);
  byId('table-head').addEventListener('click',event=>{
    const button=event.target.closest('[data-sort]');if (!button) return;
    if (state.sortKey===button.dataset.sort) state.direction *= -1;
    else {state.sortKey=button.dataset.sort;state.direction=1;}
    applyFilters();
  });
  new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)) appendRows();},{rootMargin:'300px'}).observe(byId('scroll-sentinel'));

  try {
    const response = await fetch('data/2026-cross-counselling.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.all = await response.json();
    if (state.all.length !== 3165) throw new Error('Revised merit row count changed');
    for (const [key,filter] of Object.entries(filters)) filter.setOptions(state.all.map(row=>row[key]),{preserve:false});
    if (location.search) {
      for (const [key,filter] of Object.entries(filters)) filter.setSelected(params.getAll(key));
      applyFilters();
    } else defaults();
  } catch (error) {
    byId('result-count').textContent = 'Records unavailable';
    byId('table-body').innerHTML = '<tr><td class="empty-cell">Could not load the comparison. Refresh the page or download the Excel workbook.</td></tr>';
    console.error('Cross-counselling data unavailable',error);
  }
})();
