const assert = require('node:assert/strict');
const {matches, NON_RAJASTHAN, UNREPORTED} = require('../filter-controls.js');

assert(matches(new Set(), 'Rajasthan'));
assert(matches(new Set(['Telangana', 'Delhi']), 'Telangana'));
assert(matches(new Set(['Telangana', 'Delhi']), 'Delhi'));
assert(!matches(new Set(['Telangana', 'Delhi']), 'Rajasthan'));
assert(matches(new Set([NON_RAJASTHAN]), 'Telangana'));
assert(matches(new Set([NON_RAJASTHAN]), 'OTHER')); // 2024 Board label
assert(!matches(new Set([NON_RAJASTHAN]), 'Rajasthan'));
assert(!matches(new Set([NON_RAJASTHAN]), 'RAJASTHAN'));
assert(!matches(new Set([NON_RAJASTHAN]), ''));
assert(matches(new Set([UNREPORTED, 'Telangana']), null));
assert(matches(new Set([UNREPORTED, 'Telangana']), 'Telangana'));
assert(!matches(new Set([UNREPORTED, 'Telangana']), 'Delhi'));
console.log('Multi-select and domicile matching checks passed.');
