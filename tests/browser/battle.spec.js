import { test, expect } from '@playwright/test';
import { newGame, dispatch, getStats } from '../../src/engine.js';
import { MONSTERS } from '../../src/data.js';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('thien-dao-save-v1')));
const command = (page, action) => page.locator(`.duel-controls [data-action="${action}"]`);
const waitTurn = async page => expect(command(page, 'attack')).toBeEnabled();
async function start(page) { await page.goto('/'); await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click(); await expect(page.locator('.duel-screen')).toBeVisible(); }
async function load(page, fixture) {
  await page.addInitScript(raw => { if (!localStorage.getItem('thien-dao-save-v1')) localStorage.setItem('thien-dao-save-v1', raw); }, JSON.stringify(fixture));
  await page.goto('/'); await expect(page.locator('.duel-screen')).toBeVisible();
}
function fixture() { const s = newGame(); dispatch(s, 'finishIntro', null); return s; }
function monsterFixture(index = 0) { const s = fixture(), m = MONSTERS[index]; s.combat = { ...m, type: 'monster', maxHp: m.hp, turn: 1, guarding: false }; return s; }

test('the fullscreen tutorial uses real bars and prevents spending a turn twice during an attack', async ({ page }) => {
  await start(page); const before = await saved(page);
  await expect(page.locator('.duel-player-status h2')).toHaveText(before.name);
  await expect(page.locator('.duel-player-status').getByRole('progressbar', { name: 'Máu', exact: true })).toHaveAttribute('aria-valuenow', String(before.hp));
  await expect(page.locator('.duel-round-diamond strong')).toHaveText('1');
  await expect(command(page, 'ultimate')).toBeDisabled();
  await page.keyboard.press('1'); await expect(command(page, 'attack')).toBeDisabled();
  await page.keyboard.press('1'); await page.keyboard.press('2');
  const after = await saved(page); expect(after.combat.turn).toBe(2); expect(after.qi).toBe(25); expect(after.hp).toBeLessThan(before.hp);
  await waitTurn(page); await expect(page.locator('.duel-round-diamond strong')).toHaveText('2');
  await expect(page.locator('.duel-player-status').getByRole('progressbar', { name: 'Khí thế', exact: true })).toHaveAttribute('aria-valuenow', '25');
  await page.getByRole('button', { name: /Nhật ký trận/ }).click();
  await expect(page.locator('.duel-log-lines')).toBeVisible(); await expect(page.locator('.duel-log-lines')).toContainText('Tấn công');
  expect(await saved(page)).toEqual(after);
});

test('a charged ultimate finishes the tutorial once and preserves its rewards on reload', async ({ page }) => {
  await start(page); const before = await saved(page);
  for (let i = 0; i < 4; i++) { await command(page, 'attack').click(); await waitTurn(page); }
  await expect(command(page, 'ultimate')).toBeEnabled(); await expect(command(page, 'ultimate')).toHaveClass(/charged/);
  await command(page, 'ultimate').click();
  await expect(page.getByRole('heading', { name: 'Một niệm hướng trường sinh' })).toBeVisible();
  const after = await saved(page); expect(after.combat).toBeNull(); expect(after.counters.training).toBe(1); expect(after.exp).toBe(before.exp + 80); expect(after.gold).toBe(before.gold + 100);
  await page.keyboard.press('7'); expect(await saved(page)).toEqual(after);
  await page.reload(); expect(await saved(page)).toEqual(after); await expect(page.locator('.duel-screen')).toHaveCount(0);
});

test('guard, mana gates, skills and potions use actual resources and exactly one enemy turn each', async ({ page }) => {
  const s = fixture(); s.mp = 0; s.hp = 50; await load(page, s);
  for (const skill of await command(page, 'skill').all()) await expect(skill).toBeDisabled();
  await command(page, 'guard').click(); await waitTurn(page);
  const guarded = await saved(page); expect(guarded.mp).toBe(18); expect(guarded.qi).toBe(18); expect(guarded.hp).toBe(49); expect(guarded.combat.turn).toBe(2);
  await page.locator('.duel-skill[data-value="skill-0"]').click(); await waitTurn(page);
  const skilled = await saved(page); expect(skilled.mp).toBe(4); expect(skilled.qi).toBe(48); expect(skilled.combat.turn).toBe(3);
  await command(page, 'potion').click(); await waitTurn(page);
  const healed = await saved(page); expect(healed.mp).toBe(54); expect(healed.potions).toBe(s.potions - 1); expect(healed.hp).toBeGreaterThan(skilled.hp); expect(healed.combat.turn).toBe(4);
  await expect(page.locator('.duel-potion em')).toHaveText(String(healed.potions));
});

test('returning to the overview keeps the fight; fleeing ends it and training opens the arena again', async ({ page }) => {
  await start(page); const before = await saved(page);
  await page.getByRole('button', { name: 'Động phủ', exact: true }).click(); await expect(page.locator('.duel-screen')).toHaveCount(0); expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Vào trận', exact: true }).click(); await expect(page.locator('.duel-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('button', { name: 'Nhân vật', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Hồ sơ đạo hữu' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Động phủ', exact: true }).click();
  await page.getByRole('button', { name: 'Vào trận', exact: true }).click(); await page.getByRole('button', { name: 'Rời trận', exact: true }).click(); expect((await saved(page)).combat).toBeNull();
  await page.getByRole('button', { name: /^Thỉnh giáo/ }).click(); await expect(page.locator('.duel-screen')).toBeVisible();
  await page.reload(); await expect(page.locator('.duel-screen')).toBeVisible(); expect((await saved(page)).combat.turn).toBe(1);
});

test('inventory and cultivation overlays isolate the arena and restore its updated state', async ({ page }) => {
  await start(page); await command(page, 'attack').click(); await waitTurn(page); await page.keyboard.press('i');
  await page.locator('.bp-item[data-value="supply-potion"]').click(); const before = await saved(page);
  await page.getByRole('button', { name: 'Dùng Linh đan', exact: true }).click();
  const after = await saved(page); expect(after.combat.turn).toBe(before.combat.turn + 1); expect(after.potions).toBe(before.potions - 1);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await expect(page.locator('.duel-screen')).toBeVisible(); await waitTurn(page);
  await expect(page.locator('.duel-round-diamond strong')).toHaveText(String(after.combat.turn));
  await page.keyboard.press('t'); await expect(page.getByRole('button', { name: 'Tụ khí', exact: true })).toBeDisabled();
  await page.keyboard.press('1'); expect(await saved(page)).toEqual(after);
  await page.keyboard.press('Escape'); expect(await page.locator('#app').evaluate(el => el.inert)).toBe(false);
});

test('a real monster has a loaded sprite and awards its catalog loot after victory', async ({ page }) => {
  const s = monsterFixture(); await load(page, s);
  await expect(page.locator('.duel-wolf img')).toBeVisible(); await expect(page.locator('.duel-enemy-status h2')).toHaveText(s.combat.name);
  await expect.poll(() => page.locator('.duel-wolf img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  for (let i = 0; i < 12; i++) { if (!(await saved(page)).combat) break; await command(page, 'attack').click(); if ((await saved(page)).combat) await waitTurn(page); }
  await expect(page.locator('.duel-screen')).toHaveCount(0);
  const after = await saved(page); expect(after.counters.kills).toBe(1); expect(after.exp).toBe(s.exp + s.combat.exp); expect(after.gold).toBeGreaterThanOrEqual(s.gold + s.combat.gold); expect(after.herbs).toBeGreaterThan(s.herbs);
  await page.reload(); expect(await saved(page)).toEqual(after);
});

test('defeat revives the character and charges the loss once', async ({ page }) => {
  const s = monsterFixture(9); s.hp = 1; await load(page, s);
  await command(page, 'attack').click(); await expect(page.locator('.duel-screen')).toHaveCount(0);
  const after = await saved(page); expect(after.combat).toBeNull(); expect(after.hp).toBe(getStats(after).hp); expect(after.gold).toBe(s.gold - Math.floor(s.gold * .05)); expect(after.exp).toBe(s.exp);
  await page.reload(); expect(await saved(page)).toEqual(after);
});

test('all commands and vitals fit desktop, phone and landscape; reduced motion disables effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page);
  expect(await page.locator('.duel-mist').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  for (const viewport of [{ width: 1904, height: 945 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    for (const selector of ['.duel-player-status', '.duel-enemy-group', '.duel-hint', '.duel-journal', '.duel-skill', '.duel-command', '.duel-potion', '.duel-abode', '.duel-flee']) {
      for (const element of await page.locator(selector).all()) {
        const bounds = await element.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
        expect(bounds.left, `${selector} at ${viewport.width}`).toBeGreaterThanOrEqual(0); expect(bounds.top).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.width); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('late realm health and long names fit phone panels while retaining exact values', async ({ page }) => {
  const s = monsterFixture(1199); s.realm = 29; s.stage = 9; s.region = 119; s.name = 'MMMMMMMMMMMMMMMMMMMMMMMM'; s.hp = getStats(s).hp; s.mp = getStats(s).mp;
  await page.setViewportSize({ width: 360, height: 740 }); await load(page, s);
  await expect(page.locator('.duel-player-status h2')).toHaveAttribute('title', s.name);
  await expect(page.locator('.duel-player-status').getByRole('progressbar', { name: 'Máu', exact: true })).toHaveAttribute('aria-valuenow', String(s.hp));
  for (const selector of ['.duel-meter strong', '.duel-intent', '.duel-status h2']) {
    for (const item of await page.locator(selector).all()) expect(await item.evaluate(el => { const r = el.getBoundingClientRect(), p = (el.closest('.duel-status') || el.closest('.duel-enemy-group')).getBoundingClientRect(); return r.left >= p.left && r.right <= p.right; })).toBe(true);
  }
  await expect(page.locator('.duel-player-status .duel-meter strong').first()).toHaveAttribute('title', `${s.hp.toLocaleString('vi-VN')}/${s.hp.toLocaleString('vi-VN')}`);
});
