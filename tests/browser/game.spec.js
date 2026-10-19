import { test, expect } from '@playwright/test';

const nav = (page, name) => page.getByRole('navigation').getByRole('button', { name, exact: true });
async function leaveTraining(page) { await page.getByRole('button',{name:'Rời trận',exact:true}).click(); }
async function saved(page) { return page.evaluate(()=>JSON.parse(localStorage.getItem('thien-dao-save-v1'))); }

test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Bỏ qua',exact:true}).click();await page.getByRole('button',{name:'Động phủ',exact:true}).click();});

test('tutorial combat, chapter reward, breakthrough and a reload preserve the same character',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('heading',{name:'Sư phụ chỉ điểm'})).toBeVisible();
  for(let i=0;i<4;i++){await page.keyboard.press('1');await page.waitForTimeout(420);}
  await expect(page.getByRole('button',{name:/Nhất Kiếm Khai Thiên/})).toBeEnabled();
  await page.keyboard.press('7');
  await expect(page.getByRole('heading',{name:'Một niệm hướng trường sinh'})).toBeVisible();
  await page.getByRole('button',{name:'Tiếp nối cốt truyện'}).click();
  await page.getByRole('button',{name:'Nhận thưởng & Tiếp tục'}).click();
  await expect(page.getByRole('heading',{name:'Dấu chân dưới tán trúc'})).toBeVisible();
  await nav(page,'Nhân vật').click();
  await page.getByRole('button',{name:'Đột phá',exact:true}).click();
  expect((await saved(page)).stage).toBe(2);
  const before=await saved(page);await page.reload();expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('inventory purchases, equipping, crafting and real character attributes work',async({page})=>{
  await leaveTraining(page);await nav(page,'Túi đồ').click();
  await page.locator('.bp-item[data-value="item-18"]').click();
  await page.locator('.bp-item-detail').getByRole('button',{name:'Trang bị',exact:true}).click();
  expect((await saved(page)).equipped.weapon).toBe('item-18');
  await page.getByRole('button',{name:'Thương hội',exact:true}).click();
  const gold=(await saved(page)).gold;
  await page.locator('.supply-row>div').first().getByRole('button').click();
  expect((await saved(page)).gold).toBe(gold-60);
  await page.getByRole('button',{name:'Đan phòng',exact:true}).click();
  const potions=(await saved(page)).potions;
  await page.locator('.recipe-card').first().getByRole('button',{name:'Khai lò luyện đan'}).click();
  expect((await saved(page)).potions).toBe(potions+1);
  await nav(page,'Nhân vật').click();await expect(page.locator('.stat-cell').filter({hasText:'Công kích'}).locator('b')).toHaveText('33');
});

test('world travel and local NPC dialogue open the corresponding service',async({page})=>{
  await leaveTraining(page);await nav(page,'Thế giới').click();
  const card=page.locator('.region-card').filter({has:page.getByRole('heading',{name:'Trúc Ảnh Lâm',exact:true})});
  await card.getByRole('button',{name:'Đi tới'}).click();expect((await saved(page)).region).toBe(1);
  await page.locator('.npc-card').nth(1).click();await expect(page.getByRole('dialog')).toBeVisible();
  for(let i=0;i<2;i++){
    await page.locator('[data-vn="reveal"]').click();
    await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  }
  await page.locator('[data-vn="reveal"]').click();
  await page.getByRole('button',{name:'Ghé Thương hội'}).click();await expect(page.locator('.supply-row')).toBeVisible();
  await nav(page,'Thế giới').click();expect(await page.locator('.region-card.locked').count()).toBe(8);
});

test('the codex searches all category entries and supports pagination',async({page})=>{
  await nav(page,/Vạn vật lục/).click();
  await expect(page.locator('.catalog-count')).toContainText('1.200');
  await page.getByRole('searchbox').fill('Huyền Giáp Quy');
  await expect(page.locator('.catalog-count')).toContainText('120');
  await page.getByRole('button',{name:'Tiếp →'}).click();await expect(page.locator('.pagination')).toContainText('2');
  await page.getByRole('searchbox').fill('không-có-yêu-thú-này');await expect(page.getByRole('heading',{name:'Chưa tìm thấy'})).toBeVisible();
  await page.locator('.catalog-sidebar').getByRole('button',{name:/Trang bị/}).click();
  await expect(page.locator('.catalog-count')).toContainText('1.800');
  await page.locator('.catalog-card').first().click();await expect(page.getByRole('dialog')).toBeVisible();
});

test('new techniques can be learned, swapped and used in a real encounter',async({page})=>{
  await leaveTraining(page);await nav(page,'Công pháp').click();
  const skill=page.locator('.skill-card').filter({has:page.getByRole('heading',{name:'Hàn Băng Chưởng',exact:true})});
  await skill.getByRole('button',{name:/Lĩnh ngộ/}).click();
  await page.locator('.loadout-slot').nth(1).click();await skill.getByRole('button',{name:'Trang bị công pháp'}).click();
  expect((await saved(page)).loadout).toContain('skill-2');
  await nav(page,'Động phủ').click();
  // An exploration may be a treasure or NPC encounter; continue until a monster actually appears.
  for(let i=0;i<12;i++){await page.getByRole('button',{name:'Khám phá',exact:true}).first().click();if((await saved(page)).combat)break;}
  expect((await saved(page)).combat?.type).toBe('monster');
  await expect(page.locator('.duel-monster')).toBeVisible();
  await page.getByRole('button',{name:/Hàn Băng Chưởng/}).click();
  expect((await saved(page)).mp).toBeLessThan(103);
});

test('renaming escapes text, settings persist and export contains a valid save',async({page})=>{
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.getByRole('button',{name:'Lâm Phong',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên gọi trên tiên lộ'}).fill('<b>Đạo Hữu</b>');
  await page.getByRole('button',{name:'Lưu đạo hiệu'}).click();
  expect((await saved(page)).name).toBe('<b>Đạo Hữu</b>');
  await expect(page.locator('.player-frame h3')).toHaveText('<b>Đạo Hữu</b>');expect(await page.locator('.player-frame h3 b').count()).toBe(0);
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất bản lưu'}).click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toBe('thien-dao-tien-lo.json');
  await page.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.reload();expect((await saved(page)).name).toBe('<b>Đạo Hữu</b>');
});

test('invalid imports are rejected, valid imports require confirmation and recover progress',async({page})=>{
  await page.keyboard.press('1');await page.waitForTimeout(420);
  const before=await saved(page);await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.locator('#save-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":999}')});
  await expect(page.locator('#toast')).toContainText('không hợp lệ');expect(await saved(page)).toEqual(before);
  const imported=structuredClone(before);imported.name='Vân Trường';
  await page.locator('#save-file').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Khôi phục hành trình?');
  expect((await saved(page)).name).toBe('Lâm Phong');
  await page.getByRole('button',{name:'Khôi phục bản lưu',exact:true}).click();expect((await saved(page)).name).toBe('Vân Trường');
});

test('every main view fits a mobile screen without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const label of ['Động phủ','Thế giới','Nhân vật','Túi đồ','Công pháp','Nhiệm vụ',/Vạn vật lục/]){
    await nav(page,label).click();
    const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
    if(await page.locator('.bp-window').count())await page.getByRole('button',{name:'Đóng hành trang',exact:true}).click();
  }
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
