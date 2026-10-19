import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS, SKILLS } from '../src/data.js';
import { newGame, dispatch, parseSave } from '../src/engine.js';
import { monsterProfile, monsterTraits, skillDiscipline, DISCIPLINES, enemyIntent } from '../src/combat-rules.js';

function fight(index = 30) { const s = newGame(), m = MONSTERS[index]; s.region = m.region; s.combat = { ...m, type: 'monster', maxHp: m.hp, turn: 1, guarding: false }; return s; }

test('all catalog beasts and techniques have consistent, distinct combat affinities', () => {
  for (const monster of MONSTERS) {
    const profile = monsterProfile(monster);
    assert.ok(DISCIPLINES[profile.weak]); assert.ok(DISCIPLINES[profile.resist]); assert.notEqual(profile.weak, profile.resist);
    assert.equal(monsterTraits(monster).length, 2);
  }
  for (const skill of SKILLS) assert.ok(DISCIPLINES[skillDiscipline(skill)]);
  const s = newGame(); assert.equal(monsterProfile(s.combat), null); assert.deepEqual(monsterTraits(s.combat), []);
});

test('choosing a weakness beats a stronger resisted technique with the same random rolls', () => {
  const sword = fight(), shadow = structuredClone(sword);
  for (const s of [sword, shadow]) { s.knownSkills.push('skill-3', 'skill-11'); s.loadout = ['skill-3', 'skill-11']; }
  const weakHit = dispatch(sword, 'skill', 'skill-3'), resistedHit = dispatch(shadow, 'skill', 'skill-11');
  assert.ok(SKILLS[3].multiplier < SKILLS[11].multiplier);
  assert.ok(weakHit.damage > resistedHit.damage, 'The lower multiplier wins by attacking the weakness');
  assert.equal(weakHit.critical, resistedHit.critical);
  assert.ok(sword.logs.some(log => log.text.includes('Khắc chế +25%')));
  assert.ok(shadow.logs.some(log => log.text.includes('Bị kháng −25%')));
});

test('a monster guards instead of attacking, then its shield absorbs exactly one hit', () => {
  const s = fight(); dispatch(s, 'guard'); assert.equal(s.combat.turn, 2);
  assert.equal(enemyIntent(s.combat).kind, 'guard'); const hp = s.hp;
  const guarding = dispatch(s, 'attack'); assert.equal(guarding.enemyAction, 'guard'); assert.equal(guarding.enemyDamage, 0); assert.equal(s.hp, hp); assert.equal(s.combat.shielded, true);
  const bare = structuredClone(s); bare.combat.shielded = false;
  const shieldHit = dispatch(s, 'attack'), bareHit = dispatch(bare, 'attack');
  assert.ok(Math.abs(shieldHit.damage - bareHit.damage * .5) <= 1); assert.equal(s.combat.shielded, false); assert.equal(s.combat.turn, 4);
  assert.equal(enemyIntent(s.combat).kind, 'special');
  assert.ok(s.logs.some(log => log.text.includes('Hộ thể −50%')));
});

test('healing does not consume an enemy shield; a telegraphed special can be mitigated', () => {
  const s = fight(); s.combat.turn = 3; s.combat.shielded = true; s.hp = 40; s.mp = 50;
  dispatch(s, 'skill', 'skill-5'); assert.equal(s.combat.shielded, true); assert.equal(s.combat.turn, 4);
  const exposed = structuredClone(s);
  const guarded = dispatch(s, 'guard'), unguarded = dispatch(exposed, 'attack');
  assert.equal(guarded.enemyAction, 'special'); assert.equal(unguarded.enemyAction, 'special'); assert.ok(guarded.enemyDamage < unguarded.enemyDamage);
  assert.equal(s.combat.shielded, true); assert.equal(exposed.combat.shielded, false);
  assert.ok(s.logs.some(log => log.text.includes('U Ảnh Vồ Mồi')));
});

test('active shields and the next intent survive saves; legacy fights load and invalid flags fail', () => {
  const s = fight(); s.combat.turn = 3; s.combat.shielded = true;
  const restored = parseSave(JSON.stringify(s)); assert.equal(restored.combat.shielded, true); assert.deepEqual(enemyIntent(restored.combat), enemyIntent(s.combat));
  const a = dispatch(s, 'attack'), b = dispatch(restored, 'attack'); assert.deepEqual(a, b); assert.deepEqual(s, restored);
  const legacy = fight(); assert.equal(parseSave(legacy).combat.shielded, undefined);
  for (const bad of [1, 'true', null, {}, []]) { const forged = fight(); forged.combat.shielded = bad; assert.throws(() => parseSave(forged), /hộ thể/); }
});
