import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles.css';
import { CATALOG, CATEGORY_NAMES, CONTENT_COUNT, REALMS, REGIONS, MONSTERS, NPCS, EQUIPMENT, SKILLS, QUESTS, RECIPES, STORY, RARITIES, ITEM_BY_ID, SKILL_BY_ID, SLOTS, SLOT_NAMES, GOAL_NAMES } from './data.js';
import { SAVE_KEY, newGame, parseSave, dispatch, getStats, expRequired, realmLabel, questProgress, isQuestReady } from './engine.js';
import { icon, slotIcon } from './icons.js';
import { VOWS } from './narrative.js';
import { createStoryPlayer } from './story-player.js';
import { createInventoryPanel } from './inventory-panel.js';
import { createCultivationPanel } from './cultivation-panel.js';
import { battleScreen, battleControls, animateBattle } from './battle-screen.js';
import { monsterTraits, monsterProfile, enemyIntent, skillDiscipline, DISCIPLINES } from './combat-rules.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = n => Math.round(n).toLocaleString('vi-VN');
const pct = (n, max) => Math.min(100, Math.max(0, n / max * 100));
const button = (text, action, value = '', type = '', disabled = false) => `<button class="btn ${type}" data-action="${action}" data-value="${esc(value)}" ${disabled ? 'disabled' : ''}>${text}</button>`;
let state, restoreWarning = '';
try { const raw = localStorage.getItem(SAVE_KEY); state = raw ? parseSave(raw) : newGame(); }
catch { state = newGame(); restoreWarning = 'Không đọc được bản lưu cũ. Đã mở hành trình mới; bản lưu cũ được giữ lại cho tới thao tác tiếp theo.'; }
const ui = { tab: 'abode', catalog: 'monsters', search: '', page: 1, mapPage: 0, bagTab: 'inventory', itemFilter: 'all', skillFilter: 'all', questTab: 'story', logOpen: true, busy: false, battleExpanded: true, duelLogOpen: false };
const tabs = [ ['abode', 'home', 'Động phủ'], ['world', 'compass', 'Thế giới'], ['character', 'person', 'Nhân vật'], ['inventory', 'bag', 'Túi đồ'], ['skills', 'book', 'Công pháp'], ['quests', 'scroll', 'Nhiệm vụ'], ['codex', 'archive', 'Vạn vật lục'] ];
let toastTimer, battleTimer, audioContext;
const storyPlayer = createStoryPlayer({
  root: document.querySelector('#story-root'), getState: () => state, save,
  onExit: render, onSettings: settings, notify: toast,
  onShortcut: tab => { if (tab === 'inventory') { inventoryPanel.open(); return; } if (tab === 'cultivation') { cultivationPanel.open(); return; } ui.tab = tab; render(); window.scrollTo(0, 0); },
  onService: role => {
    if (role === 'Trưởng lão') { ui.tab = 'abode'; doAction('training'); }
    else if (role === 'Thương nhân' || role === 'Luyện đan sư') { ui.tab = 'inventory'; ui.bagTab = role === 'Thương nhân' ? 'shop' : 'craft'; render(); }
    else { ui.tab = 'quests'; ui.questTab = 'commission'; render(); }
    window.scrollTo(0, 0);
  },
});
const inventoryPanel = createInventoryPanel({
  root: document.querySelector('#inventory-root'), getState: () => state,
  onAction: doAction, onExit: render, notify: toast,
  onNavigate: destination => {
    if (destination === 'cultivation') { cultivationPanel.open(); return; }
    if (storyPlayer.active) storyPlayer.close();
    if (destination === 'shop' || destination === 'craft') { ui.tab = 'inventory'; ui.bagTab = destination; }
    else ui.tab = destination;
    render(); window.scrollTo(0, 0);
  },
});
const cultivationPanel = createCultivationPanel({ root: document.querySelector('#cultivation-root'), getState: () => state, onAction: doAction, onExit: render });
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
  catch { toast('Bộ nhớ trình duyệt không khả dụng. Hãy xuất bản lưu ở Cài đặt.', true); return false; }
}
function toast(text, error = false) {
  const el = $('#toast'); el.textContent = text; el.className = `visible ${error ? 'error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = '', 3600);
}
function playTone(kind) {
  if (!state.settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.type = kind === 'attack' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'attack' ? 330 : 660, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'attack' ? 100 : 880, audioContext.currentTime + 0.15);
    gain.gain.setValueAtTime(0.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.24);
    oscillator.start(); oscillator.stop(audioContext.currentTime + 0.25);
  } catch { /* Sound is optional; gameplay is independent of audio support. */ }
}
function header() {
  const ready = STORY[state.storyIndex] && isQuestReady(state, QUESTS[state.storyIndex]);
  return `<header class="topbar">
    <a class="brand" href="#" data-action="tab" data-value="abode" aria-label="Thiên Đạo — Động phủ"><span class="brand-seal">${icon('mountain', '', 27)}</span><span><strong>THIÊN ĐẠO</strong><small>PHÀM NHÂN VẤN TIÊN</small></span></a>
    <div class="server-label"><span class="status-dot"></span> Cửu Châu Đại Lục <span class="server-tag">ĐƠN NHÂN</span></div>
    <div class="header-right"><span class="game-clock">${icon('sun', '', 17)} Giờ ${['Thìn', 'Tỵ', 'Ngọ', 'Mùi'][Math.floor(state.turns / 2) % 4]} <span>·</span> Ngày ${String(state.day).padStart(2, '0')}</span>
      <div class="currency gold" title="Linh thạch — mua trang bị, công pháp, luyện đan">${icon('coin', '', 19)}<strong>${fmt(state.gold)}</strong><span>Linh thạch</span></div>
      <div class="currency jade" title="Tiên ngọc — đổi Tụ Linh Phù tại Thương hội">${icon('gem', '', 19)}<strong>${fmt(state.jade)}</strong></div>
      <span class="header-divider"></span><button class="icon-btn" data-action="sound" aria-label="${state.settings.sound ? 'Tắt' : 'Bật'} âm thanh" title="Âm thanh">${icon(state.settings.sound ? 'sound' : 'mute')}</button>
      <button class="icon-btn" data-action="settings" aria-label="Cài đặt" title="Cài đặt">${icon('settings')}</button><button class="profile-avatar" data-action="tab" data-value="character" aria-label="Hồ sơ nhân vật">${esc(state.name.charAt(0))}</button>
    </div></header>
    <nav class="main-nav" aria-label="Điều hướng chính">${tabs.map(([id, ico, label]) => `<button class="nav-item ${ui.tab === id ? 'active' : ''}" data-action="tab" data-value="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>${icon(ico, '', 18)}<span>${label}</span>${id === 'quests' && ready ? '<i class="notification-dot"></i>' : ''}${id === 'codex' ? '<small>5.000</small>' : ''}</button>`).join('')}<span class="nav-end">${icon('leaf', '', 14)} Tâm tĩnh · Đạo tự thành</span></nav>`;
}
function pageHeading(eyebrow, title, subtitle, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="heading-actions">${actions}</div></div>`;
}
function meter(label, value, max, type, showText = true) {
  return `<div class="meter-group"><div class="meter-label"><span>${label}</span>${showText ? `<b>${fmt(value)} <em>/ ${fmt(max)}</em></b>` : ''}</div><div class="meter-track ${type}" role="progressbar" aria-label="${label}" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${Math.round(max)}"><i style="width:${pct(value, max)}%"></i></div></div>`;
}
function characterFrame(isEnemy = false) {
  const stats = getStats(state), c = state.combat;
  if (isEnemy) return `<div class="fighter-frame enemy-frame ornamental"><div class="fighter-top"><span class="faction-tag">${c?.type === 'monster' ? (c.boss ? 'THỦ LĨNH' : 'YÊU THÚ') : 'TRUYỀN CÔNG TRƯỞNG LÃO'}</span>${icon(c?.type === 'monster' ? 'skull' : 'swords', '', 15)}</div><h3>${esc(c?.name || 'Mặc Vô Trần')}</h3><span class="fighter-realm">${c?.type === 'monster' ? realmLabel({realm:c.realm,stage:Math.max(1,c.region % 4+1)}) : 'Cảnh giới sâu không lường'}</span>${meter('Sinh lực', c?.hp ?? 9999, c?.maxHp ?? 9999, 'health')}<div class="enemy-note">${icon(c?.type === 'monster' ? 'flame' : 'shield', '', 12)} ${c?.type === 'monster' ? 'Cẩn thận trước khí tức của yêu thú' : 'Sư phụ sẽ bảo hộ ngươi'}</div></div>`;
  return `<div class="fighter-frame player-frame ornamental"><div class="fighter-top"><span class="faction-tag">THANH VÂN MÔN</span><span class="you-tag">NGƯƠI</span></div><h3>${esc(state.name)}</h3><span class="fighter-realm">${realmLabel(state)}</span>${meter('Sinh lực', state.hp, stats.hp, 'health')}${meter('Linh lực', state.mp, stats.mp, 'mana')}${meter('Khí thế', state.qi, 100, 'energy')}</div>`;
}
function battleActions() {
  const c = state.combat;
  const attackButtons = `<button class="combat-action basic-attack" data-action="attack" ${!c || ui.busy ? 'disabled' : ''}><kbd>1</kbd><span class="action-symbol">${icon('swords', '', 27)}</span><strong>Tấn công</strong><small>Tích 25 Khí thế</small></button>
    ${state.loadout.map((id, i) => { const skill = SKILL_BY_ID[id]; return `<button class="combat-action skill-action skill-${i}" data-action="skill" data-value="${id}" ${!c || state.mp < skill.cost || ui.busy ? 'disabled' : ''}><kbd>${i + 2}</kbd><span class="action-symbol">${icon(skill.type === 'heal' ? 'lotus' : skill.type === 'shield' ? 'shield' : i ? 'flame' : 'sword', '', 26)}</span><strong>${esc(skill.name.split(' · ')[0])}</strong><small>${skill.cost} linh lực</small></button>`; }).join('')}
    <span class="action-separator"></span><button class="combat-action guard-action" data-action="guard" ${!c || ui.busy ? 'disabled' : ''}><kbd>5</kbd><span class="action-symbol">${icon('shield', '', 26)}</span><strong>Phòng thủ</strong><small>Giảm 70% sát thương</small></button>
    <button class="combat-action potion-action" data-action="potion" ${!state.potions || ui.busy ? 'disabled' : ''}><kbd>6</kbd><span class="action-symbol">${icon('potion', '', 26)}<em>${state.potions}</em></span><strong>Linh đan</strong><small>Hồi máu & linh lực</small></button>
    <button class="combat-action ultimate-action ${state.qi >= 100 ? 'charged' : ''}" data-action="ultimate" ${!c || state.qi < 100 || ui.busy ? 'disabled' : ''}><kbd>7</kbd><span class="action-symbol">${icon('bolt', '', 29)}</span><strong>Nhất Kiếm Khai Thiên</strong><small>${state.qi}/100 Khí thế</small></button>`;
  return `<div class="combat-controls"><div class="control-heading"><span><i class="tiny-diamond"></i> CHIÊU THỨC</span><small>${icon('help', '', 12)} Dùng phím 1–7 để thi triển</small></div><div class="action-bar">${attackButtons}</div></div>`;
}
function abode() {
  const c = state.combat, stats = getStats(state), story = STORY[state.storyIndex], ready = story && isQuestReady(state, QUESTS[state.storyIndex]);
  return `${pageHeading(`${icon('pin', '', 12)} ${esc(REGIONS[state.region].name.toUpperCase())} <span>/</span> ${c ? 'LUẬN KIẾM ĐÀI' : 'ĐỘNG PHỦ'}`, c ? (c.type === 'training' ? 'Sư phụ chỉ điểm' : 'Yêu thú xuất thế') : 'Một niệm hướng trường sinh', c ? 'Đường tu tiên vạn dặm, bắt đầu từ một đường kiếm.' : 'Tạm gác phong trần, tĩnh tâm tìm đạo.', `${button(icon('help', '', 15) + ' Hướng dẫn', 'help', '', 'quiet')}${c ? button('Rời trận ' + icon('arrow', '', 15), 'flee', '', 'outline') : button(icon('compass', '', 15) + ' Khám phá', 'explore', '', 'gold')}`)}
    <section class="battle-scene ${c?.type === 'monster' ? 'monster-scene' : ''} ${!c ? 'peaceful-scene' : ''}" aria-label="${c ? 'Đấu trường' : 'Động phủ'}">
      <div class="scene-vignette"></div><div class="scene-grain"></div><div class="mobile-fighters" aria-hidden="true"><div class="mobile-fighter left"></div><div class="mobile-fighter right"></div></div><div class="motes"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      ${characterFrame()}${c ? characterFrame(true) : ''}
      ${c ? `<div class="round-indicator"><div class="round-diamond"><span>${String(c.turn).padStart(2, '0')}</span></div><span class="round-label">LƯỢT GIAO TRANH</span><div class="turn-pill"><span class="status-dot"></span> Đến lượt ngươi</div></div>` : `<div class="peaceful-message"><span class="small-rule"></span><small>TIÊN LỘ CÒN DÀI</small><h2>Đạo ở trong tâm</h2><p>${ready ? 'Sư phụ đã công nhận ngươi.<br>Hãy nhận thưởng để mở chương truyện tiếp theo.' : 'Một hơi thở, một vòng thiên địa.<br>Hôm nay, ngươi muốn viết tiếp tiên lộ thế nào?'}</p>${ready ? button('Tiếp nối cốt truyện ' + icon('arrow', '', 15), 'storyReward', '', 'gold') : button(icon('lotus', '', 17) + ' Tĩnh tâm tu luyện', 'cultivation', '', 'gold')}</div>`}
      <div id="battle-fx" aria-hidden="true"></div>
      <div class="fighter-caption player-caption"><span class="caption-line"></span><strong>${esc(state.name)}</strong><small>Đệ tử Thanh Vân</small></div>
      ${c ? `<div class="fighter-caption enemy-caption"><span class="caption-line"></span><strong>${esc(c.name)}</strong><small>${c.type === 'training' ? 'Một kiếm trấn sơn hà' : (c.boss ? 'Thủ lĩnh của vùng' : 'Linh thú hóa yêu')}</small></div>` : ''}
      <div class="scene-footer"><span>${icon('leaf', '', 13)} Linh khí nồng độ <b>${128 + state.realm * 12}%</b></span><span>${icon('eye', '', 13)} ${c?.type === 'monster' ? 'Dã ngoại · Sinh tử do mình' : 'Luận kiếm · Không tổn hại căn cơ'}</span><button class="scene-button" data-action="logToggle">${icon('scroll', '', 14)} Nhật ký trận ${icon('down', ui.logOpen ? 'rotate' : '', 12)}</button></div>
    </section>
    ${c ? `<div class="battle-hint">${icon('help', '', 15)} <span>${c.type === 'training' ? 'Tấn công hoặc dùng công pháp để tích Khí thế. Đủ 100 điểm, thi triển tuyệt kỹ để hoàn thành chỉ điểm.' : 'Phòng thủ để hồi linh lực. Hãy dùng Linh đan khi sinh lực xuống thấp — mỗi lựa chọn đều đổi lấy một lượt.'}</span><span class="hint-tag">${c.type === 'training' ? 'TÂN THỦ' : 'THỰC CHIẾN'}</span></div>` : ''}
    <div class="battle-bottom ${!c ? 'peaceful-bottom' : ''}"><section class="battle-log panel ${ui.logOpen ? '' : 'collapsed'}"><div class="panel-heading"><h2>${icon('scroll', '', 16)} ${c ? 'Nhật ký giao tranh' : 'Nhật ký tiên lộ'}</h2><span class="live-label"><span class="status-dot"></span> ${c ? 'ĐANG GIAO TRANH' : 'BÌNH YÊN'}</span></div><div class="log-lines" aria-live="polite">${state.logs.slice(-4).map((l, i, arr) => `<p class="log-line ${esc(l.tone)} ${i === arr.length - 1 ? 'latest' : ''}"><span class="log-mark">${l.tone === 'reward' ? '✦' : '›'}</span>${esc(l.text)}</p>`).join('')}</div></section>${c ? battleActions() : `<div class="abode-shortcuts panel"><button data-action="cultivation">${icon('lotus', '', 25)}<strong>Tu luyện</strong><small>Hồi phục · Tăng tu vi</small></button><button data-action="training">${icon('swords', '', 25)}<strong>Thỉnh giáo</strong><small>Cùng sư phụ luận kiếm</small></button><button data-action="explore">${icon('compass', '', 25)}<strong>Khám phá</strong><small>Tìm kiếm cơ duyên</small></button><button data-action="bagTab" data-value="craft">${icon('potion', '', 25)}<strong>Luyện đan</strong><small>Đan thành · Đạo tiến</small></button></div>`}</div>
    <section class="cultivation-strip"><div class="cultivation-icon">${icon('lotus', '', 28)}</div><div class="cultivation-identity"><small>CẢNH GIỚI HIỆN TẠI</small><strong>${realmLabel(state)}</strong></div><div class="cultivation-progress"><div><span>Tu vi tích lũy</span><b>${fmt(state.exp)} <em>/ ${fmt(expRequired(state))}</em></b></div><div class="cultivation-track"><i style="width:${pct(state.exp, expRequired(state))}%"></i></div></div>${button(icon('bolt', '', 15) + ' Đột phá cảnh giới', 'breakthrough', '', state.exp >= expRequired(state) ? 'gold' : 'outline', Boolean(c))}<div class="next-realm"><small>TIÊN LỘ KẾ TIẾP</small><span>${state.stage === 9 ? (REALMS[state.realm + 1]?.name || 'Đỉnh cao tiên đạo') : `${REALMS[state.realm].name} · Tầng ${state.stage + 1}`}${icon('chevron', '', 13)}</span></div></section>
    <div class="world-teaser"><span>${icon('scroll', '', 15)} <b>CHƯƠNG ${String(Math.min(state.storyIndex + 1, 20)).padStart(2, '0')}</b><i></i>${esc(story?.title || 'Tiên lộ không có hồi kết')}</span><button data-action="tab" data-value="quests">${ready ? 'Nhận thưởng' : 'Theo dõi cốt truyện'} ${icon('arrow', '', 15)}</button></div>`;
}
function world() {
  const regions = REGIONS.slice(ui.mapPage * 12, ui.mapPage * 12 + 12), localNpcs = NPCS.filter(n => n.region === state.region);
  return `${pageHeading('SƠN HÀ VẠN DẶM', 'Cửu Châu Đại Lục', 'Đi qua nhân gian, tìm lấy cơ duyên của chính mình.', button(icon('compass', '', 16) + ' Khám phá vùng hiện tại', 'explore', '', 'gold'))}
    <div class="world-banner panel"><div>${icon('pin', '', 27)}<span><small>NGƯƠI ĐANG Ở</small><h2>${esc(REGIONS[state.region].name)}</h2><p>${esc(REGIONS[state.region].description)}</p></span></div><div class="world-facts"><span><b>${state.discovered.length}<em>/120</em></b>Vùng đã đặt chân</span><span><b>${state.counters.kills}</b>Yêu thú đã hạ</span><span><b>${state.counters.explorations}</b>Lần khám phá</span></div></div>
    <div class="section-title"><h2>${icon('mountain', '', 19)} Bản đồ tiên vực</h2><span>Đạt cảnh giới tương ứng để mở vùng đất mới</span></div>
    <div class="region-grid">${regions.map((r, i) => { const locked = r.realm > state.realm, active = state.region === Number(r.id.split('-')[1]); return `<article class="region-card ${locked ? 'locked' : ''} ${active ? 'current' : ''} terrain-${i % 4}"><div class="region-art"><div class="mountain-silhouette back"></div><div class="mountain-silhouette front"></div><span class="region-status">${locked ? icon('lock', '', 12) + ' CHƯA KHAI MỞ' : active ? '<i class="status-dot"></i> ĐANG Ở ĐÂY' : r.label}</span><div class="region-symbol">${icon(['mountain', 'tree', 'snow', 'sword'][i % 4], '', 37)}</div><span class="region-number">${String(ui.mapPage * 12 + i + 1).padStart(2, '0')}</span></div><div class="region-info"><small>${REALMS[r.realm].name.toUpperCase()} <span>·</span> ${r.element}</small><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div><span>${icon('skull', '', 13)} 10 yêu thú ${icon('person', '', 13)} 5 kỳ nhân</span>${button(locked ? icon('lock', '', 13) : active ? 'Khám phá' + icon('arrow', '', 13) : 'Đi tới' + icon('arrow', '', 13), active ? 'explore' : 'travel', r.id, 'small outline', locked)}</div></div></article>`; }).join('')}</div>
    ${pagination(ui.mapPage + 1, 10, 'mapPage')}
    <div class="section-title"><h2>${icon('person', '', 19)} Kỳ nhân tại ${esc(REGIONS[state.region].name)}</h2><span>Trò chuyện mỗi ngày để kết thiện duyên</span></div><div class="npc-grid">${localNpcs.map((n, i) => `<button class="npc-card panel" data-action="talk" data-value="${n.id}"><span class="npc-avatar npc-${i}">${icon(['sword', 'coin', 'potion', 'compass', 'key'][i], '', 27)}</span><small>${esc(n.role)}</small><strong>${esc(n.name)}</strong><span>${icon('heart', '', 12)} Thiện cảm ${state.relationships[n.id] || 0}</span><em>Trò chuyện ${icon('chat', '', 13)}</em></button>`).join('')}</div>`;
}
function character() {
  const stats = getStats(state);
  return `${pageHeading('VẤN TÂM · VẤN ĐẠO', 'Hồ sơ đạo hữu', 'Luyện thân, dưỡng khí, giữ một đạo tâm không đổi.', button('Đổi đạo hiệu', 'rename', '', 'outline'))}<div class="character-layout"><section class="character-panel panel"><span class="eyebrow">ĐỆ TỬ THANH VÂN MÔN</span><h2>${esc(state.name)}</h2><p class="gold-text">${realmLabel(state)}</p><div class="character-art"><div class="character-halo"></div><img src="/art/duel-cavern.webp" alt="Kiếm tu trong động phủ Thanh Vân"/><div class="gear-slots">${SLOTS.map(slot => { const item = ITEM_BY_ID[state.equipped[slot]]; return `<button class="gear-slot ${item ? RARITIES[item.rarity].class : ''}" data-action="${item ? 'itemDetail' : 'tab'}" data-value="${item?.id || 'inventory'}" title="${esc(item?.name || SLOT_NAMES[slot])}">${icon(slotIcon(slot), '', 25)}<small>${SLOT_NAMES[slot]}</small></button>`; }).join('')}</div></div><div class="character-motto">“Tiên lộ dài, đạo tâm không đổi.”</div></section><div><section class="panel stats-panel"><div class="panel-heading"><h2>${icon('person', '', 17)} Thuộc tính nhân vật</h2><span>CĂN CƠ VỮNG CHẮC</span></div><div class="stat-grid">${[['heart', 'Sinh lực tối đa', stats.hp], ['flame', 'Linh lực tối đa', stats.mp], ['sword', 'Công kích', stats.attack], ['shield', 'Phòng ngự', stats.defense], ['bolt', 'Bạo kích', `${stats.crit}%`], ['leaf', 'Linh căn', 'Thiên linh căn']].map(([ico, title, value]) => `<div class="stat-cell">${icon(ico, '', 22)}<span>${title}<b>${typeof value === 'number' ? fmt(value) : value}</b></span></div>`).join('')}</div></section><section class="panel journey-panel"><div class="panel-heading"><h2>${icon('compass', '', 17)} Dấu chân tiên lộ</h2></div><div class="journey-stats">${[['Ngày tu hành', state.day], ['Yêu thú đã hạ', state.counters.kills], ['Lần tu luyện', state.counters.meditations], ['Nhiệm vụ hoàn thành', state.claimed.length], ['Công pháp lĩnh ngộ', state.knownSkills.length], ['Vùng đất khám phá', state.discovered.length]].map(([a,b]) => `<span>${a}<b>${fmt(b)}</b></span>`).join('')}</div></section><section class="panel cultivation-panel"><h2>${icon('lotus', '', 21)} Tu luyện & Đột phá</h2><p>Mỗi cảnh giới có 9 tầng. Đủ tu vi và linh thạch, dùng Tụ Linh Trận để đột phá. Không có xác suất thất bại.</p>${meter('Tu vi', state.exp, expRequired(state), 'energy')}<div class="button-row">${button(icon('lotus', '', 16) + ' Tu luyện', 'cultivation', '', 'outline')}${button(icon('bolt', '', 16) + ' Đột phá', 'breakthrough', '', 'gold')}</div><small>Chi phí đột phá: ${fmt(Math.round((50 + state.stage * 20) * Math.pow(1.5, state.realm)))} linh thạch</small></section></div></div><div class="section-title"><h2>Ba mươi trọng thiên</h2><span>Mỗi cảnh giới là một chân trời mới</span></div><div class="realm-timeline">${REALMS.map((r,i) => `<div class="realm-node ${i < state.realm ? 'completed' : i === state.realm ? 'current' : ''}"><span>${i < state.realm ? icon('check', '', 14) : String(i+1).padStart(2,'0')}</span><strong>${r.name}</strong><small>${i < state.realm ? 'ĐÃ VIÊN MÃN' : i === state.realm ? 'ĐANG TU LUYỆN' : 'CHƯA ĐẠT'}</small></div>`).join('')}</div>`;
}
function itemCard(item, shop = false) {
  const equipped = Object.values(state.equipped).includes(item.id), owned = state.inventory.includes(item.id), rare = RARITIES[item.rarity];
  return `<article class="item-card panel ${rare.class}"><div class="item-card-top"><span class="rarity-label">${rare.name}</span><span>${SLOT_NAMES[item.slot]}</span></div><button class="item-illustration" data-action="itemDetail" data-value="${item.id}" aria-label="Xem ${esc(item.name)}">${icon(slotIcon(item.slot), '', 44)}</button><h3>${esc(item.name)}</h3><small>${REALMS[item.realm].name}</small><div class="item-stats"><span>${icon('sword', '', 13)} +${fmt(item.attack)}</span><span>${icon('shield', '', 13)} +${fmt(item.defense)}</span>${item.hp ? `<span>${icon('heart', '', 13)} +${fmt(item.hp)}</span>` : ''}</div><div class="item-actions">${shop ? button(owned ? icon('check', '', 13) + ' Đã sở hữu' : icon('coin', '', 13) + ' ' + fmt(item.price), 'buy', item.id, 'outline small', owned || state.gold < item.price) : `${button(equipped ? icon('check', '', 13) + ' Đang dùng' : 'Trang bị', 'equip', item.id, equipped ? 'equipped small' : 'outline small', equipped)}${!equipped ? `<button class="text-btn" data-action="sell" data-value="${item.id}" title="Bán ${fmt(Math.floor(item.price * 0.4))} linh thạch">Bán</button>` : ''}`}</div></article>`;
}
function inventory() {
  let items = ui.bagTab === 'shop' ? EQUIPMENT.slice(state.realm * 60, state.realm * 60 + 60) : state.inventory.map(id => ITEM_BY_ID[id]);
  if (ui.itemFilter !== 'all') items = items.filter(i => i.slot === ui.itemFilter);
  return `${pageHeading('TÚI CÀN KHÔN', 'Vật tùy thân, đạo tùy tâm', 'Mỗi pháp khí đều có một câu chuyện. Mỗi linh đan đều là một cơ duyên.', `<span class="resource-pill">${icon('leaf', '', 16)} ${fmt(state.herbs)} linh thảo</span><span class="resource-pill">${icon('potion', '', 16)} ${state.potions} linh đan</span>`)}<div class="subnav">${[['inventory','bag','Túi đồ'],['shop','coin','Thương hội'],['craft','potion','Đan phòng']].map(([id,ico,label]) => `<button class="${ui.bagTab===id?'active':''}" data-action="bagTab" data-value="${id}">${icon(ico,'',16)} ${label}</button>`).join('')}<span>${ui.bagTab === 'inventory' ? `${state.inventory.length} pháp khí đang sở hữu` : ui.bagTab === 'shop' ? 'Giao dịch bằng linh thạch' : 'Luyện đan không có tỷ lệ thất bại'}</span></div>
    ${ui.bagTab === 'craft' ? `<div class="info-banner">${icon('potion', '', 25)}<span><strong>Nhất đan nhất thế giới</strong><p>Đan hồi phục được cất thành Linh đan dùng trong chiến đấu; đan tu vi được hấp thu ngay. Khám phá để tìm linh thảo.</p></span>${button(icon('coin','',14)+' Mua linh thảo · 50', 'supplies','herbs','outline')}</div><div class="recipe-grid">${RECIPES.filter(r=>r.realm===state.realm || (state.realm >= 25 && r.realm === 24)).map(r=>`<article class="recipe-card panel"><div class="recipe-symbol">${icon('potion','',32)}</div><span class="eyebrow">ĐAN PHƯƠNG · ${REALMS[r.realm].name}</span><h3>${r.name}</h3><p>${r.description}</p><span class="recipe-effect">${r.effect==='exp'?`+${r.value} tu vi`:'+1 Linh đan'}</span><div class="recipe-cost"><span>${icon('leaf','',13)} ${r.herbs} linh thảo</span><span>${icon('coin','',13)} ${fmt(r.cost)}</span></div>${button('Khai lò luyện đan', 'craft',r.id,'outline',state.herbs<r.herbs||state.gold<r.cost)}</article>`).join('')}</div>` : `<div class="filter-row">${[['all','Tất cả'],...SLOTS.map(s=>[s,SLOT_NAMES[s]])].map(([id,label])=>`<button class="filter-chip ${ui.itemFilter===id?'active':''}" data-action="itemFilter" data-value="${id}">${label}</button>`).join('')}<span>${items.length} vật phẩm</span></div>${ui.bagTab==='shop'?`<div class="supply-row"><div>${icon('potion','',22)}<span><b>Linh đan</b><small>Hồi ${state.narrative.vow === 'compassion' ? '60' : '50'}% sinh lực và 50 linh lực</small></span>${button(icon('coin','',13)+' 60','supplies','potion','outline small')}</div><div>${icon('leaf','',22)}<span><b>5 Linh thảo</b><small>Nguyên liệu luyện đan</small></span>${button(icon('coin','',13)+' 50','supplies','herbs','outline small')}</div><div>${icon('talisman','',22)}<span><b>Tụ Linh Phù</b><small>Hấp thu tu vi theo cảnh giới</small></span>${button(icon('gem','',13)+' 5','supplies','blessing','outline small')}</div></div>`:''}<div class="item-grid">${items.length?items.map(i=>itemCard(i,ui.bagTab==='shop')).join(''):empty('Túi càn khôn còn chỗ trống','Khám phá thế giới hoặc ghé Thương hội để tìm pháp khí.','bag')}</div>`}`;
}
function skills() {
  let skills = SKILLS.filter(s => s.realm === state.realm || state.knownSkills.includes(s.id));
  if (ui.skillFilter === 'known') skills = skills.filter(s=>state.knownSkills.includes(s.id));
  return `${pageHeading('VẠN PHÁP QUY TÔNG', 'Tàng Kinh Các', 'Lĩnh ngộ bí tịch, phối hợp chiêu thức và tự sáng tạo lối đánh của mình.', `<span class="resource-pill">${icon('book','',16)} ${state.knownSkills.length} đã lĩnh ngộ</span>`)}<div class="loadout-panel panel"><div><span class="eyebrow">CÔNG PHÁP XUẤT TRẬN</span><h2>Ba chiêu thức, vạn biến hóa</h2><p>Chọn tối đa 3 công pháp. Gỡ một công pháp để thay thế.</p></div><div class="loadout-slots">${[0,1,2].map(i=>{const sk=SKILL_BY_ID[state.loadout[i]];return `<button class="loadout-slot ${sk?'filled':''}" ${sk?`data-action="loadout" data-value="${sk.id}"`:''}><kbd>${i+2}</kbd>${icon(sk?(sk.type==='heal'?'lotus':i?'flame':'sword'):'book','',27)}<span>${sk?sk.name.split(' · ')[0]:'Chưa chọn'}</span>${sk?icon('close','',12):''}</button>`}).join('')}</div></div><div class="filter-row">${[['all','Tất cả công pháp'],['known','Đã lĩnh ngộ']].map(([id,label])=>`<button class="filter-chip ${ui.skillFilter===id?'active':''}" data-action="skillFilter" data-value="${id}">${label}</button>`).join('')}<span>Công pháp thuộc ${REALMS[state.realm].name} và bí tịch đã học</span></div><div class="skill-grid">${skills.map((s,i)=>{const known=state.knownSkills.includes(s.id), equipped=state.loadout.includes(s.id);return `<article class="skill-card panel ${RARITIES[s.rarity].class}"><div class="skill-art">${icon(s.type==='heal'?'lotus':s.type==='shield'?'shield':['sword','flame','snow','bolt'][i%4],'',36)}<span>${RARITIES[s.rarity].name}</span></div><div class="skill-content"><small>${REALMS[s.realm].name} · Hệ ${DISCIPLINES[skillDiscipline(s)]} · ${s.type==='heal'?'HỒI PHỤC':s.type==='shield'?'HỘ THỂ':'CÔNG KÍCH'}</small><h3>${esc(s.name)}</h3><p>${s.description}</p><div class="skill-values"><span>${icon('flame','',13)} ${s.cost} linh lực</span><span>${s.type==='attack'?`${s.multiplier.toFixed(1)}× công kích`:s.type==='heal'?'Hồi 38% sinh lực':'Giảm 70% sát thương'}</span></div>${known?button(equipped?icon('check','',13)+' Đã trang bị · Gỡ':'Trang bị công pháp','loadout',s.id,equipped?'equipped small':'outline small'):button(icon('coin','',13)+` Lĩnh ngộ · ${fmt(s.price)}`,'learn',s.id,'outline small',state.gold<s.price)}</div></article>`}).join('')}</div>`;
}
function questGoal(q) {
  if (q.goal==='realm') return `Đạt ${REALMS[q.target].name}`;
  return `${GOAL_NAMES[q.goal]} ${Math.min(q.target,questProgress(state,q))}/${q.target}`;
}
function quests() {
  const story = STORY[state.storyIndex], current = QUESTS[state.storyIndex];
  const commissions = QUESTS.filter(q=>!q.main && q.realm<=state.realm && (!state.claimed.includes(q.id) || q.id in state.questStarts)).slice(0,48);
  return `${pageHeading('THIÊN MỆNH DO MÌNH', 'Một đời, một câu chuyện', 'Hai mươi chương chính truyện. Những lời hẹn, bí mật và một cánh cửa chưa từng khép.',button('Xem hành trình '+icon('arrow','',15),'storyTimeline','','outline'))}<div class="subnav"><button class="${ui.questTab==='story'?'active':''}" data-action="questTab" data-value="story">${icon('scroll','',16)} Chính truyện <small>${state.storyIndex}/20</small></button><button class="${ui.questTab==='commission'?'active':''}" data-action="questTab" data-value="commission">${icon('coin','',16)} Ủy thác giang hồ</button><span>${state.claimed.length} nhiệm vụ đã hoàn thành</span></div>${ui.questTab==='story'?story?`<section class="story-panel panel"><div class="story-art"><span class="story-chapter">CHƯƠNG<span>${String(state.storyIndex+1).padStart(2,'0')}</span>THIÊN MỆNH</span></div><div class="story-content"><span class="eyebrow">CHÍNH TRUYỆN · ${REGIONS[story.region].name.toUpperCase()}</span><h2>${esc(story.title)}</h2><div class="story-speaker">${icon('chat','',16)} ${story.speaker}</div><blockquote>${esc(story.text)}</blockquote><div class="quest-objective">${icon(isQuestReady(state,current)?'check':'compass','',21)}<span><small>MỤC TIÊU CHƯƠNG</small><strong>${questGoal(current)}</strong></span><span class="quest-state">${isQuestReady(state,current)?'ĐÃ HOÀN THÀNH':'ĐANG THỰC HIỆN'}</span></div><div class="quest-rewards"><span>PHẦN THƯỞNG</span><b>${icon('lotus','',16)} ${fmt(current.exp)} tu vi</b><b>${icon('coin','',16)} ${fmt(current.gold)}</b><b>${icon('gem','',16)} 5</b></div><div class="button-row">${button(isQuestReady(state,current)?'Nhận thưởng & Tiếp tục '+icon('arrow','',16):'Chưa hoàn thành','claimQuest',current.id,'gold',!isQuestReady(state,current))}${button('Trở về hành trình','tab','abode','outline')}</div></div></section>`:empty('Tiên lộ chưa có hồi kết','Ngươi đã hoàn thành 20 chương chính truyện. Cửu Châu vẫn còn vô vàn cơ duyên để khám phá.','crown'):`<div class="quest-grid">${commissions.map(q=>{const claimed=state.claimed.includes(q.id),accepted=q.id in state.questStarts,ready=accepted&&isQuestReady(state,q);return `<article class="commission-card panel"><span class="eyebrow">${REGIONS[q.region].name}</span><h3>${q.name}</h3><p>${q.description}</p><div class="quest-mini-goal">${icon(ready?'check':'compass','',15)} ${claimed?'Đã hoàn thành':accepted?questGoal(q):`${GOAL_NAMES[q.goal]} · ${q.target} lần`}</div><div class="commission-bottom"><span>${icon('coin','',13)} ${fmt(q.gold)} <em>·</em> ${fmt(q.exp)} tu vi</span>${button(claimed?'Đã nhận thưởng':ready?'Nhận thưởng':accepted?'Đang thực hiện':'Nhận ủy thác',ready?'claimQuest':'acceptQuest',q.id,ready?'gold small':'outline small',claimed||(accepted&&!ready))}</div></article>`}).join('')}</div>`}`;
}
function empty(title, text, ico='archive') { return `<div class="empty-state">${icon(ico,'',42)}<h2>${title}</h2><p>${text}</p></div>`; }
function pagination(page, max, action) { return `<div class="pagination">${button('← Trước',action,page-1,'quiet small',page<=1)}<span>Trang <b>${page}</b> / ${max}</span>${button('Tiếp →',action,page+1,'quiet small',page>=max)}</div>`; }
function catalogResults() {
  const search = ui.search.trim().toLocaleLowerCase('vi');
  const list = CATALOG[ui.catalog].filter(e=>!search || `${e.name} ${e.description || e.dialogue || ''}`.toLocaleLowerCase('vi').includes(search));
  const pages=Math.max(1,Math.ceil(list.length/18));ui.page=Math.min(ui.page,pages);
  return `<div class="catalog-count"><span>${fmt(list.length)} mục ${search?`phù hợp với “${esc(ui.search)}”`:'trong thư tịch'}</span><span>${ui.page}/${pages}</span></div><div class="catalog-grid">${list.length?list.slice((ui.page-1)*18,ui.page*18).map(entry=>`<button class="catalog-card panel" data-action="catalogDetail" data-value="${entry.id}"><span class="catalog-symbol">${icon(({realms:'lotus',regions:'mountain',monsters:'skull',npcs:'person',equipment:slotIcon(entry.slot),skills:'book',quests:'scroll',recipes:'potion'})[ui.catalog],'',25)}</span><span><small>${entry.realm!==undefined?REALMS[entry.realm].name:CATEGORY_NAMES[ui.catalog]}</small><strong>${esc(entry.name)}</strong><p>${esc(entry.description||entry.dialogue||'Một trọng thiên trên con đường trường sinh.')}</p></span>${icon('chevron','',14)}</button>`).join(''):empty('Chưa tìm thấy','Thử một từ khóa khác hoặc chọn nhóm nội dung khác.','search')}</div>${pagination(ui.page,pages,'catalogPage')}`;
}
function codex() {
  return `${pageHeading('THƯ TỊCH CỬU CHÂU', 'Vạn vật đều có linh', 'Tra cứu 5.000 mục dữ liệu thế giới. Cảnh giới, địa danh, yêu thú và những câu chuyện.',`<span class="catalog-total">${icon('archive','',19)} <b>${fmt(CONTENT_COUNT)}</b> mục nội dung</span>`)}<div class="catalog-layout"><aside class="catalog-sidebar panel"><span class="eyebrow">VẠN VẬT LỤC</span>${Object.entries(CATALOG).map(([key,list])=>`<button class="${key===ui.catalog?'active':''}" data-action="catalogCategory" data-value="${key}">${icon(({realms:'lotus',regions:'mountain',monsters:'skull',npcs:'person',equipment:'sword',skills:'book',quests:'scroll',recipes:'potion'})[key],'',17)}<span>${CATEGORY_NAMES[key]}</span><b>${fmt(list.length)}</b></button>`).join('')}<p>20 chương chính truyện được viết riêng. Các biến thể còn lại được tạo có quy luật theo cảnh giới và vùng đất.</p></aside><section class="catalog-main"><label class="search-input">${icon('search','',19)}<input id="catalog-search" type="search" value="${esc(ui.search)}" placeholder="Tìm tên, địa danh, công pháp…" aria-label="Tìm kiếm nội dung"/><kbd>/</kbd></label><div id="catalog-results">${catalogResults()}</div></section></div>`;
}
function render() {
  document.documentElement.classList.toggle('reduce-motion',state.settings.reducedMotion);
  const duelState = ui.battleConclusion || state;
  const expanded = ui.tab === 'abode' && Boolean(duelState.combat) && ui.battleExpanded;
  document.body.classList.toggle('battle-screen-open', expanded);
  if (expanded) {
    const focused = document.activeElement?.closest('.duel-screen [data-action]');
    const focusAction = focused?.dataset.action, focusValue = focused?.dataset.value;
    $('#app').innerHTML = battleScreen(duelState, { busy: ui.busy, logOpen: ui.duelLogOpen });
    const log = $('.duel-log-lines'); if (log && ui.duelLogOpen) log.scrollTop = log.scrollHeight;
    if (focusAction) [...document.querySelectorAll('.duel-screen [data-action]:not(:disabled)')].find(el => el.dataset.action === focusAction && el.dataset.value === focusValue)?.focus({ preventScroll: true });
    return;
  }
  $('#app').innerHTML=`${header()}<main class="main-content ${ui.tab==='abode'?'abode-content':''}" id="main-content">${({abode,world,character,inventory,skills,quests,codex})[ui.tab]()}</main><footer class="site-footer"><span><i class="tiny-diamond"></i> THIÊN ĐẠO <i>·</i> Phàm Nhân Vấn Tiên</span><span>${icon('check','',12)} Tự động lưu trên trình duyệt <i>·</i> ${fmt(CONTENT_COUNT)} cơ duyên, một tiên lộ</span><button data-action="help">Hướng dẫn ${icon('help','',12)}</button></footer>`;
  if (ui.tab === 'abode' && state.combat) $('.heading-actions').insertAdjacentHTML('afterbegin', button(icon('swords', '', 15) + ' Vào trận', 'battleEnter', '', 'gold'));
  if (ui.tab === 'abode') $('.heading-actions').insertAdjacentHTML('afterbegin', button(icon('chat', '', 15) + (state.narrative.introComplete ? ' Chuyện cũ' : ' Tiếp tục đối thoại'), 'introScene', '', 'quiet'));
  if (ui.tab === 'quests' && ui.questTab === 'story' && STORY[state.storyIndex]) $('.story-content>.button-row')?.insertAdjacentHTML('afterbegin', button(icon('chat', '', 16) + ' Đọc đối thoại', 'chapterScene', state.storyIndex, 'outline'));
  if (ui.tab === 'character' && state.narrative.introComplete) {
    const vow = VOWS[state.narrative.vow];
    $('.cultivation-panel')?.insertAdjacentHTML('beforeend', `<div class="learned-manual">${icon('scroll', '', 20)}<span><strong>Tụ Khí Quyết · Tâm pháp nhập môn</strong><small>${vow ? `Đạo tâm ${vow.name} · ${vow.effect}` : 'Sư phụ truyền thụ · Tĩnh tâm dẫn linh khí nhập thể.'}</small></span></div>`);
  }
}
let lastFocused;
function openModal(title, body, wide=false) {
  const alreadyOpen=Boolean($('.modal'));
  if(!alreadyOpen) lastFocused=document.activeElement;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-heading"><h2>${title}</h2><button class="icon-btn" data-action="closeModal" aria-label="Đóng">${icon('close')}</button></div><div class="modal-content">${body}</div></section></div>`;
  document.body.classList.add('modal-open');
  $('.modal [data-action="closeModal"]').focus();
}
function closeModal() { $('#modal-root').innerHTML='';document.body.classList.remove('modal-open');lastFocused?.focus(); }
function settings() { openModal('Cài đặt tiên lộ',`<p class="modal-intro">Tiến trình được tự động lưu trên trình duyệt này sau mỗi hành động. Xuất bản lưu để chuyển thiết bị hoặc lưu dự phòng.</p><div class="settings-row"><span>${icon('sound','',19)} Âm thanh chiêu thức</span>${button(state.settings.sound?'Đang bật':'Đang tắt','settingsSound','','outline small')}</div><div class="settings-row"><span>${icon('eye','',19)} Giảm hiệu ứng chuyển động</span>${button(state.settings.reducedMotion?'Đang bật':'Đang tắt','settingsMotion','','outline small')}</div><div class="settings-row"><span>${icon('person','',19)} Đạo hiệu</span>${button(esc(state.name),'rename','','outline small')}</div><div class="settings-export">${button(icon('download','',16)+' Xuất bản lưu','export','','outline')}${button(icon('upload','',16)+' Nhập bản lưu','import','','outline')}<input type="file" id="save-file" accept="application/json,.json" hidden/></div><div class="danger-zone"><p>Hành trình mới sẽ thay thế tiến trình hiện tại trên trình duyệt này.</p>${button(icon('reset','',15)+' Bắt đầu lại','resetConfirm','','danger')}</div>`); }
function help() { openModal('Một bước vào tiên lộ',`<div class="help-intro">${icon('lotus','',38)}<p>Không có con đường đúng duy nhất.<br>Đạo hữu hãy tự viết hành trình của mình.</p></div><ol class="help-steps"><li><b>Học kiếm cùng sư phụ</b><p>Tấn công (phím 1) hoặc dùng công pháp (2–4) để tích Khí thế. Đủ 100 điểm, dùng tuyệt kỹ (7) để kết thúc chỉ điểm.</p></li><li><b>Giữ mình giữa giao tranh</b><p>Phòng thủ (5) giảm 70% sát thương và hồi linh lực. Linh đan (6) hồi sinh lực và linh lực; dùng một lượt.</p></li><li><b>Tu luyện, đột phá</b><p>Rời trận để tĩnh tọa, hồi phục và tăng tu vi. Mỗi cảnh giới có 9 tầng. Đủ tu vi và linh thạch là đột phá thành công.</p></li><li><b>Khám phá và theo đuổi cốt truyện</b><p>Ghé Thế giới để đi tới vùng mới, gặp NPC, săn yêu thú và tìm linh thảo. Nhận thưởng chương đầu trong Nhiệm vụ sau khi sư phụ công nhận.</p></li><li><b>Pháp khí & công pháp</b><p>Trang bị đồ trong Túi đồ. Mua bí tịch tại Tàng Kinh Các. Đan phòng đổi linh thảo thành đan dược. Mang tối đa 3 công pháp xuất trận.</p></li></ol><p class="save-note">${icon('check','',15)} Tự động lưu sau mỗi thao tác. Bản chơi đơn, không cần tài khoản hay kết nối máy chủ.</p>`,true); }
function npcDialog(npc) { storyPlayer.openNpc(npc); }
function showMonsterTraits() {
  const enemy = state.combat, profile = monsterProfile(enemy); if (!profile) return;
  const next = enemyIntent(enemy);
  openModal('Đặc tính yêu thú', `<p class="detail-description">${esc(enemy.name)}</p><ul class="monster-trait-details">${monsterTraits(enemy).map(trait => `<li><strong>${trait.label}</strong><p>${trait.description}</p></li>`).join('')}<li><strong>Hộ thể ${enemy.shielded ? 'đang hiệu lực' : 'chưa hiệu lực'}</strong><p>Giảm 50% sát thương của một đòn công kích kế tiếp. Lượt tạo hộ thể không gây sát thương. Hồi phục và phòng thủ không tiêu hao lớp hộ thể này.</p></li></ul><p>Lượt kế tiếp: <b>${next.name}</b>${next.kind === 'special' ? ' · sức mạnh 135%' : next.kind === 'guard' ? ' · tạo hộ thể, không tấn công' : ''}.</p><p class="muted">Tấn công thường và tuyệt kỹ thuộc hệ Kiếm. Công pháp đang mang: ${state.loadout.map(id => `${esc(SKILL_BY_ID[id].name)} (${DISCIPLINES[skillDiscipline(SKILL_BY_ID[id])]})`).join(' · ') || 'chưa có'}.</p>`);
}
function itemDetail(id) { const item=ITEM_BY_ID[id];if(!item)return;const rare=RARITIES[item.rarity];openModal(item.name,`<div class="detail-emblem ${rare.class}">${icon(slotIcon(item.slot),'',58)}</div><p class="centered"><span class="rarity-label ${rare.class}">${rare.name}</span> · ${SLOT_NAMES[item.slot]} · ${REALMS[item.realm].name}</p><p class="detail-description">${item.description}</p><div class="detail-stats"><span>Công kích<b>+${fmt(item.attack)}</b></span><span>Phòng ngự<b>+${fmt(item.defense)}</b></span><span>Sinh lực<b>+${fmt(item.hp)}</b></span></div><div class="button-row">${state.inventory.includes(id)?button(Object.values(state.equipped).includes(id)?'Đang trang bị':'Trang bị pháp khí','modalEquip',id,'gold',Object.values(state.equipped).includes(id)):button(icon('coin','',14)+' Mua · '+fmt(item.price),'modalBuy',id,'gold',item.realm>state.realm||state.gold<item.price)}${button('Đóng','closeModal','','outline')}</div>`); }
function catalogDetail(id) { const e=CATALOG[ui.catalog].find(e=>e.id===id);if(!e)return;if(ui.catalog==='equipment'){itemDetail(id);return;}openModal(e.name,`<div class="eyebrow">${CATEGORY_NAMES[ui.catalog]} ${e.realm!==undefined?' · '+REALMS[e.realm].name:''}</div><p class="detail-description">${esc(e.description||e.dialogue||'Một cột mốc trên hành trình truy tìm trường sinh. Mỗi cảnh giới gồm chín tầng tu luyện.')}</p>${e.dialogue?`<blockquote class="npc-quote">“${esc(e.dialogue)}”</blockquote>`:''}${ui.catalog==='monsters'?`<div class="detail-stats"><span>Sinh lực<b>${fmt(e.hp)}</b></span><span>Công kích<b>${fmt(e.attack)}</b></span><span>Tu vi rơi<b>${fmt(e.exp)}</b></span></div><p class="muted">${monsterTraits(e).map(trait=>trait.label).join(" · ")}</p><p class="muted">Sinh sống tại ${REGIONS[e.region].name}. ${e.boss?'Đây là thủ lĩnh của vùng.':''}</p>`:''}${ui.catalog==='skills'?`<p>${e.cost} linh lực · Hệ ${DISCIPLINES[skillDiscipline(e)]} · ${e.type==='attack'?e.multiplier.toFixed(1)+'× công kích':e.type==='heal'?'Hồi 38% sinh lực':'Hộ thể giảm sát thương'}</p>${button(state.knownSkills.includes(id)?'Đã lĩnh ngộ':'Lĩnh ngộ · '+fmt(e.price),'modalLearn',id,'gold',state.knownSkills.includes(id)||e.realm>state.realm||state.gold<e.price)}`:''}${ui.catalog==='regions'?button(e.realm>state.realm?'Chưa đủ cảnh giới':'Đi tới vùng đất','modalTravel',id,'gold',e.realm>state.realm):''}${ui.catalog==='recipes'?button('Đến Đan phòng','modalBag','craft','gold'):''}`); }
function storyTimeline() {openModal('Hai mươi chương thiên mệnh',`<div class="story-timeline">${STORY.map((s,i)=>`<div class="${i<state.storyIndex?'completed':i===state.storyIndex?'current':''}"><span>${i<state.storyIndex?icon('check','',16):String(i+1).padStart(2,'0')}</span><div><small>${i<state.storyIndex?'ĐÃ HOÀN THÀNH':i===state.storyIndex?'CHƯƠNG HIỆN TẠI':'CHƯA MỞ'}</small><h3>${s.title}</h3><p>${REGIONS[s.region].name}</p></div>${i>state.storyIndex?icon('lock','',15):''}</div>`).join('')}</div>`,true);}
function doAction(action,value) {
  const battleActions=['attack','skill','ultimate','guard','potion'];
  if(ui.busy&&battleActions.includes(action))return;
  const focusInBattle = Boolean(document.activeElement?.closest('.duel-controls'));
  const priorCombat = state.combat && { ...state.combat };
  const expandedBefore = Boolean($('.duel-screen'));
  const response=dispatch(state,action,value);
  if(!response.ok){toast(response.message,true);return response;}
  if(response.encounter || action === 'training') {ui.tab='abode';ui.battleExpanded=true;}
  const conclusion = expandedBefore && (response.victory || response.defeat);
  if(response.victory || response.defeat || action === 'flee') {ui.tab='abode';ui.battleExpanded=conclusion;ui.busy=false;ui.battleConclusion=null;clearTimeout(battleTimer);}
  if(conclusion) {ui.battleConclusion={...state,combat:{...priorCombat,hp:response.victory?0:priorCombat.hp},hp:response.defeat?0:state.hp};ui.busy=true;}
  const animating = battleActions.includes(action) && Boolean(state.combat) && !response.victory && !response.defeat;
  if(animating)ui.busy=true;
  save();render();
  if(conclusion) {
    animateBattle({...response,ultimate:action==='ultimate'},action,$('#app'));playTone('success');
    battleTimer=setTimeout(()=>{ui.battleConclusion=null;ui.busy=false;ui.battleExpanded=false;render();toast(response.message);},420);
    return response;
  }
  if(response.npc){npcDialog(response.npc);return response;}
  if(action==='explore') {ui.tab='abode';render();}
  if(animating) {
    playTone('attack');
    animateBattle(response, action, $('#app'));
    const scene=$('.battle-scene');scene?.classList.add(response.ultimate?'ultimate-flash':action==='guard'?'guard-flash':action==='potion'?'heal-flash':'attack-flash');
    const fx=$('.battle-scene #battle-fx');if(fx&&response.damage)fx.innerHTML=`<span class="floating-damage ${response.critical?'crit':''}">${response.critical?'BẠO KÍCH<br>':''}−${fmt(response.damage)}</span>`;
    clearTimeout(battleTimer);battleTimer=setTimeout(()=>{
      ui.busy=false;
      const controls=$('.combat-controls');if(controls)controls.outerHTML=battleActionsMarkup();
      const duelControls=$('.duel-controls');if(duelControls)duelControls.outerHTML=battleControls(state,false);
      const turn=$('.duel-turn');if(turn)turn.textContent='Đến lượt ngươi';
      $('.duel-stage')?.classList.remove('duel-attack-fx','duel-guard-fx','duel-heal-fx','duel-ultimate-fx');
      const duelFx=$('.duel-fx');if(duelFx)duelFx.innerHTML='';
      if(focusInBattle && document.activeElement === document.body && !inventoryPanel.active && !cultivationPanel.active && !storyPlayer.active && !$('.modal')) [...document.querySelectorAll('.duel-controls [data-action]:not(:disabled)')].find(el=>el.dataset.action===action&&(value===undefined||el.dataset.value===value))?.focus({preventScroll:true});
      scene?.classList.remove('attack-flash','ultimate-flash','guard-flash','heal-flash');
    },380);
  }else {playTone('success');toast(response.message);}
  if(response.victory) {ui.tab='abode';render();}
  return response;
}
// Keep cooldown UI in sync without replacing the journal or whole page.
function battleActionsMarkup(){return battleActions();}
document.addEventListener('click',event=>{
  if(event.target.classList.contains('modal-backdrop')){closeModal();return;}
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;
  event.preventDefault();const action=el.dataset.action,value=el.dataset.value;
  switch(action){
    case 'battleOverview':ui.battleExpanded=false;render();$('[data-action="battleEnter"]')?.focus({preventScroll:true});break;
    case 'battleEnter':if(state.combat){ui.tab='abode';ui.battleExpanded=true;render();$('.duel-abode')?.focus({preventScroll:true});}break;
    case 'duelLog':ui.duelLogOpen=!ui.duelLogOpen;render();break;
    case 'monsterTraits':showMonsterTraits();break;
    case 'cultivation':cultivationPanel.open();break;
    case 'introScene':storyPlayer.openIntro({replay:state.narrative.introComplete});break;
    case 'chapterScene':storyPlayer.openChapter(Number(value));break;
    case 'tab':if(value==='inventory'){inventoryPanel.open();break;}ui.tab=value;ui.search='';ui.page=1;render();window.scrollTo(0,0);break;
    case 'help':help();break;
    case 'settings':settings();break;
    case 'closeModal':closeModal();break;
    case 'logToggle':ui.logOpen=!ui.logOpen;render();break;
    case 'bagTab':if(value==='inventory'){inventoryPanel.open();break;}ui.tab='inventory';ui.bagTab=value;ui.itemFilter='all';render();break;
    case 'itemFilter':ui.itemFilter=value;render();break;
    case 'skillFilter':ui.skillFilter=value;render();break;
    case 'questTab':ui.questTab=value;render();break;
    case 'catalogCategory':ui.catalog=value;ui.page=1;ui.search='';render();break;
    case 'catalogPage':ui.page=Number(value);$('#catalog-results').innerHTML=catalogResults();$('.catalog-main').scrollIntoView({block:'start',behavior:'smooth'});break;
    case 'mapPage':ui.mapPage=Number(value)-1;render();break;
    case 'catalogDetail':catalogDetail(value);break;
    case 'itemDetail':itemDetail(value);break;
    case 'storyTimeline':storyTimeline();break;
    case 'storyReward':ui.tab='quests';ui.questTab='story';render();break;
    case 'rename':openModal('Đạo hiệu của ngươi',`<form id="name-form"><label class="form-label" for="name-input">Tên gọi trên tiên lộ</label><input class="text-input" id="name-input" name="name" value="${esc(state.name)}" minlength="2" maxlength="24" required autocomplete="off"/><p class="muted">Từ 2 đến 24 ký tự. Đạo hiệu có thể đổi bất cứ lúc nào.</p><button class="btn gold" type="submit">Lưu đạo hiệu</button></form>`);$('#name-input').focus();break;
    case 'settingsSound':doAction('sound');settings();break;
    case 'settingsMotion':doAction('motion');settings();break;
    case 'modalBag':closeModal();ui.tab='inventory';ui.bagTab=value;render();break;
    case 'modalQuests':closeModal();ui.tab='quests';ui.questTab='commission';render();break;
    case 'npcTraining':closeModal();ui.tab='abode';doAction('training');break;
    case 'modalEquip':if(doAction('equip',value)?.ok)closeModal();break;
    case 'modalBuy':if(doAction('buy',value)?.ok)itemDetail(value);break;
    case 'modalLearn':if(doAction('learn',value)?.ok)closeModal();break;
    case 'modalTravel':if(doAction('travel',value)?.ok)closeModal();break;
    case 'export':{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='thien-dao-tien-lo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất bản lưu.');break;}
    case 'import':$('#save-file').click();break;
    case 'resetConfirm':openModal('Khởi đầu một tiên lộ mới?',`<p>Tiến trình hiện tại sẽ được thay thế. Hãy xuất bản lưu trong Cài đặt nếu muốn giữ hành trình này.</p><div class="button-row">${button('Giữ hành trình hiện tại','settings','','outline')}${button('Bắt đầu lại','reset','','danger')}</div>`);break;
    case 'reset':storyPlayer.close();state=newGame();ui.battleConclusion=null;ui.battleExpanded=true;ui.busy=false;clearTimeout(battleTimer);ui.tab='abode';save();closeModal();render();storyPlayer.openIntro();toast('Một hành trình mới bắt đầu.');break;
    case 'confirmImport':if(ui.pendingImport){storyPlayer.close();state=ui.pendingImport;ui.battleConclusion=null;ui.battleExpanded=true;delete ui.pendingImport;ui.busy=false;clearTimeout(battleTimer);ui.tab='abode';save();closeModal();render();if(!state.narrative.introComplete)storyPlayer.openIntro();toast('Đã khôi phục hành trình.');}break;
    default:doAction(action,value);
  }
});
document.addEventListener('input',event=>{if(event.target.id==='catalog-search'){ui.search=event.target.value;ui.page=1;$('#catalog-results').innerHTML=catalogResults();}});
document.addEventListener('submit',event=>{if(event.target.id==='name-form'){event.preventDefault();if(doAction('name',$('#name-input').value)?.ok)closeModal();}});
document.addEventListener('change',async event=>{if(event.target.id!=='save-file')return;const file=event.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('Tệp lưu quá lớn (tối đa 2 MB).');ui.pendingImport=parseSave(await file.text());openModal('Khôi phục hành trình?',`<p>Bản lưu của <b>${esc(ui.pendingImport.name)}</b> · ${realmLabel(ui.pendingImport)} · Ngày ${ui.pendingImport.day}.</p><p>Hành trình hiện tại trên trình duyệt sẽ được thay thế.</p><div class="button-row">${button('Hủy','settings','','outline')}${button('Khôi phục bản lưu','confirmImport','','gold')}</div>`);}catch(error){toast(error.message||'Không đọc được tệp lưu.',true);event.target.value='';}});
document.addEventListener('keydown',event=>{
  const modal=$('.modal');
  if(modal){if(event.key==='Escape'){closeModal();return;}if(event.key==='Tab'){const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not([hidden]),[href],select')],first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
  if(cultivationPanel.handleKey(event))return;
  if(inventoryPanel.handleKey(event))return;
  if(event.key.toLowerCase()==='t'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){event.preventDefault();cultivationPanel.open();return;}
  if(event.key.toLowerCase()==='i'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){event.preventDefault();inventoryPanel.open();return;}
  if(storyPlayer.handleKey(event))return;
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key==='Escape'&&$('.duel-screen')){event.preventDefault();ui.battleExpanded=false;render();$('[data-action="battleEnter"]')?.focus({preventScroll:true});return;}
  if(event.key==='?'){help();return;}
  if(event.key==='/'&&ui.tab==='codex'){event.preventDefault();$('#catalog-search').focus();return;}
  if(ui.tab!=='abode'||ui.busy)return;
  if(event.key==='0'&&state.combat?.type==='monster'){event.preventDefault();doAction('flee');return;}
  const key=Number(event.key);if(key>=1&&key<=7){event.preventDefault();if(key===1)doAction('attack');else if(key>=2&&key<=4){const id=state.loadout[key-2];if(id)doAction('skill',id);}else doAction(({5:'guard',6:'potion',7:'ultimate'})[key]);}
});
window.addEventListener('storage',event=>{if(event.key===SAVE_KEY&&event.newValue)toast('Tiến trình đã đổi trong tab khác. Hãy tải lại trang để tiếp tục đúng bản lưu.',true);});
render();
if(!state.narrative.introComplete) { if(!restoreWarning)save(); storyPlayer.openIntro(); }
if(restoreWarning)toast(restoreWarning,true);
