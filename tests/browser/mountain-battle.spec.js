import { test, expect } from '@playwright/test';
import { MONSTERS, REGIONS } from '../../src/data.js';
import { newGame, dispatch, addLog } from '../../src/engine.js';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('thien-dao-save-v1')));
const action = (page, value) => page.locator(`.duel-controls [data-action="${value}"]`);
const waitTurn = page => expect(action(page, 'attack')).toBeEnabled();
function fixture(turn = 1) {
  const s = newGame(); dispatch(s, 'finishIntro', null); const monster = MONSTERS[30]; s.region = monster.region;
  s.combat = { ...monster, type: 'monster', maxHp: monster.hp, turn, guarding: false }; s.hp = 99;
  addLog(s, `Chạm trán ${monster.name}!`, 'enemy'); return s;
}
async function load(page, s = fixture()) {
  await page.addInitScript(raw => { if (!localStorage.getItem('thien-dao-save-v1')) localStorage.setItem('thien-dao-save-v1', raw); }, JSON.stringify(s));
  await page.goto('/'); await expect(page.locator('.duel-monster')).toBeVisible();
}

test('mountain battles show the actual region, shadow wolf and actionable trait explanations', async ({ page }) => {
  await load(page); await expect(page.getByRole('heading', { name: 'Quyết chiến trong sương' })).toBeVisible();
  await expect(page.locator('.duel-abode')).toHaveText(REGIONS[3].name.toLocaleUpperCase('vi'));
  expect(await page.locator('.duel-backdrop').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('mist-mountains.webp');
  await expect(page.locator('.duel-wolf img')).toHaveAttribute('src', '/art/shadow-wolf.webp'); await expect.poll(() => page.locator('.duel-wolf img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('button', { name: 'Yếu Kiếm', exact: true })).toBeVisible();
  const before = await saved(page); await page.getByRole('button', { name: 'Kháng Ma đạo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Đặc tính yêu thú', exact: true })).toBeVisible(); await expect(page.locator('.monster-trait-details')).toContainText('Giảm 25%');
  await page.keyboard.press('1'); expect(await saved(page)).toEqual(before); await page.keyboard.press('Escape'); await expect(page.locator('.duel-monster')).toBeVisible();
  await page.getByRole('button', { name: 'Động phủ', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Công pháp', exact: true }).click();
  await expect(page.locator('.skill-card').filter({ has: page.getByRole('heading', { name: 'Thanh Phong Kiếm', exact: true }) })).toContainText('Hệ Kiếm');
  await page.getByRole('navigation').getByRole('button', { name: /Vạn vật lục/ }).click();
  await page.getByRole('searchbox').fill(MONSTERS[30].name); await page.locator('.catalog-card[data-value="monster-30"]').click();
  await expect(page.getByRole('dialog')).toContainText('Kháng Ma đạo'); await expect(page.getByRole('dialog')).toContainText('Yếu Kiếm'); expect(await saved(page)).toEqual(before);
});

test('guarding, one-hit shields and damage previews stay consistent after a reload', async ({ page }) => {
  await load(page); await action(page, 'guard').click(); await waitTurn(page);
  await expect(page.locator('.duel-intent')).toContainText('Hộ thể'); const before = await saved(page);
  await action(page, 'attack').click(); await waitTurn(page);
  const shielded = await saved(page); expect(shielded.hp).toBe(before.hp); expect(shielded.combat.turn).toBe(3); expect(shielded.combat.shielded).toBe(true);
  await expect(page.locator('.duel-shield-tag')).toBeVisible();
  const preview = await page.locator('.duel-attack small').textContent(); const [min, max] = preview.split(' · ')[0].split('–').map(Number);
  await page.reload(); expect((await saved(page)).combat.shielded).toBe(true); await expect(page.locator('.duel-attack small')).toHaveText(preview);
  await action(page, 'attack').click(); await waitTurn(page);
  const after = await saved(page), dealt = shielded.combat.hp - after.combat.hp;
  expect(dealt).toBeGreaterThanOrEqual(min); expect(dealt).toBeLessThanOrEqual(Math.round(max * 1.6) + 1);
  expect(after.combat.shielded).toBe(false); await expect(page.locator('.duel-shield-tag')).toHaveCount(0); await expect(page.locator('.duel-intent')).toContainText('Tuyệt chiêu');
});

test('the special attack forecast matches the actual incoming damage and journal', async ({ page }) => {
  const s = fixture(4); await load(page, s);
  await expect(page.locator('.duel-intent')).toContainText('Tuyệt chiêu'); const [min, max] = (await page.locator('.duel-intent b').textContent()).split('–').map(Number);
  await action(page, 'attack').click(); await waitTurn(page); const after = await saved(page);
  expect(s.hp - after.hp).toBeGreaterThanOrEqual(min); expect(s.hp - after.hp).toBeLessThanOrEqual(max);
  await expect(page.locator('.duel-master-message')).toContainText('U Ảnh Vồ Mồi'); await expect(page.locator('.duel-intent')).toContainText('Tấn công');
});

test('retreat by button or zero ends the encounter without spending items or granting loot', async ({ page }) => {
  await load(page); const before = await saved(page); await action(page, 'flee').click();
  const after = await saved(page); expect(after.combat).toBeNull(); expect(after.gold).toBe(before.gold); expect(after.potions).toBe(before.potions); expect(after.counters.kills).toBe(0);
  await expect(page.locator('.duel-monster')).toHaveCount(0);
  await page.evaluate(raw => localStorage.setItem('thien-dao-save-v1', raw), JSON.stringify(before)); await page.reload(); await page.keyboard.press('0'); expect((await saved(page)).combat).toBeNull();
});

test('outdoor traits, five commands and live stats fit phone, tablet and landscape', async ({ page }) => {
  const s = fixture(3); s.combat.shielded = true; await page.emulateMedia({ reducedMotion: 'reduce' }); await load(page, s);
  for (const viewport of [{ width: 1904, height: 945 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    for (const selector of ['.duel-player-status', '.duel-enemy-group', '.duel-traits', '.duel-intent', '.duel-round', '.duel-abode', '.duel-journal', '.duel-skill', '.duel-core-actions>button']) {
      for (const item of await page.locator(selector).all()) {
        const r = await item.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
        expect(r.x, `${selector} at ${viewport.width}`).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(r.width); expect(r.bottom).toBeLessThanOrEqual(r.height);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
