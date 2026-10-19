import { test, expect } from '@playwright/test';
import { newGame, dispatch } from '../../src/engine.js';
import { EQUIPMENT, ITEM_BY_ID } from '../../src/data.js';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('thien-dao-save-v1')));
const bag = page => page.getByRole('dialog', { name: 'Túi đồ', exact: true });
const item = (page, id) => page.locator(`.bp-item[data-value="${id}"]`);
async function start(page, peaceful = true) {
  await page.goto('/'); await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
  await page.getByRole('button', { name: 'Động phủ', exact: true }).click();
  if (peaceful) await page.getByRole('button', { name: 'Rời trận', exact: true }).click();
}
async function open(page) { await page.keyboard.press('i'); await expect(bag(page)).toBeVisible(); }

test('bag opens from navigation or I and isolates background shortcuts and focus', async ({ page }) => {
  await start(page, false);
  await page.getByRole('navigation').getByRole('button', { name: 'Túi đồ', exact: true }).click();
  await expect(bag(page)).toBeVisible(); await expect(page.locator('.bp-spirit-stones strong')).toHaveText('1.250');
  const before = await saved(page); await page.keyboard.press('1'); expect(await saved(page)).toEqual(before);
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement.closest('#inventory-root')))).toBe(true); }
  await page.getByRole('searchbox', { name: 'Tìm trong hành trang' }).fill('linh');
  await page.keyboard.press('i'); await expect(bag(page)).toBeVisible();
  await page.keyboard.press('Escape'); await expect(bag(page)).toHaveCount(0);
  expect(await page.locator('#app').evaluate(el => el.inert)).toBe(false);
  await open(page); await page.getByRole('button', { name: 'Đóng hành trang' }).click();
  await expect(page.getByRole('heading', { name: 'Sư phụ chỉ điểm' })).toBeVisible();
});

test('categories, search and empty equipment slots filter actual inventory entries', async ({ page }) => {
  await start(page); await open(page);
  await page.getByRole('button', { name: 'Đan dược', exact: true }).click(); await expect(page.locator('.bp-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Nguyên liệu', exact: true }).click(); await expect(item(page, 'supply-herbs')).toBeVisible();
  await page.getByRole('button', { name: 'Sách', exact: true }).click(); await expect(page.locator('.bp-item')).toHaveCount(4);
  await page.getByRole('searchbox').fill('tu khi quyet'); await expect(page.locator('.bp-item')).toHaveCount(1); await expect(item(page, 'manual-qi')).toBeVisible();
  await page.getByRole('searchbox').fill('khong-co-vat-pham-nay'); await expect(page.locator('.bp-empty-message')).toContainText('Không tìm thấy vật phẩm');
  await page.getByRole('button', { name: 'Linh ngoa: Chưa trang bị', exact: true }).click();
  await expect(page.locator('.bp-slot-filter')).toContainText('Linh ngoa'); await expect(page.locator('.bp-item')).toHaveCount(0);
  await page.locator('[data-bp="clearSlot"]').click(); await expect(page.locator('.bp-item')).toHaveCount(5);
});

test('equip, compare, unequip and sell update worn slots, stats and persisted ownership', async ({ page }) => {
  await start(page); await open(page);
  await item(page, 'item-18').click(); await expect(page.locator('.bp-detail-stats')).toContainText('+12');
  await page.locator('.bp-item-detail').getByRole('button', { name: 'Trang bị', exact: true }).click();
  expect((await saved(page)).equipped.weapon).toBe('item-18');
  await page.getByRole('tab', { name: 'Chỉ số', exact: true }).click();
  await expect(page.locator('.bp-attribute').filter({ hasText: 'Công kích' }).locator('strong')).toHaveText('33');
  await page.getByRole('tab', { name: 'Hành trang', exact: true }).click(); await item(page, 'item-18').click();
  await page.getByRole('button', { name: 'Tháo trang bị', exact: true }).click(); expect((await saved(page)).equipped.weapon).toBeUndefined();
  const gold = (await saved(page)).gold; await page.getByRole('button', { name: /^Bán ·/ }).click();
  expect((await saved(page)).gold).toBe(gold + Math.floor(ITEM_BY_ID['item-18'].price * .4));
  await expect(item(page, 'item-18')).toHaveCount(0);
  await page.getByRole('button', { name: 'Đóng hành trang' }).click(); await page.reload();
  expect((await saved(page)).inventory).not.toContain('item-18'); expect((await saved(page)).equipped.weapon).toBeUndefined();
});

test('using a potion through the bag consumes stock and exactly one combat turn', async ({ page }) => {
  await start(page, false); await page.keyboard.press('1'); await page.waitForTimeout(420); await open(page);
  await item(page, 'supply-potion').click(); const before = await saved(page);
  await page.getByRole('button', { name: 'Dùng Linh đan', exact: true }).click();
  const after = await saved(page); expect(after.potions).toBe(before.potions - 1); expect(after.combat.turn).toBe(before.combat.turn + 1); expect(after.mp).toBe(103);
  await expect(page.locator('.bp-restriction')).toHaveCount(0);
  await page.keyboard.press('Escape'); await item(page, 'item-18').click();
  await expect(page.locator('.bp-item-detail').getByRole('button', { name: 'Trang bị', exact: true })).toBeDisabled();
  await expect(page.locator('.bp-restriction')).toContainText('đang giao tranh');
});

test('learned books and the introductory manual connect to real technique and cultivation actions', async ({ page }) => {
  await start(page); await open(page); await page.getByRole('button', { name: 'Sách', exact: true }).click();
  await item(page, 'skill-1').click(); await page.getByRole('button', { name: 'Gỡ khỏi xuất trận', exact: true }).click();
  expect((await saved(page)).loadout).not.toContain('skill-1');
  await page.getByRole('button', { name: 'Mang ra xuất trận', exact: true }).click(); expect((await saved(page)).loadout).toContain('skill-1');
  await page.keyboard.press('Escape'); await item(page, 'manual-qi').click();
  await expect(page.locator('.bp-item-detail')).toContainText('Tâm pháp nhập môn');
  await page.getByRole('button', { name: 'Xem tu luyện', exact: true }).click(); await expect(bag(page)).toHaveCount(0);
  await expect(page.locator('.cu-overlay')).toBeVisible(); await expect(page.getByRole('button', { name: 'Tụ khí', exact: true })).toBeVisible();
});

test('the bag can open above a dialogue and return to the same speaker and page', async ({ page }) => {
  await page.goto('/'); await page.locator('[data-vn="reveal"]').click(); await page.locator('[data-vn="next"]').click();
  await expect(page.locator('.vn-scene')).toHaveAttribute('data-page', '1');
  await page.getByRole('button', { name: 'Túi đồ', exact: true }).click(); await expect(bag(page)).toBeVisible();
  expect(await page.locator('#story-root').evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press('ArrowRight'); await page.getByRole('button', { name: 'Đóng hành trang' }).click();
  await expect(page.locator('.vn-scene')).toBeVisible(); await expect(page.locator('.vn-scene')).toHaveAttribute('data-page', '1');
  await expect(page.locator('.vn-speaker')).toHaveText('Lâm Phong'); expect(await page.locator('#story-root').evaluate(el => el.inert)).toBe(false);
});

test('a large bag paginates and remains usable on phone and landscape viewports', async ({ page }) => {
  const fixture = newGame(); dispatch(fixture, 'finishIntro', null); dispatch(fixture, 'flee'); fixture.inventory = EQUIPMENT.slice(0, 60).map(item => item.id);
  await page.addInitScript(raw => localStorage.setItem('thien-dao-save-v1', raw), JSON.stringify(fixture));
  await page.goto('/'); await open(page); await page.getByRole('button', { name: 'Trang bị', exact: true }).click();
  await expect(page.locator('.bp-item')).toHaveCount(20); await expect(page.locator('.bp-inventory-caption')).toContainText('60 loại vật phẩm');
  await page.getByRole('button', { name: 'Trang vật phẩm tiếp' }).click(); await expect(item(page, 'item-20')).toBeVisible();
  await page.getByRole('button', { name: 'Trang vật phẩm tiếp' }).click(); await expect(item(page, 'item-59')).toBeVisible();
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.locator('.bp-window').evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth }; });
    expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.width); expect(bounds.top).toBeGreaterThanOrEqual(0); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height); expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
    await page.getByRole('searchbox').fill('thai hu'); await expect(page.locator('.bp-item')).toHaveCount(6);
    await page.getByRole('searchbox').fill('');
  }
});
