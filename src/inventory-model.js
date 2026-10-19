import { ITEM_BY_ID, SKILL_BY_ID, SLOT_NAMES, REALMS } from './data.js';
import { VOWS } from './narrative.js';

export const INVENTORY_CATEGORIES = [
  ['all', 'Toàn bộ'], ['potions', 'Đan dược'], ['materials', 'Nguyên liệu'],
  ['equipment', 'Trang bị'], ['tools', 'Đạo cụ'], ['books', 'Sách'],
];

export const normalizeSearch = value => String(value).toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');

// Read-only projections of the existing save. No display-only items are granted to the player.
export function inventoryEntries(state) {
  const equipped = new Set(Object.values(state.equipped));
  const gear = state.inventory.map(id => ITEM_BY_ID[id]).filter(Boolean).map(item => ({
    ...item, kind: 'gear', category: 'equipment', quantity: 1, equipped: equipped.has(item.id),
    label: SLOT_NAMES[item.slot], art: item.slot,
  }));
  const supplies = [];
  if (state.potions > 0) supplies.push({ id: 'supply-potion', name: 'Linh đan', kind: 'potion', category: 'potions', quantity: state.potions, rarity: 2, art: 'potion', label: 'Đan dược', description: `Hồi ${state.narrative?.vow === 'compassion' ? 60 : 50}% sinh lực tối đa và 50 linh lực. Dùng trong giao tranh sẽ tiêu tốn một lượt.` });
  if (state.herbs > 0) supplies.push({ id: 'supply-herbs', name: 'Linh thảo', kind: 'material', category: 'materials', quantity: state.herbs, rarity: 1, art: 'herbs', label: 'Nguyên liệu', description: 'Linh thảo thu thập từ các vùng đất. Dùng cùng linh thạch để luyện đan tại Đan phòng.' });
  if (state.gold > 0) supplies.push({ id: 'currency-gold', name: 'Linh thạch', kind: 'currency', category: 'tools', quantity: state.gold, rarity: 1, art: 'crystal', label: 'Tiền tệ', description: 'Linh thạch hiện có của đạo hữu. Dùng để mua bán pháp khí, đổi công pháp, luyện đan và bố trí trận đột phá.' });
  if (state.jade > 0) supplies.push({ id: 'currency-jade', name: 'Tiên ngọc', kind: 'currency', category: 'tools', quantity: state.jade, rarity: 4, art: 'jade', label: 'Tiền tệ', description: 'Tiên ngọc nhận từ chính truyện và đột phá đại cảnh giới. Đổi Tụ Linh Phù tại Thương hội để tăng tu vi.' });
  const books = state.knownSkills.map(id => SKILL_BY_ID[id]).filter(Boolean).map(skill => ({ ...skill, kind: 'skill', category: 'books', quantity: 1, equipped: state.loadout.includes(skill.id), art: 'book', label: 'Bí tịch đã học' }));
  if (state.narrative?.introComplete) books.unshift({ id: 'manual-qi', name: 'Tụ Khí Quyết', kind: 'manual', category: 'books', quantity: 1, rarity: 1, art: 'scroll', equipped: true, label: 'Tâm pháp nhập môn', description: `Tâm pháp sư phụ truyền thụ để dẫn linh khí nhập thể. ${VOWS[state.narrative.vow]?.effect || 'Tĩnh tọa tại động phủ giúp hồi phục và tích lũy tu vi.'}` });
  return [...gear, ...supplies, ...books];
}

export function filterInventory(state, { category = 'all', search = '', slot = null } = {}) {
  const needle = normalizeSearch(search.trim());
  return inventoryEntries(state).filter(item =>
    (category === 'all' || item.category === category) &&
    (!slot || item.slot === slot) &&
    (!needle || normalizeSearch(`${item.name} ${item.label} ${item.description || ''} ${item.realm === undefined ? '' : REALMS[item.realm].name}`).includes(needle))
  );
}

export function equipmentComparison(state, item) {
  const current = ITEM_BY_ID[state.equipped[item.slot]];
  return Object.fromEntries(['attack', 'defense', 'hp'].map(key => [key, item[key] - (current?.[key] || 0)]));
}
