const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {compare} = require('../merit-changes-core.js');
const root = path.resolve(__dirname,'..');
const rows = JSON.parse(fs.readFileSync(path.join(root,'data/2026-merit.json'),'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root,'data/2026-merit-changes.json'),'utf8'));
for(const basis of ['state','air']) {
  const result = compare(rows,61347,basis);
  assert.deepEqual(result.targets.map(r=>r.state_merit_rank),[2091,2193]);
  assert.equal(result.summary.all_added,248);
  assert.equal(result.summary.all_removed,0);
  assert.equal(result.summary.added,basis==='state'?102:88);
  assert.equal(result.summary.removed,0);
  assert.equal(result.summary.moved_ahead,0);
  assert.equal(result.summary.moved_below,0);
  assert.equal(result.summary.round2,result.summary.round1+result.summary.added);
  // Independent Python extraction audit must agree for every candidate, not just totals.
  for(const pair of result.pairs) {
    const r=audit.rows.find(r=>r.neet_pg_air===pair.neet_pg_air);
    assert.equal(pair.before,r[`${basis}_ahead_round1`]);
    assert.equal(pair.after,r[`${basis}_ahead_round2`]);
    assert.equal(pair.change,r[`${basis}_change`]);
  }
  for(const g of result.groups) {
    const r=audit.summary.find(r=>r.basis===basis&&r.group===g.label);
    assert.deepEqual([g.round1,g.round2],[r.round1,r.round2]);
  }
  assert(!result.details.some(r=>r.neet_pg_air===61347));
}
const state=compare(rows,61347,'state'), air=compare(rows,61347,'air');
assert.equal(state.details.filter(r=>r.change==='Added ahead'&&r.neet_pg_air>61347).length,14);
assert.equal(state.details.filter(r=>r.change==='Added ahead'&&r.domicile!=='Rajasthan'&&r.domicile!=='Not Applicable'&&r.service_status==='Non-Service').length,5);
assert.equal(air.details.filter(r=>r.neet_pg_air>=61347).length,0);

// Real snapshots have no removals/crossings. Exercise those materially different cases.
const row=(round,air,rank,extra={})=>({year:2026,round:`Round ${round}`,neet_pg_air:air,state_merit_rank:rank,registration_id:`PM${air}`,domicile:'Rajasthan',service_status:'Non-Service',considered_category:'General',...extra});
const sample=[row(1,100,3),row(2,100,4),row(1,10,1),row(1,20,2),row(2,20,5),row(1,30,4),row(2,30,2),row(2,40,1),row(1,50,5),row(2,50,3)];
const test=compare(sample,100,'state');
assert.deepEqual([test.summary.round1,test.summary.round2,test.summary.added,test.summary.removed,test.summary.moved_ahead,test.summary.moved_below],[2,3,1,1,2,1]);
assert.equal(test.summary.round2,test.summary.round1+test.summary.added-test.summary.removed+test.summary.moved_ahead-test.summary.moved_below);
assert.throws(()=>compare(sample,999,'state'),/not present in both/);
assert.equal(compare(sample,999,'air').summary.round1,5);
assert.equal(compare(sample,1,'air').details.length,0);
assert.throws(()=>compare(sample,0,'air'),/positive whole-number/);
assert.throws(()=>compare(sample,1.5,'air'),/positive whole-number/);
assert.throws(()=>compare([...sample,sample[0]],100),/Duplicate AIR/);
console.log('Round-change checks passed: all candidate matches, bonus effects, exclusions, additions, absences and rank crossings.');
