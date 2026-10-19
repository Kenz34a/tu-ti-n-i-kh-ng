import { ITEM_BY_ID, REALMS, RARITIES, SLOT_NAMES, SLOTS } from './data.js';
import { getStats, expRequired, realmLabel } from './engine.js';
import { VOWS } from './narrative.js';
import { inventoryEntries, filterInventory, equipmentComparison, INVENTORY_CATEGORIES } from './inventory-model.js';
import { itemArt } from './item-art.js';
import { icon } from './icons.js';
import './inventory.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => Math.round(value).toLocaleString('vi-VN');
const pageSize = 20;

export function createInventoryPanel({ root, getState, onAction, onExit, onNavigate, notify }) {
  let opened = false, mode = 'inventory', category = 'all', search = '', slot = null, page = 1, selected = null;
  let previousFocus = null, previousScroll = 0, suspendedRoots = [];
  const find = selector => root.querySelector(selector);
  const commandButton = (label, action, value = '', disabled = false, className = '') => `<button class="bp-button ${className}" data-bp="command" data-command="${action}" data-value="${escape(value)}" ${disabled ? 'disabled' : ''}>${label}</button>`;

  function meter(label, value, max, type) {
    return `<div class="bp-meter"><div><span>${label}</span><strong>${number(value)}<em>/${number(max)}</em></strong></div><div class="bp-track ${type}" role="progressbar" aria-label="${label}" aria-valuenow="${Math.min(max, value)}" aria-valuemin="0" aria-valuemax="${max}"><i style="width:${Math.min(100, value / max * 100)}%"></i></div></div>`;
  }

  function gearSlot(key) {
    const item = ITEM_BY_ID[getState().equipped[key]];
    return `<button class="bp-gear-slot ${item ? `filled ${RARITIES[item.rarity].class}` : ''}" data-bp="slot" data-value="${key}" aria-label="${SLOT_NAMES[key]}: ${escape(item?.name || 'Chưa trang bị')}" title="${escape(item?.name || SLOT_NAMES[key])}">${item ? itemArt(item.slot) : '<span class="bp-slot-plus">+</span>'}<small>${SLOT_NAMES[key]}</small></button>`;
  }

  function character() {
    const s = getState(), stats = getStats(s);
    return `<aside class="bp-character"><div class="bp-identity"><h3>${escape(s.name)}</h3><p>${realmLabel(s)}</p></div><div class="bp-paper-doll"><div class="bp-gear-column">${['armor', 'accessory', 'boots'].map(gearSlot).join('')}<button class="bp-gear-slot quick-slot" data-bp="quick" data-value="supply-potion" aria-label="Linh đan: ${s.potions} viên">${s.potions ? itemArt('potion') : '<span class="bp-slot-plus">+</span>'}<small>Đan dược</small>${s.potions ? `<em>${s.potions}</em>` : ''}</button></div><div class="bp-character-portrait" aria-label="Chân dung kiếm tu của đạo hữu" role="img"></div><div class="bp-gear-column">${['weapon', 'ring', 'talisman'].map(gearSlot).join('')}<button class="bp-gear-slot quick-slot" data-bp="quick" data-value="manual-qi" aria-label="Tâm pháp nhập môn">${s.narrative.introComplete ? itemArt('scroll') : '<span class="bp-slot-plus">+</span>'}<small>Tâm pháp</small></button></div></div><div class="bp-vitals">${meter('Sinh lực', s.hp, stats.hp, 'hp')}${meter('Linh lực', s.mp, stats.mp, 'mp')}${meter('Khí thế', s.qi, 100, 'qi')}${meter('Tu vi', s.exp, expRequired(s), 'exp')}</div><p class="bp-character-note">${s.combat ? icon('swords', '', 12) + ' Đang giao tranh · Không thể đổi trang bị' : icon('shield', '', 12) + ' Thanh Vân Môn · Kiếm tu'}</p></aside>`;
  }

  function currencies() {
    const s = getState();
    return `<div class="bp-currencies"><div class="bp-spirit-stones">${itemArt('crystal')}<span>Linh Thạch <strong>${number(s.gold)}</strong></span></div><span class="bp-jade">${icon('gem', '', 15)} ${number(s.jade)} <small>Tiên ngọc</small></span></div>`;
  }

  function inventoryView() {
    return `<div class="bp-items-view">${currencies()}<div class="bp-categories" aria-label="Loại vật phẩm">${INVENTORY_CATEGORIES.map(([id, label]) => `<button data-bp="category" data-value="${id}" aria-pressed="${category === id}" class="${category === id ? 'active' : ''}">${label}</button>`).join('')}</div><label class="bp-search">${icon('search', '', 16)}<input type="search" id="bp-search" placeholder="Tìm trong hành trang…" aria-label="Tìm trong hành trang" value="${escape(search)}" autocomplete="off"/><kbd>/</kbd></label><div class="bp-inventory-caption"></div><div class="bp-grid-wrap"><div class="bp-grid-scroll"><div class="bp-grid"></div></div><div class="bp-detail-root"></div></div><div class="bp-inventory-footer"></div></div>`;
  }

  function statsView() {
    const s = getState(), stats = getStats(s), vow = VOWS[s.narrative.vow];
    const attributes = [['sword', 'Công kích', stats.attack], ['shield', 'Phòng ngự', stats.defense], ['bolt', 'Bạo kích', `${stats.crit}%`], ['heart', 'Sinh lực tối đa', stats.hp], ['flame', 'Linh lực tối đa', stats.mp], ['leaf', 'Linh căn', 'Thiên linh căn']];
    return `<div class="bp-stats-view">${currencies()}<div class="bp-section-label"><span>THUỘC TÍNH ĐẠO HỮU</span><i></i></div><div class="bp-attribute-grid">${attributes.map(([symbol, label, value]) => `<div class="bp-attribute">${icon(symbol, '', 22)}<span>${label}<strong>${typeof value === 'number' ? number(value) : value}</strong></span></div>`).join('')}</div><p class="bp-stats-note">Chỉ số đã bao gồm hiệu quả của pháp khí đang mang.</p><div class="bp-section-label"><span>PHÁP KHÍ HỘ THÂN</span><i></i></div><div class="bp-worn-list">${SLOTS.map(key => { const item = ITEM_BY_ID[s.equipped[key]]; return `<button data-bp="worn" data-value="${key}"><span class="bp-worn-icon">${item ? itemArt(key) : icon('lock', '', 19)}</span><span><small>${SLOT_NAMES[key]}</small><b>${escape(item?.name || 'Chưa trang bị')}</b></span>${icon('chevron', '', 13)}</button>`; }).join('')}</div><div class="bp-dao-heart">${icon(vow?.icon || 'lotus', '', 25)}<span><strong>${vow ? `Đạo tâm ${vow.name}` : 'Đạo tâm tùy duyên'}</strong><small>${vow?.effect || 'Một kiếm trong tay, tiên lộ do mình lựa chọn.'}</small></span></div><div class="bp-journey-line"><span>Ngày tu hành <b>${s.day}</b></span><span>Yêu thú đã hạ <b>${s.counters.kills}</b></span><span>Nhiệm vụ <b>${s.claimed.length}</b></span></div></div>`;
  }

  function render() {
    const s = getState();
    const alreadyMounted = Boolean(root.firstElementChild);
    root.innerHTML = `<div class="bp-backdrop"><div class="bp-scenery" aria-hidden="true"><div class="bp-scene-location">${icon('arrow', '', 29)}<div><small>KHU VỰC HIỆN TẠI</small><strong>Động phủ</strong></div></div><div class="bp-scene-menus">${[['lotus', 'Tu luyện'], ['scroll', 'Công pháp'], ['bag', 'Túi đồ']].map(([symbol, label]) => `<span>${icon(symbol, '', 32)}<b>${label}</b></span>`).join('')}${icon('settings', '', 24)}</div><div class="bp-scene-hud"><div class="bp-hud-portrait"></div><div><small>~ ${realmLabel(s)} ~</small><h3>${escape(s.name)}</h3><p>Thanh Vân Môn <i>·</i> Kiếm tu</p>${meter('Sinh lực', s.hp, getStats(s).hp, 'hp')}${meter('Tu vi', s.exp, expRequired(s), 'exp')}</div></div></div><section class="bp-window" role="dialog" aria-modal="true" aria-labelledby="bp-title"><h2 class="sr-only" id="bp-title">Túi đồ</h2><span class="bp-frame-corner tl" aria-hidden="true"></span><span class="bp-frame-corner tr" aria-hidden="true"></span><span class="bp-frame-corner bl" aria-hidden="true"></span><span class="bp-frame-corner br" aria-hidden="true"></span><header class="bp-header"><div class="bp-mode-tabs" role="tablist" aria-label="Hành trang và chỉ số"><button id="bp-tab-inventory" role="tab" aria-selected="${mode === 'inventory'}" aria-controls="bp-panel" data-bp="mode" data-value="inventory" class="${mode === 'inventory' ? 'active' : ''}">Hành trang</button><button id="bp-tab-stats" role="tab" aria-selected="${mode === 'stats'}" aria-controls="bp-panel" data-bp="mode" data-value="stats" class="${mode === 'stats' ? 'active' : ''}">Chỉ số</button></div><span class="bp-title-flourish">TÚI CÀN KHÔN</span><button class="bp-close" data-bp="close" aria-label="Đóng hành trang" title="Đóng (Esc)">${icon('close', '', 31)}</button></header><div class="bp-body">${character()}<section id="bp-panel" role="tabpanel" aria-labelledby="bp-tab-${mode}" class="bp-main">${mode === 'inventory' ? inventoryView() : statsView()}</section></div><footer class="bp-bottom"><span>${icon('check', '', 11)} Tự động lưu sau mỗi thao tác</span><div><button data-bp="navigate" data-value="shop">${icon('coin', '', 13)} Thương hội</button><button data-bp="navigate" data-value="craft">${icon('potion', '', 13)} Đan phòng</button></div><span><kbd>I</kbd> Túi đồ <i>·</i> <kbd>Esc</kbd> Đóng</span></footer></section></div>`;
    if (alreadyMounted) root.firstElementChild.style.animation = 'none';
    if (mode === 'inventory') refreshItems();
  }

  function refreshItems() {
    if (!opened || mode !== 'inventory') return;
    const items = filterInventory(getState(), { category, search, slot });
    const pages = Math.max(1, Math.ceil(items.length / pageSize)); page = Math.min(page, pages);
    const visible = items.slice((page - 1) * pageSize, page * pageSize);
    find('.bp-inventory-caption').innerHTML = `${slot ? `<button class="bp-slot-filter" data-bp="clearSlot">${SLOT_NAMES[slot]} ${icon('close', '', 11)}</button>` : '<span>Vật phẩm đang sở hữu</span>'}<span>${items.length} loại vật phẩm</span>`;
    find('.bp-grid').innerHTML = `${visible.map(item => `<button class="bp-item ${RARITIES[item.rarity].class} ${selected === item.id ? 'selected' : ''}" data-bp="select" data-value="${item.id}" aria-label="${escape(item.name)}${item.quantity > 1 ? `, số lượng ${number(item.quantity)}` : ''}" aria-pressed="${selected === item.id}" title="${escape(item.name)}">${item.equipped ? '<span class="bp-equipped-badge" title="Đang trang bị">E</span>' : ''}${item.quantity > 1 ? `<span class="bp-item-quantity">${number(item.quantity)}</span>` : ''}${itemArt(item.art)}<strong>${escape(item.name.split(' · ')[0])}</strong></button>`).join('')}${Array.from({ length: Math.max(0, pageSize - visible.length) }, () => '<div class="bp-empty-slot" aria-hidden="true"><span>+</span></div>').join('')}`;
    if (!visible.length) find('.bp-grid').insertAdjacentHTML('beforeend', `<div class="bp-empty-message">${icon('search', '', 25)}<strong>${search ? 'Không tìm thấy vật phẩm' : 'Chưa có vật phẩm phù hợp'}</strong><p>${search ? 'Thử một từ khóa khác hoặc đổi nhóm vật phẩm.' : 'Khám phá hoặc ghé Thương hội để bổ sung hành trang.'}</p></div>`);
    find('.bp-inventory-footer').innerHTML = `<span>${inventoryEntries(getState()).length} loại đang mang theo</span><div><button data-bp="page" data-value="${page - 1}" aria-label="Trang vật phẩm trước" ${page <= 1 ? 'disabled' : ''}>${icon('chevron', 'bp-rotate', 14)}</button><span>${page} <em>/ ${pages}</em></span><button data-bp="page" data-value="${page + 1}" aria-label="Trang vật phẩm tiếp" ${page >= pages ? 'disabled' : ''}>${icon('chevron', '', 14)}</button></div>`;
    renderDetail();
  }

  function renderDetail() {
    const detail = find('.bp-detail-root'); if (!detail) return;
    const item = inventoryEntries(getState()).find(entry => entry.id === selected);
    if (!item) { selected = null; detail.innerHTML = ''; return; }
    const s = getState(), rare = RARITIES[item.rarity];
    let content = '', actions = '', restriction = '';
    if (item.kind === 'gear') {
      const compare = equipmentComparison(s, item);
      content = `<div class="bp-detail-stats">${[['attack', 'Công kích'], ['defense', 'Phòng ngự'], ['hp', 'Sinh lực']].map(([key, label]) => `<span>${label}<b>+${number(item[key])}</b>${!item.equipped && compare[key] ? `<em class="${compare[key] > 0 ? 'gain' : 'loss'}">${compare[key] > 0 ? '+' : ''}${number(compare[key])}</em>` : ''}</span>`).join('')}</div>`;
      restriction = s.combat ? 'Không thể đổi trang bị khi đang giao tranh.' : item.realm > s.realm ? `Cần đạt ${REALMS[item.realm].name} để trang bị.` : '';
      actions = commandButton(item.equipped ? 'Tháo trang bị' : 'Trang bị', item.equipped ? 'unequip' : 'equip', item.equipped ? item.slot : item.id, Boolean(restriction), 'bp-primary') + commandButton(`Bán · ${number(Math.floor(item.price * .4))}`, 'sell', item.id, item.equipped);
    } else if (item.kind === 'potion') {
      actions = commandButton('Dùng Linh đan', 'potion', '', s.hp >= getStats(s).hp && s.mp >= getStats(s).mp, 'bp-primary');
    } else if (item.kind === 'material') actions = '<button class="bp-button bp-primary" data-bp="navigate" data-value="craft">Đến Đan phòng</button>';
    else if (item.kind === 'currency') actions = '<button class="bp-button bp-primary" data-bp="navigate" data-value="shop">Đến Thương hội</button>';
    else if (item.kind === 'skill') {
      content = `<div class="bp-technique-info"><span>${item.cost} linh lực</span><span>${item.type === 'attack' ? `${item.multiplier.toFixed(1)}× công kích` : item.type === 'heal' ? 'Hồi 38% sinh lực' : 'Hộ thể giảm sát thương'}</span></div>`;
      restriction = s.combat ? 'Không thể đổi công pháp giữa trận.' : !item.equipped && s.loadout.length >= 3 ? 'Đã mang đủ 3 công pháp. Gỡ một công pháp để thay thế.' : '';
      actions = commandButton(item.equipped ? 'Gỡ khỏi xuất trận' : 'Mang ra xuất trận', 'loadout', item.id, Boolean(restriction), 'bp-primary');
    } else if (item.kind === 'manual') actions = '<button class="bp-button" data-bp="navigate" data-value="cultivation">Xem tu luyện</button>';
    detail.innerHTML = `<section class="bp-item-detail ${rare.class}" aria-label="Chi tiết ${escape(item.name)}"><button class="bp-detail-close" data-bp="closeDetail" aria-label="Đóng chi tiết vật phẩm">${icon('close', '', 17)}</button><div class="bp-detail-identity">${itemArt(item.art)}<span><small>${rare.name} · ${item.label}</small><h3>${escape(item.name)}</h3>${item.realm !== undefined ? `<em>${REALMS[item.realm].name}</em>` : `<em>Số lượng: ${number(item.quantity)}</em>`}</span></div><p>${escape(item.description)}</p>${content}${restriction ? `<p class="bp-restriction">${icon('lock', '', 12)} ${restriction}</p>` : ''}<div class="bp-detail-actions">${actions}</div></section>`;
  }

  function select(id) { selected = id; refreshItems(); find('.bp-detail-close')?.focus({ preventScroll: true }); }
  function open(options = {}) {
    if (opened) return;
    opened = true; mode = options.mode || 'inventory'; category = 'all'; search = ''; slot = null; selected = null; page = 1;
    previousFocus = document.activeElement; previousScroll = window.scrollY;
    suspendedRoots = ['#app', '#story-root'].map(selector => { const element = document.querySelector(selector); const record = { element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }; element.inert = true; element.setAttribute('aria-hidden', 'true'); return record; });
    document.body.classList.add('inventory-open'); render(); find('.bp-close').focus({ preventScroll: true });
  }

  function close() {
    if (!opened) return;
    opened = false; root.innerHTML = ''; document.body.classList.remove('inventory-open');
    for (const { element, inert, hidden } of suspendedRoots) { element.inert = inert; if (hidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', hidden); }
    suspendedRoots = []; onExit(); window.scrollTo(0, previousScroll);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    else document.querySelector('.nav-item.active')?.focus({ preventScroll: true });
  }

  root.addEventListener('input', event => { if (event.target.id === 'bp-search') { search = event.target.value; page = 1; selected = null; refreshItems(); } });
  root.addEventListener('click', event => {
    if (event.target.classList.contains('bp-backdrop')) { close(); return; }
    const target = event.target.closest('[data-bp]'); if (!target || target.disabled) return;
    event.preventDefault(); event.stopPropagation();
    const value = target.dataset.value;
    switch (target.dataset.bp) {
      case 'close': close(); break;
      case 'mode': mode = value; selected = null; render(); find(`#bp-tab-${mode}`).focus(); break;
      case 'category': category = value; slot = null; page = 1; selected = null; render(); find(`[data-bp="category"][data-value="${category}"]`).focus(); break;
      case 'select': select(value); break;
      case 'closeDetail': { const id = selected; selected = null; refreshItems(); find(`[data-bp="select"][data-value="${id}"]`)?.focus({ preventScroll: true }); break; }
      case 'slot': case 'worn': {
        mode = 'inventory'; const id = getState().equipped[value];
        if (id) { category = 'all'; slot = null; search = ''; selected = id; page = 1; render(); find('.bp-detail-close')?.focus(); }
        else { category = 'equipment'; slot = value; search = ''; page = 1; selected = null; render(); find('#bp-search').focus(); }
        break;
      }
      case 'quick': { mode = 'inventory'; category = value === 'supply-potion' ? 'potions' : 'books'; search = ''; page = 1; slot = null; selected = value; render(); find('.bp-detail-close')?.focus(); break; }
      case 'clearSlot': slot = null; selected = null; page = 1; refreshItems(); find('#bp-search').focus(); break;
      case 'page': page = Number(value); selected = null; refreshItems(); find('.bp-grid-scroll').scrollTop = 0; find('.bp-item')?.focus(); break;
      case 'command': {
        const response = onAction(target.dataset.command, value);
        if (!response) { notify('Đợi chiêu thức hiện tại kết thúc rồi thử lại.', true); break; }
        if (response.ok) { render(); (find('.bp-detail-close') || find('.bp-close')).focus({ preventScroll: true }); }
        break;
      }
      case 'navigate': close(); onNavigate(value); break;
    }
  });

  function handleKey(event) {
    if (!opened) return false;
    if (event.key === 'Escape') { event.preventDefault(); if (selected) { const id = selected; selected = null; refreshItems(); (find(`[data-bp="select"][data-value="${id}"]`) || find('.bp-close')).focus({ preventScroll: true }); } else close(); return true; }
    const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (!input && event.key.toLowerCase() === 'i' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); close(); return true; }
    if (event.key === '/' && !input && mode === 'inventory') { event.preventDefault(); find('#bp-search').focus(); return true; }
    if (event.key === 'Tab') {
      const elements = [...root.querySelectorAll('button:not(:disabled),input')].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    return true;
  }

  return { open, close, handleKey, get active() { return opened; } };
}
