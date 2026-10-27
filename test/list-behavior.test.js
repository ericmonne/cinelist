const test = require('node:test');
const assert = require('node:assert/strict');

function addOnce(list, key) { return list.includes(key) ? list : [...list, key]; }
function removeFromList(list, key) { return list.filter(item => item !== key); }

test('adding is idempotent within a list', () => {
  assert.deepEqual(addOnce(addOnce([], 'movie:1'), 'movie:1'), ['movie:1']);
});
test('removing one list membership preserves another', () => {
  const general = ['movie:1']; const genre = ['movie:1'];
  assert.deepEqual(removeFromList(general, 'movie:1'), []);
  assert.deepEqual(genre, ['movie:1']);
});
test('country membership is independent from genre membership', () => {
  const country = ['movie:1']; const genre = ['movie:1'];
  assert.deepEqual(removeFromList(country, 'movie:1'), []);
  assert.deepEqual(genre, ['movie:1']);
});
