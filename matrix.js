(async function () {
  const byId = id => document.getElementById(id);
  const {MultiFilter} = window.RajasthanFilters;
  const searchEl = byId('search-filter');
  const countEl = byId('result-count'), hintEl = byId('table-hint');
  const headEl = byId('table-head'), bodyEl = byId('table-body'), sourceEl = byId('source-list');
  const dialog = byId('pdf-dialog'), frame = byId('pdf-frame');
  const minSeats = byId('min-seats'), maxSeats = byId('max-seats'), showZero = byId('show-zero');
  const cache = new Map();
  const state = {docs:[],rows:[],filtered:[],rendered:0,sortKey:'',direction:1,token:0};
  const params = new URLSearchParams(location.search);
  const requestedYears = (params.get('year') || '2025').split(',').filter(year => ['2024','2025'].includes(year));
  const requestedRounds = (params.get('round') || 'round-1').split(',').filter(Boolean);
  const yearFilter = new MultiFilter('year-filter', {label:'Exam year',allLabel:'All years',onChange:() => {
    searchEl.value='';minSeats.value='';maxSeats.value='';showZero.checked=false;
    Object.values(controls).forEach(filter=>filter.clear(false));
    loadYears();
  }});
  yearFilter.setOptions(['2024','2025']);
  yearFilter.setSelected(requestedYears);
  const roundFilter = new MultiFilter('round-filter',{label:'Round',allLabel:'All rounds (separate snapshots)',onChange:applyFilters});
  const makeFilter = (id,label,allLabel) => new MultiFilter(id,{label,allLabel,onChange:applyFilters});
  const controls = {
    institution:makeFilter('college-filter','College / centre','All colleges'),
    branch:makeFilter('branch-filter','Course / branch','All branches'),
    route:makeFilter('route-filter','Route','All routes'),
    institution_type:makeFilter('type-filter','Institution type','All institution types'),
    seat_type:makeFilter('seat-filter','Seat type','All seat types')
  };
  const activeYears = () => yearFilter.values().length ? yearFilter.values() : ['2025','2024'];
  const yearLabel = () => activeYears().length === 1 ? activeYears()[0] : '2024-2025';
  const order = {'round-1':1,'round-2':2,'round-3':3,'stray':4,'special-stray':5};
  const columns = [['year','Year'],['round','Round'],['route','Route'],['institution','College / centre'],
    ['branch','Course / branch'],['institution_type','Institution type'],['seat_type','Seat type'],
    ['source_seat_label','Printed label'],['seats','Seats'],['measure','Measure'],
    ['matrix_date','Matrix date'],['pdf_page','Source PDF']];
  const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = value => typeof value === 'number' ? value.toLocaleString('en-US') : safe(value);
  const docFor = row => state.docs.find(doc => doc.sourceId === row.source_id);
  const sourceLink = row => `${docFor(row).path}#page=${row.pdf_page}`;
  const roundKey = label => /special/i.test(label) ? 'special-stray' : /stray/i.test(label) ? 'stray' : /round\s*1/i.test(label) ? 'round-1' : /round\s*2/i.test(label) ? 'round-2' : 'round-3';
  const institutionAlias = name => name.startsWith('Mahatma Gandhi Medical College') ? 'MGMC' : name.startsWith('Jaipur National University') ? 'JNU' : '';

  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('year',yearFilter.values().length?yearFilter.values().join(','):'all');
    if (!roundFilter.values().length) url.searchParams.delete('round');
    else url.searchParams.set('round',roundFilter.values().join(','));
    for(const [key,filter] of Object.entries(controls)) {
      url.searchParams.delete(key);
      filter.values().forEach(value=>url.searchParams.append(key,value));
    }
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function renderSources() {
    const years=activeYears().map(Number);
    const docs = state.docs.filter(d=>years.includes(d.year)).sort((a,b)=>b.year-a.year||order[a.roundKey]-order[b.roundKey]||a.routeGroup.localeCompare(b.routeGroup));
    sourceEl.innerHTML = docs.map(doc=>`<article class="source-item"><div><h3>${doc.year} · ${safe(doc.round)} · ${safe(doc.routeGroup)}</h3>
      <p>${safe(doc.date)} · ${doc.pages} PDF page${doc.pages===1?'':'s'} · ${doc.rows.toLocaleString('en-US')} matrix cells</p>
      <p class="source-note">${doc.roundKey==='round-1'?'Initially offered seats':'Vacancy snapshot'} · ${doc.seats.toLocaleString('en-US')} seats in this document</p></div>
      <div class="source-actions"><button type="button" class="button outline" data-preview="${safe(doc.path)}" data-title="${safe(doc.year+' · '+doc.round+' · '+doc.routeGroup)}">Preview PDF</button>
      <a href="${safe(doc.path)}" target="_blank" rel="noopener" class="button outline">Open PDF ↗</a>
      <details><summary>Provenance</summary><p><a href="${safe(doc.archiveUrl||doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">${doc.archiveUrl?'Archived Board PDF':'Public source copy'} ↗</a></p><p>SHA-256: <code>${safe(doc.sha256)}</code></p></details></div></article>`).join('');
  }
  function renderHead() {
    headEl.innerHTML = '<tr>'+columns.map(([key,label])=>{
      if (key==='pdf_page') return `<th scope="col">${safe(label)}</th>`;
      const direction = state.sortKey===key ? (state.direction===1?'ascending':'descending') : 'none';
      const arrow = state.sortKey===key ? (state.direction===1?' ↑':' ↓') : '';
      return `<th scope="col" aria-sort="${direction}"><button type="button" class="sort-button" data-sort="${key}">${safe(label)}${arrow}</button></th>`;
    }).join('')+'</tr>';
  }
  function appendRows() {
    if (state.rendered>=state.filtered.length) return;
    const batch=state.filtered.slice(state.rendered,state.rendered+120);
    bodyEl.insertAdjacentHTML('beforeend',batch.map(row=>'<tr>'+columns.map(([key])=>{
      if (key==='pdf_page') return `<td><a href="${safe(sourceLink(row))}" target="_blank" rel="noopener" aria-label="Open source PDF page ${row.pdf_page}">p. ${row.pdf_page} ↗</a></td>`;
      const cls=key==='seats'?'numeric':key==='institution'||key==='branch'?'descriptive':'';
      return `<td class="${cls}">${format(row[key])}</td>`;
    }).join('')+'</tr>').join(''));
    state.rendered+=batch.length;
  }
  function applyFilters() {
    const query=searchEl.value.trim().toLocaleLowerCase();
    const low=minSeats.value===''?null:Number(minSeats.value), high=maxSeats.value===''?null:Number(maxSeats.value);
    state.filtered=state.rows.filter(row=>{
      if (!roundFilter.matches(roundKey(row.round))) return false;
      if (!showZero.checked && row.seats===0) return false;
      if (low!==null && row.seats<low || high!==null && row.seats>high) return false;
      if (query && ![row.institution,row.branch,row.route,row.seat_type,institutionAlias(row.institution)].some(v=>v.toLocaleLowerCase().includes(query))) return false;
      if (Object.entries(controls).some(([key,filter])=>!filter.matches(row[key]))) return false;
      return true;
    });
    if (state.sortKey) {
      const key=state.sortKey, factor=state.direction;
      state.filtered.sort((a,b)=>factor*(key==='seats'?a.seats-b.seats:String(a[key]).localeCompare(String(b[key]),undefined,{numeric:true})));
    } else {
      state.filtered.sort((a,b)=>b.year-a.year||order[roundKey(a.round)]-order[roundKey(b.round)]||a.institution.localeCompare(b.institution)||a.branch.localeCompare(b.branch)||a.seat_type.localeCompare(b.seat_type));
    }
    state.rendered=0; bodyEl.innerHTML=''; renderHead();
    if (state.filtered.length) appendRows();
    else bodyEl.innerHTML=`<tr><td colspan="${columns.length}" class="empty-cell">No seats match these filters. Try another round or show zero-seat rows.</td></tr>`;
    const total=state.rows.length;
    const count=`${state.filtered.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} matrix cells`;
    const oneSnapshot=activeYears().length===1&&roundFilter.values().length===1;
    countEl.textContent=!oneSnapshot?count:`${count} · ${state.filtered.reduce((total,row)=>total+row.seats,0).toLocaleString('en-US')} seats`;
    hintEl.textContent=oneSnapshot?'The seat total reflects this year, round and your current filters.':'Years and rounds are separate snapshots; do not add their seats together.';
    byId('download-csv').disabled=!state.filtered.length;
    updateUrl();
  }
  function exportCsv() {
    const fields=[...columns.map(([key])=>key).filter(key=>key!=='pdf_page'),'pdf_page','source_pdf_url'];
    const cell=value=>{let v=String(value??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
    const lines=[fields.map(cell).join(',')];
    for(const row of state.filtered) lines.push(fields.map(key=>cell(key==='source_pdf_url'?new URL(sourceLink(row),location.href).href:row[key])).join(','));
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`rajasthan-neet-pg-${yearLabel()}-seat-matrix-filtered.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function loadYears(preferredRounds=['round-1'],preferredFilters={}) {
    const token=++state.token;countEl.textContent='Loading records…';bodyEl.innerHTML='';
    try {
      const years=activeYears().sort((a,b)=>Number(b)-Number(a));
      await Promise.all(years.map(async year=>{
        const key=`${year}-matrix`;
        if(!cache.has(key)) {const response=await fetch(`data/${key}.json`);if(!response.ok)throw new Error(`HTTP ${response.status}`);cache.set(key,await response.json());}
      }));
      if(token!==state.token)return;
      state.rows=years.flatMap(year=>cache.get(`${year}-matrix`));state.sortKey='';state.direction=1;
      const docs=state.docs.filter(doc=>years.includes(String(doc.year)));
      const rounds=[...new Map(docs.map(doc=>[doc.roundKey,doc.round])).entries()].sort((a,b)=>order[a[0]]-order[b[0]]);
      roundFilter.setOptions(rounds.map(([key])=>key),{labels:Object.fromEntries(rounds),preserve:false,sort:false});
      roundFilter.setSelected(preferredRounds);
      for(const [key,filter] of Object.entries(controls)) {
        filter.setOptions(state.rows.map(row=>row[key]),{preserve:false});
        filter.setSelected(preferredFilters[key]||[]);
      }
      renderSources();applyFilters();
    } catch(error) {countEl.textContent='Matrix unavailable';bodyEl.innerHTML='<tr><td class="empty-cell">Could not load the matrix. Please refresh or download the Excel workbook.</td></tr>';console.error('Unable to load matrix',error);}
  }
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))appendRows();},{rootMargin:'300px'});
  observer.observe(byId('scroll-sentinel'));
  searchEl.addEventListener('input',applyFilters);
  for(const el of [minSeats,maxSeats])el.addEventListener('input',applyFilters);
  showZero.addEventListener('change',applyFilters);
  headEl.addEventListener('click',event=>{const button=event.target.closest('[data-sort]');if(!button)return;if(state.sortKey===button.dataset.sort)state.direction*=-1;else{state.sortKey=button.dataset.sort;state.direction=1;}applyFilters();});
  byId('reset-filters').addEventListener('click',()=>{roundFilter.setSelected(['round-1']);searchEl.value='';minSeats.value='';maxSeats.value='';showZero.checked=false;for(const filter of Object.values(controls))filter.clear(false);applyFilters();});
  byId('download-csv').addEventListener('click',exportCsv);
  sourceEl.addEventListener('click',event=>{const button=event.target.closest('[data-preview]');if(!button)return;frame.src=button.dataset.preview;byId('dialog-title').textContent=button.dataset.title;byId('dialog-open').href=button.dataset.preview;dialog.showModal();});
  byId('close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>frame.removeAttribute('src'));
  try {const response=await fetch('data/matrix-documents.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);state.docs=(await response.json()).documents;const savedSelections=Object.fromEntries(Object.keys(controls).map(key=>[key,params.getAll(key)]));await loadYears(requestedRounds,savedSelections);}
  catch(error){countEl.textContent='Source register unavailable';console.error('Unable to load matrix sources',error);}
})();
