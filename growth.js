(async function () {
  const byId = id => document.getElementById(id);
  const {MultiFilter} = window.RajasthanFilters;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {rows:[],filtered:[],rendered:0,sortKey:'institution',direction:1};
  const params = new URLSearchParams(location.search);
  const group = new MultiFilter('group-filter',{label:'Institution group',allLabel:'All groups',onChange:applyFilters});
  const college = new MultiFilter('college-filter',{label:'College',allLabel:'All colleges',onChange:applyFilters});
  const branch = new MultiFilter('branch-filter',{label:'Branch',allLabel:'All branches',onChange:applyFilters});
  const search = byId('search-filter'), change = byId('change-filter'), view = byId('view-filter');
  const head = byId('table-head'), body = byId('table-body');
  const columns = [
    ['institution','College'],['group','Group'],['branch','Branch'],
    ['seats_2024','2024 seats'],['seats_2025','2025 seats'],['seats_2026','2026 seats'],
    ['change_2024_2025','2024 → 2025'],['change_2025_2026','2025 → 2026'],['college_status_2025','College status']
  ];
  function updateUrl() {
    const url = new URL(location.href);
    for (const [key,filter] of [['group',group],['college',college],['branch',branch]]) {
      url.searchParams.delete(key);
      if (key==='group' && !filter.values().length) url.searchParams.set('group','all');
      else filter.values().forEach(value=>url.searchParams.append(key,value));
    }
    if (change.value==='all') url.searchParams.delete('change');
    else url.searchParams.set('change',change.value);
    if (view.value==='college') url.searchParams.delete('view');
    else url.searchParams.set('view',view.value);
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function matchesChange(row) {
    switch (change.value) {
      case 'increase-24': return row.change_2024_2025>0;
      case 'decrease-24': return row.change_2024_2025<0;
      case 'increase-25': return row.change_2025_2026>0;
      case 'decrease-25': return row.change_2025_2026<0;
      case 'new-25': return row.college_status_2025==='New college' && row.seats_2025>0;
      default: return true;
    }
  }
  function renderHead() {
    head.innerHTML = '<tr>'+columns.map(([key,label])=>{
      const direction = state.sortKey===key ? (state.direction===1?'ascending':'descending') : 'none';
      const arrow = state.sortKey===key ? (state.direction===1?' ↑':' ↓') : '';
      return `<th scope="col" aria-sort="${direction}"><button type="button" class="sort-button" data-sort="${key}">${safe(label)}${arrow}</button></th>`;
    }).join('')+'</tr>';
  }
  function numberCell(row,key) {
    const value = row[key];
    if (value===null) return '<td class="numeric muted" title="2026 private matrix not verified">—</td>';
    const formatted = (key.startsWith('change_') && value>0?'+':'')+value.toLocaleString('en-US');
    const source = key==='seats_2024'?row.source_2024:key==='seats_2025'?row.source_2025:key==='seats_2026'?row.source_2026:'';
    const content = source ? `<a href="${safe(source.replace('https://pramod-zillella.github.io/neet-rajasthan-pg-counselling/',''))}" target="_blank" rel="noopener" aria-label="${safe(value)} seats; open source PDF">${formatted}</a>` : formatted;
    return `<td class="numeric ${key.startsWith('change_')?(value>0?'growth-up':value<0?'growth-down':''):''}">${content}</td>`;
  }
  function appendRows() {
    if (state.rendered>=state.filtered.length) return;
    const batch=state.filtered.slice(state.rendered,state.rendered+100);
    body.insertAdjacentHTML('beforeend',batch.map(row=>'<tr>'+columns.map(([key])=>key.startsWith('seats_')||key.startsWith('change_')?numberCell(row,key):`<td class="${key==='institution'||key==='branch'?'descriptive':''}">${safe(row[key])}</td>`).join('')+'</tr>').join(''));
    state.rendered+=batch.length;
  }
  function applyFilters() {
    const query=search.value.trim().toLocaleLowerCase();
    const matches=state.rows.filter(row=>group.matches(row.group)&&college.matches(row.institution)&&branch.matches(row.branch)&&(!query||row.institution.toLocaleLowerCase().includes(query)||row.branch.toLocaleLowerCase().includes(query)));
    if (view.value==='college') {
      const grouped=new Map();
      for (const row of matches) {
        let total=grouped.get(row.institution);
        if (!total) {
          total={...row,branch:branch.values().length||query?'Matching branches':'All branches',seats_2024:0,seats_2025:0,seats_2026:row.seats_2026===null?null:0,change_2024_2025:0,change_2025_2026:row.change_2025_2026===null?null:0};
          grouped.set(row.institution,total);
        }
        total.seats_2024+=row.seats_2024;
        total.seats_2025+=row.seats_2025;
        total.change_2024_2025+=row.change_2024_2025;
        if (total.seats_2026!==null) total.seats_2026+=row.seats_2026;
        if (total.change_2025_2026!==null) total.change_2025_2026+=row.change_2025_2026;
        if (!total.source_2024 && row.source_2024) total.source_2024=row.source_2024;
      }
      state.filtered=[...grouped.values()].filter(matchesChange);
    } else state.filtered=matches.filter(matchesChange);
    const key=state.sortKey, factor=state.direction;
    state.filtered.sort((a,b)=>{
      const x=a[key], y=b[key];
      const value=(typeof x==='number'||typeof y==='number') ? ((x??-Infinity)-(y??-Infinity)) : String(x??'').localeCompare(String(y??''),undefined,{numeric:true});
      return factor*value || a.institution.localeCompare(b.institution) || a.branch.localeCompare(b.branch);
    });
    state.rendered=0;body.innerHTML='';renderHead();
    if (state.filtered.length) appendRows();
    else body.innerHTML=`<tr><td colspan="${columns.length}" class="empty-cell">No college and branch rows match these filters.</td></tr>`;
    byId('result-count').textContent=view.value==='college'?`${state.filtered.length.toLocaleString('en-US')} college totals`:`${state.filtered.length.toLocaleString('en-US')} of ${state.rows.length.toLocaleString('en-US')} college–branch rows`;
    byId('download-csv').disabled=!state.filtered.length;
    updateUrl();
  }
  function exportCsv() {
    const fields=['institution','group','branch','seats_2024','seats_2025','seats_2026','change_2024_2025','change_2025_2026','college_status_2025','source_2024','source_2025','source_2026'];
    const cell=value=>{let v=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
    const lines=[fields.map(cell).join(',')];
    for(const row of state.filtered) lines.push(fields.map(key=>cell(row[key])).join(','));
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='rajasthan-round-1-seat-growth-filtered.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))appendRows();},{rootMargin:'300px'});
  observer.observe(byId('scroll-sentinel'));
  head.addEventListener('click',event=>{const button=event.target.closest('[data-sort]');if(!button)return;if(state.sortKey===button.dataset.sort)state.direction*=-1;else{state.sortKey=button.dataset.sort;state.direction=1;}applyFilters();});
  search.addEventListener('input',applyFilters);
  change.addEventListener('change',applyFilters);
  view.addEventListener('change',applyFilters);
  byId('reset-filters').addEventListener('click',()=>{group.clear(false);college.clear(false);branch.clear(false);search.value='';change.value='all';view.value='college';applyFilters();});
  byId('download-csv').addEventListener('click',exportCsv);
  try {
    const response=await fetch('data/seat-growth-2024-2026.json');
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    state.rows=(await response.json()).rows;
    group.setOptions(state.rows.map(row=>row.group));
    college.setOptions(state.rows.map(row=>row.institution));
    branch.setOptions(state.rows.map(row=>row.branch));
    group.setSelected(params.has('group')?params.getAll('group'):['Government / RUHS / Society']);
    college.setSelected(params.getAll('college'));
    branch.setSelected(params.getAll('branch'));
    if([...change.options].some(option=>option.value===params.get('change')))change.value=params.get('change');
    if(params.get('view')==='detail')view.value='detail';
    applyFilters();
  } catch(error) {
    byId('result-count').textContent='Comparison unavailable';
    body.innerHTML='<tr><td class="empty-cell">Could not load the comparison. Please refresh or download the Excel workbook.</td></tr>';
    console.error('Unable to load seat growth',error);
  }
})();
