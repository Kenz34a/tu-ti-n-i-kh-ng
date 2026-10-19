import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, dispatch, getStats, parseSave } from '../src/engine.js';
import { createNarrative, introScene, chapterScene, npcScene } from '../src/narrative.js';
import { STORY, NPCS } from '../src/data.js';

test('opening pages resume from the furthest read page and grant their gift once', () => {
  const s = newGame();
  assert.equal(s.narrative.introComplete, false);
  dispatch(s, 'introNext'); dispatch(s, 'introNext');
  assert.equal(parseSave(JSON.stringify(s)).narrative.introStep, 2);
  const before = { exp: s.exp, herbs: s.herbs, potions: s.potions };
  assert.equal(dispatch(s, 'finishIntro', 'resolve').ok, true);
  assert.equal(s.narrative.introStep, 3);
  assert.equal(s.narrative.vow, 'resolve');
  assert.equal(s.exp, before.exp + 20); assert.equal(s.herbs, before.herbs + 2); assert.equal(s.potions, before.potions + 1);
  const finished = structuredClone(s);
  assert.equal(dispatch(s, 'finishIntro', 'wisdom').ok, false);
  assert.equal(dispatch(s, 'introNext').ok, false);
  assert.deepEqual(s, finished);
});

test('all three vows change the advertised game rule and survive saves', () => {
  const determined = newGame(), baseline = newGame();
  dispatch(determined, 'finishIntro', 'resolve');
  dispatch(determined, 'flee'); dispatch(baseline, 'flee');
  const before = determined.exp, ordinary = baseline.exp;
  dispatch(determined, 'meditate'); dispatch(baseline, 'meditate');
  assert.equal(determined.exp - before, 28); assert.equal(baseline.exp - ordinary, 27);
  const wise = newGame(); dispatch(wise, 'finishIntro', 'wisdom');
  assert.equal(getStats(wise).mp, getStats(baseline).mp + 10);
  assert.equal(parseSave(JSON.stringify(wise)).mp, 113);
  const kind = newGame(); dispatch(kind, 'finishIntro', 'compassion'); dispatch(kind, 'flee');
  kind.hp = 1; kind.mp = 0; dispatch(kind, 'potion');
  assert.equal(kind.hp, 1 + Math.round(getStats(kind).hp * .6));
});

test('skipping the opening preserves the gift without silently choosing a vow', () => {
  const s = newGame(), before = structuredClone(s);
  assert.equal(dispatch(s, 'finishIntro', 'unknown').ok, false); assert.deepEqual(s, before);
  assert.equal(dispatch(s, 'finishIntro', null).ok, true);
  assert.equal(s.narrative.introComplete, true); assert.equal(s.narrative.vow, null);
  assert.equal(s.potions, before.potions + 1);
});

test('older saves migrate without restarting the opening or altering existing progress', () => {
  const original = newGame(); dispatch(original, 'attack');
  delete original.narrative;
  const restored = parseSave(JSON.stringify(original));
  assert.deepEqual(restored.narrative, createNarrative(true));
  assert.equal(restored.gold, original.gold); assert.equal(restored.hp, original.hp);
  assert.deepEqual(restored.combat, original.combat); assert.deepEqual(restored.inventory, original.inventory);
});

test('all authored chapters and NPC roles have renderable dialogue and gated read progress', () => {
  assert.equal(introScene('Lâm Phong').pages.length, 4);
  for (let index = 0; index < STORY.length; index++) {
    const scene = chapterScene(index, 'Đạo Hữu');
    assert.ok(scene.pages.length >= 3); assert.ok(scene.pages.at(-1).ending);
    for (const page of scene.pages) assert.ok(page.text && page.speaker && ['left', 'right', 'narrator'].includes(page.side));
    assert.ok(scene.pages.some(page => page.speaker === 'Đạo Hữu'));
  }
  for (const npc of NPCS) {
    const scene = npcScene(npc, 'Đạo Hữu');
    assert.equal(scene.pages.length, 3); assert.equal(scene.pages.at(-1).service, true);
    assert.ok(scene.pages.every(page => typeof page.text === 'string' && page.text.length > 0));
  }
  const s = newGame();
  assert.equal(dispatch(s, 'readChapter', 1).ok, false);
  assert.equal(dispatch(s, 'readChapter', 0).ok, true);
  dispatch(s, 'readChapter', 0); assert.deepEqual(s.narrative.seenChapters, [0]);
  assert.equal(s.claimed.length, 0, 'Reading a chapter must not claim its quest reward');
});

test('malformed narrative saves are rejected before reaching the renderer', () => {
  for (const mutate of [s => s.narrative = null, s => s.narrative.introStep = 4, s => s.narrative.vow = 'unknown', s => s.narrative.vow = 'wisdom', s => s.narrative.seenChapters = [20], s => s.narrative.seenChapters = [1], s => s.narrative.introComplete = 'true']) {
    const s = newGame(); mutate(s); assert.throws(() => parseSave(s));
  }
});
