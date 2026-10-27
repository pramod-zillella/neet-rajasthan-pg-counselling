(async function () {
  const byId = id => document.getElementById(id);
  const yearEl = byId('year-filter'), roundEl = byId('round-filter'), searchEl = byId('search-filter');
  const countEl = byId('result-count'), hintEl = byId('table-hint');
  const headEl = byId('table-head'), bodyEl = byId('table-body'), sourceEl = byId('source-list');
  const dialog = byId('pdf-dialog'), frame = byId('pdf-frame');
  const controls = {institution:byId('college-filter'), branch:byId('branch-filter'),
    route:byId('route-filter'), institution_type:byId('type-filter'), seat_type:byId('seat-filter')};
  const minSeats = byId('min-seats'), maxSeats = byId('max-seats'), showZero = byId('show-zero');
  const cache = new Map();
  const state = {docs:[],rows:[],filtered:[],rendered:0,sortKey:'',direction:1,token:0};
  const params = new URLSearchParams(location.search);
  if (['2024','2025'].includes(params.get('year'))) yearEl.value = params.get('year');
  const requestedRound = params.get('round');
  const order = {'round-1':1,'round-2':2,'round-3':3,'stray':4,'special-stray':5};
  const columns = [['round','Round'],['route','Route'],['institution','College / centre'],
    ['branch','Course / branch'],['institution_type','Institution type'],['seat_type','Seat type'],
    ['source_seat_label','Printed label'],['seats','Seats'],['measure','Measure'],
    ['matrix_date','Matrix date'],['pdf_page','Source PDF']];
  const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = value => typeof value === 'number' ? value.toLocaleString('en-US') : safe(value);
  const docFor = row => state.docs.find(doc => doc.sourceId === row.source_id);
  const sourceLink = row => `${docFor(row).path}#page=${row.pdf_page}`;
  const roundKey = label => /special/i.test(label) ? 'special-stray' : /stray/i.test(label) ? 'stray' : /round\s*1/i.test(label) ? 'round-1' : /round\s*2/i.test(label) ? 'round-2' : 'round-3';
  const institutionAlias = name => name.startsWith('Mahatma Gandhi Medical College') ? 'MGMC' : name.startsWith('Jaipur National University') ? 'JNU' : '';

  function setOptions(el, values, allLabel) {
    const selected = el.value;
    const options = [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    el.innerHTML = `<option value="all">${safe(allLabel)}</option>` + options.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');
    el.value = options.includes(selected) ? selected : 'all';
  }
  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('year',yearEl.value);
    if (roundEl.value === 'all') url.searchParams.delete('round');
    else url.searchParams.set('round',roundEl.value);
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function renderSources() {
    const docs = state.docs.filter(d=>d.year===Number(yearEl.value)).sort((a,b)=>order[a.roundKey]-order[b.roundKey]||a.routeGroup.localeCompare(b.routeGroup));
    sourceEl.innerHTML = docs.map(doc=>`<article class="source-item"><div><h3>${safe(doc.round)} · ${safe(doc.routeGroup)}</h3>
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
      if (roundEl.value!=='all' && roundKey(row.round)!==roundEl.value) return false;
      if (!showZero.checked && row.seats===0) return false;
      if (low!==null && row.seats<low || high!==null && row.seats>high) return false;
      if (query && ![row.institution,row.branch,row.route,row.seat_type,institutionAlias(row.institution)].some(v=>v.toLocaleLowerCase().includes(query))) return false;
      if (Object.entries(controls).some(([key,el])=>el.value!=='all'&&row[key]!==el.value)) return false;
      return true;
    });
    if (state.sortKey) {
      const key=state.sortKey, factor=state.direction;
      state.filtered.sort((a,b)=>factor*(key==='seats'?a.seats-b.seats:String(a[key]).localeCompare(String(b[key]),undefined,{numeric:true})));
    } else {
      state.filtered.sort((a,b)=>order[roundKey(a.round)]-order[roundKey(b.round)]||a.institution.localeCompare(b.institution)||a.branch.localeCompare(b.branch)||a.seat_type.localeCompare(b.seat_type));
    }
    state.rendered=0; bodyEl.innerHTML=''; renderHead();
    if (state.filtered.length) appendRows();
    else bodyEl.innerHTML=`<tr><td colspan="${columns.length}" class="empty-cell">No seats match these filters. Try another round or show zero-seat rows.</td></tr>`;
    const total=state.docs.filter(doc=>doc.year===Number(yearEl.value)).reduce((sum,doc)=>sum+doc.rows,0);
    const count=`${state.filtered.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} matrix cells`;
    countEl.textContent=roundEl.value==='all'?count:`${count} · ${state.filtered.reduce((total,row)=>total+row.seats,0).toLocaleString('en-US')} seats`;
    hintEl.textContent=roundEl.value==='all'?'All rounds are separate snapshots; do not add their seats together.':'The seat total reflects this round and your current filters.';
    byId('download-csv').disabled=!state.filtered.length;
    updateUrl();
  }
  function exportCsv() {
    const fields=[...columns.map(([key])=>key).filter(key=>key!=='pdf_page'),'pdf_page','source_pdf_url'];
    const cell=value=>{let v=String(value??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
    const lines=[fields.map(cell).join(',')];
    for(const row of state.filtered) lines.push(fields.map(key=>cell(key==='source_pdf_url'?new URL(sourceLink(row),location.href).href:row[key])).join(','));
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`rajasthan-neet-pg-${yearEl.value}-seat-matrix-filtered.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function loadYear(preferredRound='round-1') {
    const token=++state.token, year=yearEl.value;countEl.textContent='Loading records…';bodyEl.innerHTML='';
    try {
      const key=`${year}-matrix${showZero.checked?'':'-available'}`;
      if(!cache.has(key)) {const response=await fetch(`data/${key}.json`);if(!response.ok)throw new Error(`HTTP ${response.status}`);cache.set(key,await response.json());}
      if(token!==state.token)return;
      state.rows=cache.get(key);state.sortKey='';state.direction=1;
      const docs=state.docs.filter(doc=>doc.year===Number(year));
      const rounds=[...new Map(docs.map(doc=>[doc.roundKey,doc.round])).entries()].sort((a,b)=>order[a[0]]-order[b[0]]);
      roundEl.innerHTML='<option value="all">All rounds (separate snapshots)</option>'+rounds.map(([key,label])=>`<option value="${safe(key)}">${safe(label)}</option>`).join('');
      roundEl.value=rounds.some(([key])=>key===preferredRound)?preferredRound:'round-1';
      for(const [key,label] of Object.entries({institution:'All colleges',branch:'All branches',route:'All routes',institution_type:'All institution types',seat_type:'All seat types'})) setOptions(controls[key],state.rows.map(row=>row[key]),label);
      renderSources();applyFilters();
    } catch(error) {countEl.textContent='Matrix unavailable';bodyEl.innerHTML='<tr><td class="empty-cell">Could not load the matrix. Please refresh or download the Excel workbook.</td></tr>';console.error('Unable to load matrix',error);}
  }
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))appendRows();},{rootMargin:'300px'});
  observer.observe(byId('scroll-sentinel'));
  yearEl.addEventListener('change',()=>{searchEl.value='';minSeats.value='';maxSeats.value='';showZero.checked=false;for(const el of Object.values(controls))el.value='all';loadYear();});
  roundEl.addEventListener('change',applyFilters);searchEl.addEventListener('input',applyFilters);
  for(const el of [...Object.values(controls),minSeats,maxSeats])el.addEventListener('input',applyFilters);
  showZero.addEventListener('change',()=>loadYear(roundEl.value));
  headEl.addEventListener('click',event=>{const button=event.target.closest('[data-sort]');if(!button)return;if(state.sortKey===button.dataset.sort)state.direction*=-1;else{state.sortKey=button.dataset.sort;state.direction=1;}applyFilters();});
  byId('reset-filters').addEventListener('click',()=>{roundEl.value='round-1';searchEl.value='';minSeats.value='';maxSeats.value='';showZero.checked=false;for(const el of Object.values(controls))el.value='all';applyFilters();});
  byId('download-csv').addEventListener('click',exportCsv);
  sourceEl.addEventListener('click',event=>{const button=event.target.closest('[data-preview]');if(!button)return;frame.src=button.dataset.preview;byId('dialog-title').textContent=button.dataset.title;byId('dialog-open').href=button.dataset.preview;dialog.showModal();});
  byId('close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>frame.removeAttribute('src'));
  try {const response=await fetch('data/matrix-documents.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);state.docs=(await response.json()).documents;await loadYear(requestedRound||'round-1');}
  catch(error){countEl.textContent='Source register unavailable';console.error('Unable to load matrix sources',error);}
})();
