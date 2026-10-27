(async function () {
  const byId = id => document.getElementById(id);
  const format = value => Number(value).toLocaleString('en-IN');
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const groups = [
    {key:'raj-service', label:'Rajasthan · In-Service'},
    {key:'raj-nonservice', label:'Rajasthan · Non-Service'},
    {key:'other-service', label:'Other domicile · In-Service'},
    {key:'other-nonservice', label:'Other domicile · Non-Service'},
    {key:'unknown-domicile', label:'Domicile not applicable'}
  ];
  let lists;
  const params = new URLSearchParams(location.search);
  const requestedRank = Number(params.get('rank'));
  if (params.has('rank') && Number.isInteger(requestedRank) && requestedRank >= 1 && requestedRank <= 3706) byId('rank-input').value = requestedRank;

  function groupOf(row) {
    if (row.domicile === 'Not Applicable') return 'unknown-domicile';
    const domicile = row.domicile === 'Rajasthan' ? 'raj' : 'other';
    return `${domicile}-${row.service_status === 'In-Service' ? 'service' : 'nonservice'}`;
  }
  function countsAhead(rows, rank) {
    const counts = Object.fromEntries(groups.map(group => [group.key, 0]));
    for (const row of rows) if (row.state_merit_rank < rank) counts[groupOf(row)]++;
    return counts;
  }
  function positionCard(year, rows, rank) {
    const row = rows.find(item => item.state_merit_rank === rank);
    if (!row) return `<article class="position-card unavailable"><span class="position-year">${year} · Round 1</span><strong>Rank ${format(rank)} not listed</strong><p>This list contains ${format(rows.length)} entries. Choose a rank up to ${format(rows.length)} for a two-year comparison.</p></article>`;
    const percent = (100 * rank / rows.length).toFixed(1);
    const source = `documents/${year}/merit/round-1.pdf#page=${row.pdf_page}`;
    return `<article class="position-card"><span class="position-year">${year} · ${year === 2026 ? 'provisional' : 'revised provisional'} Round 1</span><strong>State rank ${format(rank)} <small>of ${format(rows.length)} entries</small></strong><dl><div><dt>NEET-PG AIR at this position</dt><dd>${format(row.neet_pg_air)}</dd></div><div><dt>Domicile</dt><dd>${safe(row.domicile)}</dd></div><div><dt>Service</dt><dd>${safe(row.service_status)}</dd></div></dl><p>Position ${percent}% down this year's published list</p><a href="${source}" target="_blank" rel="noopener">Check PDF · page ${format(row.pdf_page)} ↗</a></article>`;
  }
  function bar(year, counts, total) {
    if (!counts) return `<div class="rank-bar-row"><strong>${year}</strong><p>Rank not listed in 2026</p></div>`;
    const segments = groups.map(group => {
      const count = counts[group.key];
      if (!count) return '';
      return `<span class="rank-segment ${group.key}" style="width:${100 * count / total}%" title="${safe(group.label)}: ${format(count)}"></span>`;
    }).join('');
    return `<div class="rank-bar-row"><div><strong>${year}</strong><span>${format(total)} ahead</span></div><div class="rank-bar-track" role="img" aria-label="${year}: ${groups.map(group => `${group.label} ${format(counts[group.key])}`).join(', ')}">${segments}</div></div>`;
  }
  function render(rank) {
    const data25 = lists[2025], data26 = lists[2026];
    const has26 = rank <= data26.length;
    const ahead25 = countsAhead(data25, rank), ahead26 = has26 ? countsAhead(data26, rank) : null;
    byId('position-title').textContent = `Rank ${format(rank)} in each list`;
    byId('ahead-title').textContent = `Candidates before rank ${format(rank)}`;
    byId('position-cards').innerHTML = positionCard(2025, data25, rank) + positionCard(2026, data26, rank);
    byId('rank-bars').innerHTML = bar(2025, ahead25, rank - 1) + bar(2026, ahead26, rank - 1);
    const row = (label, n25, n26, total = false) => `<tr${total ? ' class="rank-total"' : ''}><th scope="row">${safe(label)}</th><td class="numeric">${format(n25)}</td><td class="numeric">${n26 === null ? '—' : format(n26)}</td><td class="numeric">${n26 === null ? '—' : (n26 - n25 > 0 ? '+' : '') + format(n26 - n25)}</td></tr>`;
    byId('rank-breakdown').innerHTML = groups.map(group => row(group.label, ahead25[group.key], ahead26?.[group.key] ?? null)).join('') + row('Total ahead', rank - 1, has26 ? rank - 1 : null, true);
    byId('rank-reading').textContent = has26
      ? `At rank ${format(rank)}, ${format(ahead26['other-nonservice'])} named out-of-state Non-Service candidates are ahead in 2026, compared with ${format(ahead25['other-nonservice'])} in 2025. This is a count in the merit list, not the number eligible for or choosing any particular seat.`
      : `The 2026 provisional Round 1 list ends at rank ${format(data26.length)}. No 2026 count or AIR is inferred for rank ${format(rank)}.`;
    byId('rank-status').textContent = `Comparing state merit rank ${format(rank)} across the available Round 1 lists.`;
    byId('rank-results').hidden = false;
    const url = new URL(location.href);
    if (rank === 2085) url.searchParams.delete('rank'); else url.searchParams.set('rank', rank);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  byId('rank-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = Number(byId('rank-input').value);
    const valid = byId('rank-input').value.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 3706;
    byId('rank-error').hidden = valid;
    byId('rank-error').textContent = valid ? '' : 'Enter a whole-number state rank from 1 to 3,706.';
    if (valid && lists) render(value);
  });
  try {
    const responses = await Promise.all([2025, 2026].map(year => fetch(`data/${year}-merit.json`)));
    for (const response of responses) if (!response.ok) throw new Error(`Merit data HTTP ${response.status}`);
    const all = await Promise.all(responses.map(response => response.json()));
    lists = Object.fromEntries([2025, 2026].map((year, index) => [year, all[index].filter(row => row.round === 'Round 1').sort((a, b) => a.state_merit_rank - b.state_merit_rank)]));
    if (lists[2025].length !== 3706 || lists[2026].length !== 3160 || [2025, 2026].some(year => lists[year].some((row, index) => row.state_merit_rank !== index + 1 || !row.neet_pg_air))) throw new Error('Round 1 rank sequence or source count changed');
    render(Number(byId('rank-input').value));
  } catch (error) {
    byId('rank-status').textContent = 'Could not load the comparison. Refresh this page or open the merit lists directly.';
    console.error('Unable to load rank comparison', error);
  }
})();
