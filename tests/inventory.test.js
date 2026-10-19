import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, dispatch, getStats, parseSave } from '../src/engine.js';
import { ITEM_BY_ID } from '../src/data.js';
import { inventoryEntries, filterInventory, equipmentComparison } from '../src/inventory-model.js';

function ready() { const s = newGame(); dispatch(s, 'finishIntro', null); dispatch(s, 'flee'); return s; }

test('inventory projects only owned gear, learned books and actual resource stacks', () => {
  const s = ready(), before = structuredClone(s), entries = inventoryEntries(s);
  assert.deepEqual(entries.filter(item => item.kind === 'gear').map(item => item.id), s.inventory);
  assert.deepEqual(entries.filter(item => item.kind === 'skill').map(item => item.id), s.knownSkills);
  for (const [id, field] of [['supply-potion', 'potions'], ['supply-herbs', 'herbs'], ['currency-gold', 'gold'], ['currency-jade', 'jade']]) assert.equal(entries.find(item => item.id === id).quantity, s[field]);
  assert.equal(entries.find(item => item.id === 'manual-qi').equipped, true);
  assert.equal(entries.find(item => item.id === 'item-0').equipped, true);
  assert.equal(entries.find(item => item.id === 'item-18').equipped, false);
  assert.equal(new Set(entries.map(item => item.id)).size, entries.length);
  assert.deepEqual(s, before, 'Rendering must not modify the save');
});

test('filters combine category, equipment slot and accent-insensitive Vietnamese search', () => {
  const s = ready();
  assert.deepEqual(filterInventory(s, { category: 'potions' }).map(item => item.id), ['supply-potion']);
  assert.deepEqual(filterInventory(s, { search: 'TU KHI QUYET' }).map(item => item.id), ['manual-qi']);
  assert.deepEqual(filterInventory(s, { category: 'materials', search: 'linh thao' }).map(item => item.id), ['supply-herbs']);
  assert.equal(filterInventory(s, { category: 'equipment', slot: 'weapon' }).length, 2);
  assert.equal(filterInventory(s, { category: 'books', slot: 'weapon' }).length, 0);
  assert.equal(filterInventory(s, { search: '<script>not-an-item</script>' }).length, 0);
});

test('empty stacks disappear and remaining quantities track engine actions', () => {
  const s = ready(); s.hp = 1; s.mp = 0;
  const potions = s.potions; dispatch(s, 'potion');
  assert.equal(inventoryEntries(s).find(item => item.id === 'supply-potion').quantity, potions - 1);
  s.potions = 0; s.herbs = 0; s.gold = 0; s.jade = 0;
  assert.ok(inventoryEntries(s).every(item => !['potion', 'material', 'currency'].includes(item.kind)));
  const fresh = newGame(); assert.ok(!inventoryEntries(fresh).some(item => item.id === 'manual-qi'), 'Tâm pháp must be learned first');
});

test('equipment comparisons show actual differences against the worn item', () => {
  const s = ready(); const item = ITEM_BY_ID['item-18'];
  assert.equal(equipmentComparison(s, item).attack, item.attack - ITEM_BY_ID[s.equipped.weapon].attack);
  dispatch(s, 'equip', item.id);
  assert.deepEqual(equipmentComparison(s, item), { attack: 0, defense: 0, hp: 0 });
});

test('unequipping updates attributes and health limits while retaining the item', () => {
  const s = ready(), items = [...s.inventory], stats = getStats(s);
  assert.equal(dispatch(s, 'unequip', 'weapon').ok, true);
  assert.ok(getStats(s).attack < stats.attack); assert.equal(s.equipped.weapon, undefined);
  assert.deepEqual(s.inventory, items);
  s.hp = getStats(s).hp; const hp = s.hp;
  dispatch(s, 'unequip', 'armor'); assert.ok(s.hp < hp); assert.equal(s.hp, getStats(s).hp);
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  assert.equal(dispatch(s, 'unequip', 'armor').ok, false);
  assert.equal(dispatch(s, 'equip', 'item-0').ok, true);
});

test('combat blocks removing gear and selling worn items; an unworn item can be sold once', () => {
  const s = newGame(), before = structuredClone(s);
  assert.equal(dispatch(s, 'unequip', 'weapon').ok, false); assert.deepEqual(s, before);
  assert.equal(dispatch(s, 'sell', 'item-0').ok, false);
  dispatch(s, 'flee'); dispatch(s, 'unequip', 'weapon');
  const gold = s.gold;
  assert.equal(dispatch(s, 'sell', 'item-0').ok, true);
  assert.equal(s.gold, gold + Math.floor(ITEM_BY_ID['item-0'].price * .4));
  assert.ok(!inventoryEntries(s).some(item => item.id === 'item-0'));
  assert.equal(dispatch(s, 'sell', 'item-0').ok, false);
});
