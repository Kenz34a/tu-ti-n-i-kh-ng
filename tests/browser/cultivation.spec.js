import { test, expect } from '@playwright/test';
import { newGame, dispatch, expRequired } from '../../src/engine.js';
import { QI_REFILL_MS } from '../../src/cultivation.js';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('thien-dao-save-v1')));
const panel = page => page.locator('.cu-overlay');
async function start(page, peaceful = true) {
  await page.goto('/'); await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  if (peaceful) await page.getByRole('button', { name: 'Rời trận', exact: true }).click();
}

test('gathering changes saved experience and charges; breakthrough updates stars and costs', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /^Tu luyện/ }).click(); await expect(panel(page)).toBeVisible();
  const before = await saved(page);
  await page.getByRole('button', { name: 'Tụ khí', exact: true }).click();
  const first = await saved(page); expect(first.exp).toBe(before.exp + 60); expect(first.cultivation.charges).toBe(9);
  await expect(page.locator('.cu-refill')).toContainText('Làm mới lượt sau');
  await page.getByRole('button', { name: 'Tụ khí', exact: true }).click();
  const charged = await saved(page); expect(charged.cultivation.refillAt).toBe(first.cultivation.refillAt);
  await expect(page.getByRole('button', { name: 'Đột phá', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Đột phá', exact: true }).click();
  const ascended = await saved(page); expect(ascended.stage).toBe(2); expect(ascended.gold).toBe(charged.gold - 70); expect(ascended.exp).toBe(charged.exp - expRequired(charged));
  await expect(page.locator('.cu-star.lit')).toHaveCount(2); await expect(page.locator('#cu-title')).toHaveText('Luyện Khí · Tầng 2');
  await page.keyboard.press('Escape'); await page.reload(); expect(await saved(page)).toEqual(ascended);
});

test('combat locks cultivation, traps focus and does not leak battle keys', async ({ page }) => {
  await start(page, false); await page.keyboard.press('t'); await expect(panel(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tụ khí', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tĩnh tọa', exact: true })).toBeDisabled();
  const before = await saved(page);
  await page.keyboard.press('1'); await page.keyboard.press('7'); await page.keyboard.press('i');
  expect(await saved(page)).toEqual(before); await expect(page.locator('.bp-window')).toHaveCount(0);
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement.closest('#cultivation-root')))).toBe(true); }
  await page.keyboard.press('Escape'); expect(await page.locator('#app').evaluate(el => el.inert)).toBe(false);
  await expect(page.getByRole('heading', { name: 'Sư phụ chỉ điểm' })).toBeVisible();
});

test('cultivation can open above dialogue and returns to the same page and speaker', async ({ page }) => {
  await page.goto('/'); await page.locator('[data-vn="reveal"]').click(); await page.locator('[data-vn="next"]').click();
  await expect(page.locator('.vn-scene')).toHaveAttribute('data-page', '1');
  await page.getByRole('button', { name: 'Tu luyện', exact: true }).click();
  await expect(panel(page)).toBeVisible(); expect(await page.locator('#story-root').evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press('ArrowRight'); await page.getByRole('button', { name: 'Đóng tu luyện', exact: true }).click();
  await expect(page.locator('.vn-scene')).toHaveAttribute('data-page', '1'); await expect(page.locator('.vn-speaker')).toHaveText('Lâm Phong');
  expect(await page.locator('#story-root').evaluate(el => el.inert)).toBe(false);
  await expect(page.getByRole('button', { name: 'Tu luyện', exact: true })).toBeFocused();
});

test('all charges can be used; free meditation and reload preserve the recharge deadline', async ({ page }) => {
  await start(page); await page.keyboard.press('t');
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Tụ khí', exact: true }).click();
  await expect(page.locator('.cu-charges')).toHaveText('0/10'); await expect(page.getByRole('button', { name: 'Tụ khí', exact: true })).toBeDisabled();
  const before = await saved(page); await page.getByRole('button', { name: 'Tĩnh tọa', exact: true }).click();
  const after = await saved(page); expect(after.exp).toBe(before.exp + 27); expect(after.cultivation).toEqual(before.cultivation);
  await page.reload(); await page.keyboard.press('t'); await expect(page.locator('.cu-charges')).toHaveText('0/10');
  expect((await saved(page)).cultivation).toEqual(before.cultivation);
});

test('the real clock refills an expired batch while the screen stays open', async ({ page }) => {
  const now = new Date('2026-10-19T10:00:00Z'); await page.clock.install({ time: now });
  const fixture = newGame(); dispatch(fixture, 'finishIntro', null); dispatch(fixture, 'flee');
  fixture.cultivation = { charges: 0, refillAt: now.getTime() + 2000 };
  await page.addInitScript(raw => { if (!localStorage.getItem('thien-dao-save-v1')) localStorage.setItem('thien-dao-save-v1', raw); }, JSON.stringify(fixture));
  await page.goto('/'); await page.keyboard.press('t'); await expect(page.locator('.cu-charges')).toHaveText('0/10');
  await page.clock.fastForward(3000); await expect(page.locator('.cu-charges')).toHaveText('10/10');
  await page.getByRole('button', { name: 'Tụ khí', exact: true }).click();
  const after = await saved(page); expect(after.cultivation.charges).toBe(9);
  const current = await page.evaluate(() => Date.now()); expect(after.cultivation.refillAt - current).toBeLessThanOrEqual(QI_REFILL_MS); expect(after.cultivation.refillAt - current).toBeGreaterThan(QI_REFILL_MS - 1000);
  await page.reload(); await page.keyboard.press('t'); await expect(page.locator('.cu-charges')).toHaveText('9/10');
});

test('cultivation remains readable on phones and landscape and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page); await page.keyboard.press('t');
  await expect(page.locator('.cu-meditator')).toBeVisible(); expect(await page.locator('.cu-meditator').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await page.locator('.cu-inner-ring').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const selector of ['.cu-orbit', '.cu-progress', '.cu-gather', '.cu-secondary', '.cu-refill', '.cu-close']) {
      const bounds = await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.width); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
