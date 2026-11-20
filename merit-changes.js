(async function () {
  const byId=id=>document.getElementById(id), {MultiFilter}=window.RajasthanFilters;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=value=>value===null||value===undefined?'—':typeof value==='number'?value.toLocaleString('en-US'):safe(value);
  const delta=value=>value>0?`+${fmt(value)}`:fmt(value);
  const source=(row,n)=>row?`documents/2026/merit/round-${n}.pdf#page=${row.pdf_page}`:'';
  const params=new URLSearchParams(location.search);
  const defaultChanges=['Added ahead','Absent from Round 2','Moved ahead','Moved below'];
  const columns=[['change','Change'],['neet_pg_air','NEET-PG AIR'],['registration_id','Registration ID'],
    ['r1_rank','R1 state rank'],['r2_rank','R2 state rank'],['rank_change','Rank number change'],
    ['domicile','Domicile'],['service_status','Service status'],['considered_category','Considered category'],['sources','Sources']];
  let rows=[],comparison,filtered=[],rendered=0,sortKey='r2_rank',direction=1;
  const filters={
    change:new MultiFilter('change-filter',{label:'Change',allLabel:'All changes and retained',onChange:applyFilters}),
    domicile:new MultiFilter('domicile-filter',{label:'Domicile',allLabel:'All domiciles',special:true,onChange:applyFilters}),
    service_status:new MultiFilter('service-filter',{label:'Service status',allLabel:'All service statuses',onChange:applyFilters}),
    considered_category:new MultiFilter('category-filter',{label:'Provisional considered category',allLabel:'All categories',onChange:applyFilters})
  };
  byId('air-input').value=params.get('air')||'61347';
  byId('basis-input').value=params.get('basis')==='air'?'air':'state';

  function syncUrl() {
    if(!comparison)return;
    const url=new URL(location.href);url.searchParams.set('air',comparison.air);url.searchParams.set('basis',comparison.basis);
    for(const [key,filter] of Object.entries(filters)){
      url.searchParams.delete(key);filter.values().forEach(value=>url.searchParams.append(key,value));
    }
    // Distinguish an explicitly cleared change selection from the default view.
    url.searchParams.set('filters','1');
    history.replaceState(null,'',url.pathname+url.search);
  }
  function targetCard(target,n){
    return `<article class="position-card"><span class="position-year">Round ${n} · ${n===1?'28 October':'20 November'} 2026</span><strong>${target?`State rank ${fmt(target.state_merit_rank)}`:'AIR not listed'}</strong>${target?`<dl><div><dt>NEET-PG AIR</dt><dd>${fmt(target.neet_pg_air)}</dd></div><div><dt>Domicile / service</dt><dd>${fmt(target.domicile)} · ${fmt(target.service_status)}</dd></div></dl><a href="${source(target,n)}" target="_blank" rel="noopener">Check PDF · page ${target.pdf_page} ↗</a>`:'<p>No state rank inferred. The better-AIR comparison can still use this threshold.</p>'}</article>`;
  }
  function renderSummary(){
    const s=comparison.summary;
    byId('target-cards').innerHTML=comparison.targets.map((r,i)=>targetCard(r,i+1)).join('');
    byId('whole-list-reading').textContent=`Whole lists: ${fmt(s.all_round1)} → ${fmt(s.all_round2)} candidates; ${fmt(s.all_added)} newly listed and ${fmt(s.all_removed)} absent from Round 2. These totals include candidates below the selected position.`;
    const cards=[['Ahead in Round 1',s.round1,'Target excluded'],['Ahead in Round 2',s.round2,'Target excluded'],['Newly listed ahead',s.added,'Absent from the whole Round 1 list'],['No longer listed ahead',s.removed,'Absent from the whole Round 2 list']];
    byId('change-stats').innerHTML=cards.map(([label,value,note])=>`<article class="change-stat"><span>${label}</span><strong>${fmt(value)}</strong><small>${note}</small></article>`).join('');
    byId('change-reading').textContent=`${comparison.basis==='state'?'Earlier state-merit positions':'AIR strictly below '+fmt(comparison.air)}: ${fmt(s.round1)} + ${fmt(s.added)} new + ${fmt(s.moved_ahead)} moved ahead − ${fmt(s.removed)} absent − ${fmt(s.moved_below)} moved below = ${fmt(s.round2)}. Net change: ${delta(s.net)}. ${fmt(s.retained)} candidates remain ahead in both lists.`;
    byId('breakdown-caption').textContent=comparison.basis==='state'?'Candidates ahead of the target’s state position in each round':`Candidates with AIR below ${fmt(comparison.air)}, regardless of bonus marks`;
    byId('change-breakdown').innerHTML=comparison.groups.map(g=>`<tr><th scope="row">${safe(g.label)}</th><td class="numeric">${fmt(g.round1)}</td><td class="numeric">${fmt(g.round2)}</td><td class="numeric">${delta(g.round2-g.round1)}</td></tr>`).join('')+`<tr class="rank-total"><th scope="row">Total ahead</th><td class="numeric">${fmt(s.round1)}</td><td class="numeric">${fmt(s.round2)}</td><td class="numeric">${delta(s.net)}</td></tr>`;
  }
  function run(initial=false){
    byId('changes-error').hidden=true;
    try{
      const value=byId('air-input').value.trim();
      if(!/^\d+$/.test(value))throw new Error('Enter a positive whole-number AIR.');
      comparison=window.MeritRoundChanges.compare(rows,Number(value),byId('basis-input').value);
      renderSummary();
      for(const [key,filter] of Object.entries(filters)){
        const saved=initial?(key==='change'&&!params.has('filters')&&!params.has('change')?defaultChanges:params.getAll(key)):filter.values();
        const options=key==='change'?[...defaultChanges,'Ahead · details changed','Still ahead']:comparison.details.map(r=>r[key]);
        filter.setOptions(options,{preserve:false});filter.setSelected(saved);
      }
      byId('changes-results').hidden=false;byId('changes-status').textContent='Both lists loaded. Compare by state position or AIR using the selector above.';
      applyFilters();
    }catch(error){
      comparison=null;byId('changes-results').hidden=true;byId('changes-error').textContent=error.message;byId('changes-error').hidden=false;
      byId('changes-status').textContent='Comparison needs a valid reference.';
    }
  }
  function renderHead(){
    byId('table-head').innerHTML='<tr>'+columns.map(([key,label])=>key==='sources'?`<th scope="col">${label}</th>`:`<th scope="col" aria-sort="${key===sortKey?(direction===1?'ascending':'descending'):'none'}"><button type="button" class="sort-button" data-sort="${key}">${label}${key===sortKey?(direction===1?' ↑':' ↓'):''}</button></th>`).join('')+'</tr>';
  }
  function cell(row,key){
    if(key==='sources')return [row.r1,row.r2].map((r,i)=>r?`<a href="${source(r,i+1)}" target="_blank" rel="noopener">R${i+1} p.${r.pdf_page}</a>`:'').filter(Boolean).join(' · ');
    if(key==='change')return `<span class="change-tag">${safe(row.change)}</span>${row.changed_fields.length?`<small class="change-detail">Updated: ${safe(row.changed_fields.map(f=>f.replaceAll('_',' ')).join(', '))}</small>`:''}`;
    if(['domicile','service_status','considered_category'].includes(key)&&row.r1&&row.r2&&row.r1[key]!==row.r2[key])return `${fmt(row.r1[key])} → ${fmt(row.r2[key])}`;
    return key==='rank_change'&&row[key]!==null?delta(row[key]):fmt(row[key]);
  }
  function appendRows(){
    if(!comparison||rendered>=filtered.length)return;
    const more=filtered.slice(rendered,rendered+120);
    byId('table-body').insertAdjacentHTML('beforeend',more.map(row=>'<tr>'+columns.map(([key])=>`<td class="${['neet_pg_air','r1_rank','r2_rank','rank_change'].includes(key)?'numeric':''}">${cell(row,key)}</td>`).join('')+'</tr>').join(''));
    rendered+=more.length;
  }
  function applyFilters(){
    if(!comparison)return;
    const query=byId('search-filter').value.trim().toLowerCase().replaceAll(',','');
    filtered=comparison.details.filter(row=>Object.entries(filters).every(([key,filter])=>filter.matches(row[key]))&&(!query||[row.neet_pg_air,row.r1?.registration_id,row.r2?.registration_id].some(v=>String(v??'').toLowerCase().includes(query))));
    filtered.sort((a,b)=>{
      const x=a[sortKey],y=b[sortKey];
      if(x===null||x===undefined)return y===null||y===undefined?0:1;
      if(y===null||y===undefined)return -1;
      const d=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y));
      return d*direction||a.neet_pg_air-b.neet_pg_air;
    });
    rendered=0;byId('table-body').innerHTML='';renderHead();appendRows();
    if(!filtered.length)byId('table-body').innerHTML=`<tr><td colspan="${columns.length}" class="empty-cell">No matching records. A zero-removal result means no matched candidates are absent from Round 2.</td></tr>`;
    byId('result-count').textContent=`${fmt(filtered.length)} of ${fmt(comparison.details.length)} ahead in either round`;
    byId('download-csv').disabled=!filtered.length;syncUrl();
  }
  function exportCsv(){
    const headers=['comparison_basis','target_air','change','membership','neet_pg_air','changed_fields',...['r1','r2'].flatMap(p=>['registration_id','state_merit_rank','domicile','service_status','considered_category','bonus_marks','total_marks','source_pdf_url'].map(f=>`${p}_${f}`))];
    const escape=value=>{let v=String(value??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
    const lines=[headers.map(escape).join(',')];
    for(const row of filtered){
      const r={comparison_basis:comparison.basis,target_air:comparison.air,change:row.change,membership:row.membership,neet_pg_air:row.neet_pg_air,changed_fields:row.changed_fields.join('; ')};
      for(const [i,p] of ['r1','r2'].entries())for(const f of ['registration_id','state_merit_rank','domicile','service_status','considered_category','bonus_marks','total_marks','source_pdf_url'])r[`${p}_${f}`]=f==='source_pdf_url'?(row[p]?new URL(source(row[p],i+1),location.href).href:''):row[p]?.[f];
      lines.push(headers.map(h=>escape(r[h])).join(','));
    }
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`rajasthan-2026-round-changes-${comparison.basis}-air-${comparison.air}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  byId('changes-form').addEventListener('submit',e=>{e.preventDefault();run();});
  byId('basis-input').addEventListener('change',()=>run());
  byId('search-filter').addEventListener('input',applyFilters);
  byId('clear-filters').addEventListener('click',()=>{Object.values(filters).forEach(f=>f.clear(false));byId('search-filter').value='';applyFilters();});
  byId('download-csv').addEventListener('click',exportCsv);
  byId('table-head').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;if(sortKey===b.dataset.sort)direction*=-1;else{sortKey=b.dataset.sort;direction=1;}applyFilters();});
  new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))appendRows();},{rootMargin:'300px'}).observe(byId('scroll-sentinel'));
  try{
    const response=await fetch('data/2026-merit.json?v=20261120-round2');if(!response.ok)throw new Error(`HTTP ${response.status}`);
    rows=await response.json();run(true);
  }catch(error){byId('changes-status').textContent='Could not load merit lists. Refresh or use the Excel download linked below.';byId('changes-error').hidden=false;byId('changes-error').textContent=error.message;}
})();
