import { test, expect } from '@playwright/test';

const scene = page => page.locator('.vn-scene');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('thien-dao-save-v1')));
async function reveal(page) { await page.locator('[data-vn="reveal"]').click(); await expect(scene(page)).toHaveAttribute('data-typing', 'false'); }
async function next(page) { await reveal(page); await page.locator('[data-vn="next"]').click(); }

test('opening alternates speakers, resumes its page and grants the chosen vow once', async ({ page }) => {
  await page.goto('/');
  await expect(scene(page)).toHaveAttribute('data-page', '0');
  await expect(page.locator('.vn-portrait-left')).toHaveClass(/speaking/);
  await page.keyboard.press('1'); expect((await saved(page)).combat.turn).toBe(1);
  await next(page);
  await expect(scene(page)).toHaveAttribute('data-side', 'right');
  await expect(page.locator('.vn-speaker')).toHaveText('Lâm Phong');
  await page.reload();
  await expect(scene(page)).toHaveAttribute('data-page', '1');
  await next(page); await expect(scene(page)).toHaveAttribute('data-page', '2');
  await expect(page.locator('.vn-accessible')).toContainText('Tụ Khí Quyết');
  await next(page); await reveal(page);
  await page.getByRole('button', { name: /Minh tâm/ }).click();
  await expect(scene(page)).toHaveCount(0);
  const after = await saved(page);
  expect(after.narrative.vow).toBe('wisdom'); expect(after.mp).toBe(113);
  expect(after.potions).toBe(4); expect(after.herbs).toBe(10);
  await page.getByRole('button', { name: 'Động phủ', exact: true }).click();
  await page.getByRole('button', { name: 'Chuyện cũ', exact: true }).click();
  for (let i = 0; i < 3; i++) await next(page);
  await next(page);
  await expect(scene(page)).toHaveCount(0);
  expect(await saved(page)).toEqual(after);
});

test('opening can be paused, revisited and skipped without losing existing actions', async ({ page }) => {
  await page.goto('/'); await next(page);
  await page.getByRole('button', { name: 'Trở về động phủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sư phụ chỉ điểm' })).toBeVisible();
  await page.getByRole('button', { name: 'Động phủ', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục đối thoại', exact: true }).click();
  await expect(scene(page)).toHaveAttribute('data-page', '1');
  await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  expect((await saved(page)).narrative.vow).toBeNull();
  await page.reload(); await expect(scene(page)).toHaveCount(0);
  await page.keyboard.press('1'); expect((await saved(page)).combat.turn).toBe(2);
});

test('chapter scenes have a readable history and do not advance quest rewards by reading', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  await page.getByRole('button', { name: 'Động phủ', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Nhiệm vụ', exact: true }).click();
  await page.getByRole('button', { name: 'Đọc đối thoại', exact: true }).click();
  await next(page);
  await page.getByRole('button', { name: 'Nhật ký đối thoại', exact: true }).click();
  await expect(page.locator('.vn-history-lines article')).toHaveCount(2);
  await expect(page.locator('.vn-history')).toContainText('Mười năm trước');
  await page.keyboard.press('Escape'); await expect(page.locator('.vn-history')).toBeHidden();
  await next(page); await next(page); await next(page);
  await expect(scene(page)).toHaveCount(0);
  const s = await saved(page); expect(s.narrative.seenChapters).toEqual([0]); expect(s.storyIndex).toBe(0); expect(s.claimed).toEqual([]);
});

test('mobile and landscape dialogue keep text and choices inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (let i = 0; i < 3; i++) await next(page);
  await reveal(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const viewportFit = await page.locator('.vn-dialogue-zone').evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
    expect(viewportFit.left).toBeGreaterThanOrEqual(0); expect(viewportFit.right).toBeLessThanOrEqual(viewportFit.width);
    expect(viewportFit.top).toBeGreaterThanOrEqual(0); expect(viewportFit.bottom).toBeLessThanOrEqual(viewportFit.height);
    await expect(page.getByRole('button', { name: /Nhân tâm/ })).toBeVisible();
  }
  await page.getByRole('button', { name: /Nhân tâm/ }).click();
  expect((await saved(page)).narrative.vow).toBe('compassion');
});

test('reduced motion shows complete lines, background controls are inert and focus stays in the scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(scene(page)).toHaveAttribute('data-typing', 'false');
  expect(await page.locator('#app').evaluate(el => el.inert)).toBe(true);
  await expect(page.locator('.vn-typed')).toContainText('Lại đến rồi à?');
  for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement.closest('#story-root')))).toBe(true); }
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cài đặt tiên lộ' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(scene(page)).toBeVisible();
  await page.keyboard.press('Escape'); await expect(scene(page)).toHaveCount(0);
});
