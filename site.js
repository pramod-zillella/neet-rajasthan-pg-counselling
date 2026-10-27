(async function () {
  const kind = document.body.dataset.page;
  if (!kind) return;

  const yearEl = document.getElementById('year-filter');
  const roundEl = document.getElementById('round-filter');
  const searchEl = document.getElementById('search-filter');
  const listEl = document.getElementById('document-list');
  const countEl = document.getElementById('result-count');
  const dialog = document.getElementById('pdf-dialog');
  const frame = document.getElementById('pdf-frame');
  const params = new URLSearchParams(location.search);

  if (['2024', '2025'].includes(params.get('year'))) yearEl.value = params.get('year');
  const requestedRound = params.get('round');
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value).toLocaleString('en-US');

  function updateRoundOptions(documents, preferred = 'all') {
    const existing = [...new Set(documents.filter(d => d.year === Number(yearEl.value) && d.kind === kind).map(d => d.roundKey))];
    const labels = Object.fromEntries(documents.map(d => [d.roundKey, d.round]));
    const order = ['round-1', 'round-2', 'round-3', 'stray', 'special-stray'];
    roundEl.innerHTML = '<option value="all">All rounds</option>' + order.filter(key => existing.includes(key)).map(key => `<option value="${safe(key)}">${safe(labels[key])}</option>`).join('');
    roundEl.value = existing.includes(preferred) ? preferred : 'all';
  }

  function renderCard(doc) {
    const available = doc.status === 'available';
    const warning = !available || (doc.year === 2025 && doc.kind === 'allotment' && doc.roundKey === 'round-3');
    const metrics = [
      doc.pages ? `<span><strong>${number(doc.pages)}</strong>PDF pages</span>` : '',
      doc.entries ? `<span><strong>${number(doc.entries)}</strong>${kind === 'merit' ? 'listed entries' : 'allotment rows'}</span>` : ''
    ].join('');
    const actions = available
      ? `<button type="button" class="button primary" data-preview="${safe(doc.path)}" data-title="${safe(doc.year + ' · ' + doc.round)}">Preview PDF</button><a class="button outline" href="${safe(doc.path)}" target="_blank" rel="noopener">Open in new tab ↗</a>`
      : `<a class="button outline" href="${safe(doc.archiveUrl)}" target="_blank" rel="noopener noreferrer">Open archived source ↗</a>`;
    const alternate = doc.alternatePath ? `<p><a href="${safe(doc.alternatePath)}" target="_blank" rel="noopener">${safe(doc.alternateLabel)} ↗</a></p>` : '';
    return `<article class="doc-card ${warning ? 'warning' : ''}">
      <div class="doc-top"><div><span class="round-number">NEET-PG ${doc.year} · ${safe(doc.roundKey.replaceAll('-', ' '))}</span><h3>${safe(doc.round)}</h3></div><span class="badge ${warning ? 'warn' : ''}">${available ? (warning ? 'Check completeness' : 'PDF available') : 'Archive only'}</span></div>
      <p class="doc-date">${safe(doc.date)} · academic session ${doc.year}–${String(doc.year + 1).slice(-2)}</p>
      <div class="doc-metrics">${metrics}</div><p class="doc-note">${safe(doc.note)}</p>
      <div class="doc-actions">${actions}</div>
      <details class="source-details"><summary>Source and verification</summary>${alternate}<p><a href="${safe(doc.archiveUrl || doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">${doc.archiveUrl ? 'Archived source' : 'Public source copy'} ↗</a>${doc.archiveUrl ? `<a href="${safe(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer">Original Board URL ↗</a>` : ''}</p>${doc.sha256 ? `<p>Local PDF SHA-256: <code>${safe(doc.sha256)}</code></p>` : '<p>No local PDF checksum: recovered source link only.</p>'}</details>
    </article>`;
  }

  function render(documents) {
    const year = Number(yearEl.value);
    const q = searchEl.value.trim().toLocaleLowerCase();
    const matches = documents.filter(doc => doc.year === year && doc.kind === kind && (roundEl.value === 'all' || doc.roundKey === roundEl.value) && (!q || `${doc.round} ${doc.note} ${doc.date}`.toLocaleLowerCase().includes(q)));
    listEl.innerHTML = matches.length ? matches.map(renderCard).join('') : '<p class="empty">No documents match these filters. Try another round or clear the search.</p>';
    countEl.textContent = `${matches.length} ${matches.length === 1 ? 'document' : 'documents'} shown`;
    const url = new URL(location.href);
    url.searchParams.set('year', yearEl.value);
    if (roundEl.value === 'all') url.searchParams.delete('round'); else url.searchParams.set('round', roundEl.value);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  try {
    const response = await fetch('data/documents.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const {documents} = await response.json();
    updateRoundOptions(documents, requestedRound);
    render(documents);
    yearEl.addEventListener('change', () => { updateRoundOptions(documents); render(documents); });
    roundEl.addEventListener('change', () => render(documents));
    searchEl.addEventListener('input', () => render(documents));
  } catch (error) {
    countEl.textContent = 'Document list unavailable';
    listEl.innerHTML = `<p class="empty">The document register could not be loaded. Please reload the page, or open <a href="data/documents.json">the register</a> directly.</p>`;
    console.error('Unable to load document register', error);
  }

  listEl.addEventListener('click', event => {
    const button = event.target.closest('[data-preview]');
    if (!button) return;
    frame.src = button.dataset.preview;
    document.getElementById('dialog-title').textContent = button.dataset.title;
    document.getElementById('dialog-open').href = button.dataset.preview;
    dialog.showModal();
  });
  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { frame.removeAttribute('src'); });
})();
