const assert = require('node:assert/strict');
const {matches, searchChoices, NON_RAJASTHAN, UNREPORTED} = require('../filter-controls.js');

assert(matches(new Set(), 'Rajasthan'));
assert(matches(new Set(['Telangana', 'Delhi']), 'Telangana'));
assert(matches(new Set(['Telangana', 'Delhi']), 'Delhi'));
assert(!matches(new Set(['Telangana', 'Delhi']), 'Rajasthan'));
assert(matches(new Set([NON_RAJASTHAN]), 'Telangana'));
assert(matches(new Set([NON_RAJASTHAN]), 'OTHER')); // 2024 Board label
assert(!matches(new Set([NON_RAJASTHAN]), 'Rajasthan'));
assert(!matches(new Set([NON_RAJASTHAN]), 'RAJASTHAN'));
assert(!matches(new Set([NON_RAJASTHAN]), ''));
assert(!matches(new Set([NON_RAJASTHAN]), 'Not Applicable'));
assert(matches(new Set([UNREPORTED, 'Telangana']), null));
assert(matches(new Set([UNREPORTED, 'Telangana']), 'Telangana'));
assert(!matches(new Set([UNREPORTED, 'Telangana']), 'Delhi'));
const choices = [
  {value: 'Mahatma Gandhi Medical College and Hospital, Jaipur', label: 'Mahatma Gandhi Medical College and Hospital, Jaipur'},
  {value: 'SMS Medical College, Jaipur', label: 'SMS Medical College, Jaipur'},
  {value: 'Geetanjali Medical College, Udaipur', label: 'Geetanjali Medical College, Udaipur'}
];
assert.deepEqual(searchChoices(choices, 'gandhi jaipur').map(option => option.value), [choices[0].value]);
assert.equal(searchChoices(choices, 'JAIPUR').length, 2);
assert.equal(searchChoices(choices, 'radiology').length, 0);
console.log('Typeahead matching, multi-select and domicile checks passed.');
