import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, dispatch, parseSave, expRequired, getStats } from '../src/engine.js';
import { qiReserve, QI_REFILL_MS, cultivationGain, formatRefill, breakthroughCost } from '../src/cultivation.js';

const start = 1760000000000;
function outside() { const s = newGame(); dispatch(s, 'flee'); return s; }

test('ten gathers share a fixed deadline; exhausted attempts spend nothing', () => {
  const s = outside();
  for (let i = 0; i < 10; i++) {
    assert.equal(dispatch(s, 'gatherQi', null, start + i * 1000).ok, true);
    assert.equal(s.cultivation.charges, 9 - i);
    assert.equal(s.cultivation.refillAt, start + QI_REFILL_MS);
  }
  const before = structuredClone(s);
  assert.equal(dispatch(s, 'gatherQi', null, start + 11000).ok, false);
  assert.deepEqual(s, before);
  assert.equal(dispatch(s, 'meditate').ok, true, 'Tĩnh tọa remains available while recharging');
  assert.deepEqual(s.cultivation, before.cultivation);
});

test('offline refill grants one full batch at the deadline and reading never mutates saves', () => {
  const s = outside(); dispatch(s, 'gatherQi', null, start);
  const before = structuredClone(s.cultivation), deadline = s.cultivation.refillAt;
  assert.equal(qiReserve(s.cultivation, deadline - 1).charges, 9);
  assert.equal(formatRefill(qiReserve(s.cultivation, deadline - 1).remaining), '00:00:01');
  assert.equal(qiReserve(s.cultivation, deadline).charges, 10);
  assert.equal(qiReserve(s.cultivation, deadline + 20 * QI_REFILL_MS).charges, 10);
  assert.deepEqual(s.cultivation, before);
  const restored = parseSave(JSON.stringify(s));
  assert.equal(dispatch(restored, 'gatherQi', null, deadline).ok, true);
  assert.deepEqual(restored.cultivation, { charges: 9, refillAt: deadline + QI_REFILL_MS });
  assert.equal(formatRefill(QI_REFILL_MS), '03:00:00');
});

test('gathering restores vitals, grants actual scaled experience and honors resolve', () => {
  const s = outside(); s.narrative.introComplete = true; s.narrative.vow = 'resolve'; s.realm = 3; s.stage = 4; s.hp = 1; s.mp = 0;
  const exp = s.exp, gained = cultivationGain(s), turns = s.turns;
  const result = dispatch(s, 'gatherQi', null, start);
  assert.equal(result.gained, gained); assert.equal(s.exp, exp + gained);
  assert.equal(s.hp, getStats(s).hp); assert.equal(s.mp, getStats(s).mp);
  assert.equal(s.counters.meditations, 1); assert.equal(s.turns, turns + 1);
});

test('combat and experience cap reject gathering without spending charges or time', () => {
  const s = newGame(), combat = structuredClone(s);
  assert.equal(dispatch(s, 'gatherQi', null, start).ok, false); assert.deepEqual(s, combat);
  dispatch(s, 'flee'); s.exp = expRequired(s) * 10;
  const capped = structuredClone(s);
  assert.equal(dispatch(s, 'gatherQi', null, start).ok, false); assert.deepEqual(s, capped);
  s.exp--; assert.equal(dispatch(s, 'gatherQi', null, start).gained, 1);
});

test('breakthrough uses the real cost and carries remaining charges across realms', () => {
  const s = outside(); s.stage = 9; s.gold = 50000; s.exp = expRequired(s);
  dispatch(s, 'gatherQi', null, start);
  const reserve = structuredClone(s.cultivation), gold = s.gold, cost = breakthroughCost(s);
  assert.equal(dispatch(s, 'breakthrough').ok, true); assert.equal(s.realm, 1); assert.equal(s.stage, 1);
  assert.equal(s.gold, gold - cost); assert.deepEqual(s.cultivation, reserve);
});

test('old saves migrate without losing progress; malformed charge data is rejected', () => {
  const s = outside(); delete s.cultivation;
  const migrated = parseSave(s);
  assert.deepEqual(migrated.cultivation, { charges: 10, refillAt: 0 }); assert.equal(migrated.exp, s.exp); assert.equal(migrated.gold, s.gold);
  for (const bad of [null, { charges: 11, refillAt: 0 }, { charges: -1, refillAt: start }, { charges: 2.5, refillAt: start }, { charges: 0, refillAt: 0 }, { charges: 10, refillAt: start }, { charges: 9, refillAt: 'tomorrow' }, { charges: 9, refillAt: -1 }, { charges: 9, refillAt: Infinity }]) {
    assert.throws(() => parseSave({ ...s, cultivation: bad }), /tụ khí/);
  }
});
