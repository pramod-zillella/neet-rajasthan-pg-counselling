/* Same-exam comparisons: AIR identifies a row; round-specific rank determines order. */
(function (root) {
  const fields = ['registration_id','domicile','service_status','considered_category','neet_marks',
    'bonus_marks','total_marks','in_service_experience_years','additional_category_filled','additional_category_verified'];
  const groups = ['Rajasthan · In-Service','Rajasthan · Non-Service','Other domicile · In-Service',
    'Other domicile · Non-Service','Domicile not applicable'];
  function group(row) {
    if (!row.domicile || row.domicile === 'Not Applicable') return groups[4];
    return `${row.domicile === 'Rajasthan' ? 'Rajasthan' : 'Other domicile'} · ${row.service_status}`;
  }
  function compare(rows, air, basis = 'state') {
    if (!Number.isSafeInteger(air) || air < 1) throw new Error('Enter a positive whole-number AIR.');
    if (!['state','air'].includes(basis)) throw new Error('Unknown comparison basis.');
    const lists = [1,2].map(n => rows.filter(r => r.year === 2026 && r.round === `Round ${n}`));
    const maps = lists.map(list => new Map(list.map(r => [r.neet_pg_air,r])));
    if (lists.some((list,i) => list.length !== maps[i].size)) throw new Error('Duplicate AIR within a round; comparison stopped.');
    const targets = maps.map(m => m.get(air) || null);
    if (basis === 'state' && targets.some(t => !t)) {
      throw new Error('This AIR is not present in both lists. Choose “Better AIR” to compare the AIR threshold without inferring a state rank.');
    }
    const isAhead = (row,i) => Boolean(row && (basis === 'air' ? row.neet_pg_air < air : row.state_merit_rank < targets[i].state_merit_rank));
    const ahead = lists.map((list,i) => list.filter(r => isAhead(r,i)));
    const pairs = [...new Set([...maps[0].keys(),...maps[1].keys()])].sort((a,b) => a-b).map(key => {
      const r1 = maps[0].get(key) || null, r2 = maps[1].get(key) || null;
      const before = isAhead(r1,0), after = isAhead(r2,1), current = r2 || r1;
      const changedFields = r1 && r2 ? fields.filter(f => r1[f] !== r2[f]) : [];
      const membership = !r1 ? 'Added in Round 2' : !r2 ? 'Absent from Round 2' : 'Listed in both';
      const change = !before && after ? (r1 ? 'Moved ahead' : 'Added ahead')
        : before && !after ? (r2 ? 'Moved below' : 'Absent from Round 2')
        : before && after ? (changedFields.length ? 'Ahead · details changed' : 'Still ahead') : 'Outside comparison';
      return {neet_pg_air:key, registration_id:current.registration_id, domicile:current.domicile,
        service_status:current.service_status, considered_category:current.considered_category,
        r1,r2,before,after,membership,change,changed_fields:changedFields,
        r1_rank:r1?.state_merit_rank ?? null,r2_rank:r2?.state_merit_rank ?? null,
        rank_change:r1 && r2 ? r2.state_merit_rank-r1.state_merit_rank : null};
    });
    const summary = {
      round1:ahead[0].length, round2:ahead[1].length,
      added:pairs.filter(p => p.change === 'Added ahead').length,
      removed:pairs.filter(p => p.change === 'Absent from Round 2').length,
      moved_ahead:pairs.filter(p => p.change === 'Moved ahead').length,
      moved_below:pairs.filter(p => p.change === 'Moved below').length,
      retained:pairs.filter(p => p.before && p.after).length,
      net:ahead[1].length-ahead[0].length,
      all_round1:lists[0].length,all_round2:lists[1].length,
      all_added:pairs.filter(p => !p.r1).length, all_removed:pairs.filter(p => !p.r2).length
    };
    return {air,basis,targets,summary,pairs,details:pairs.filter(p => p.before || p.after),
      groups:groups.map(label => ({label,round1:ahead[0].filter(r=>group(r)===label).length,
        round2:ahead[1].filter(r=>group(r)===label).length}))};
  }
  const api = {compare,group,fields};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MeritRoundChanges = api;
})(typeof window !== 'undefined' ? window : globalThis);
