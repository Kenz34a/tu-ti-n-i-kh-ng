import { getStats, realmLabel } from './engine.js';
import { REGIONS, SKILL_BY_ID } from './data.js';
import { icon } from './icons.js';
import { itemArt } from './item-art.js';
import { attackDamage, enemyHitDamage, enemyIntent, monsterProfile, monsterTraits, skillDiscipline, DISCIPLINES } from './combat-rules.js';
import './battle.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = n => Math.round(n).toLocaleString('vi-VN');
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const short = n => n >= 1e6 ? compact.format(n) : number(n);
const corners = '<i class="duel-corner tl"></i><i class="duel-corner tr"></i><i class="duel-corner bl"></i><i class="duel-corner br"></i>';

export function damageRange(state, multiplier = 1, discipline = 'sword') {
  return [.9, 1.1].map(roll => attackDamage({ attack: getStats(state).attack, enemy: state.combat, multiplier, roll, discipline }));
}

export function enemyDamageRange(state) {
  if (state.combat?.type === 'training') return [3, 6];
  return [.85, 1.15].map(roll => enemyHitDamage({ enemy: state.combat, defense: getStats(state).defense, roll }));
}

function bar(label, current, max, color) {
  return `<div class="duel-meter"><div><span>${label}</span><strong title="${number(current)}/${number(max)}">${short(current)}/${short(max)}</strong></div><div class="duel-meter-track ${color}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${current}"><i style="width:${Math.max(0, Math.min(100, current / max * 100))}%"></i></div></div>`;
}

export function battleControls(state, busy = false) {
  const stats = getStats(state), attack = damageRange(state), full = state.hp >= stats.hp && state.mp >= stats.mp;
  const locked = busy || !state.combat;
  const skillButtons = state.loadout.map((id, index) => {
    const skill = SKILL_BY_ID[id], discipline = DISCIPLINES[skillDiscipline(skill)], damage = damageRange(state, skill.multiplier || 1, skillDiscipline(skill));
    const effect = skill.type === 'heal' ? `Hồi ${short(Math.round(stats.hp * .38))} sinh lực` : skill.type === 'shield' ? 'Giảm 70% sát thương' : `${damage.map(short).join('–')} sát thương`;
    return `<button class="duel-skill ${state.mp < skill.cost ? 'depleted' : ''}" data-action="skill" data-value="${id}" ${locked || state.mp < skill.cost ? 'disabled' : ''} title="${escape(skill.name)} · Hệ ${discipline} · ${effect}${skill.type === 'attack' ? ', đã tính kháng/yếu và hộ thể, chưa tính bạo kích' : ''} · ${skill.cost} linh lực"><kbd>${index + 2}</kbd><span class="duel-book book-${index}">${itemArt('book')}<i>${discipline}</i></span><strong>${escape(skill.name.split(' · ')[0])}</strong><small>${effect}</small><em>${skill.cost} linh lực</em></button>`;
  }).join('');
  const retreat = state.combat?.type === 'monster' ? `<button class="duel-command duel-retreat" data-action="flee" ${locked ? 'disabled' : ''} title="Rời giao tranh, không tiêu tốn đan dược"><kbd>0</kbd><span class="duel-command-symbol">${icon('arrow', '', 25)}</span><strong>Rút lui</strong><small>Rời giao tranh</small></button>` : '';
  return `<div class="duel-controls" aria-label="Chiêu thức chiến đấu" aria-busy="${busy}"><div class="duel-skills">${skillButtons || '<p class="duel-no-skills">Chưa mang công pháp</p>'}</div><div class="duel-core-actions">
    <button class="duel-command duel-attack" data-action="attack" ${locked ? 'disabled' : ''} title="${number(attack[0])}–${number(attack[1])} sát thương, chưa tính bạo kích"><kbd>1</kbd><span class="duel-command-symbol">${icon('swords', '', 29)}</span><strong>Tấn công</strong><small>${attack.map(short).join('–')} · +25 Khí thế</small></button>
    <button class="duel-command duel-guard" data-action="guard" ${locked ? 'disabled' : ''}><kbd>5</kbd><span class="duel-command-symbol">${icon('shield', '', 27)}</span><strong>Phòng thủ</strong><small>Giảm 70% sát thương</small></button>
    <button class="duel-command duel-ultimate ${state.qi >= 100 ? 'charged' : ''}" data-action="ultimate" ${locked || state.qi < 100 ? 'disabled' : ''}><kbd>7</kbd><span class="duel-command-symbol">${icon('sword', '', 29)}</span><strong>Nhất Kiếm Khai Thiên</strong><small>Khí thế ${state.qi}/100</small></button>
    <button class="duel-potion" data-action="potion" ${locked || !state.potions || full ? 'disabled' : ''} title="Hồi ${state.narrative?.vow === 'compassion' ? '60' : '50'}% sinh lực và 50 linh lực · Tốn một lượt"><kbd>6</kbd><span>${itemArt('potion')}<em>${state.potions}</em></span><strong>Linh đan</strong></button>
    ${retreat}
  </div></div>`;
}

export function battleScreen(state, { busy = false, logOpen = false } = {}) {
  const c = state.combat, stats = getStats(state), training = c.type === 'training', intent = enemyDamageRange(state), next = enemyIntent(c), traits = monsterTraits(c), profile = monsterProfile(c);
  const message = training ? state.qi >= 100 ? 'Sư phụ: Khí thế đã đủ. Thi triển Nhất Kiếm Khai Thiên cho ta xem!' : 'Sư phụ: Hãy ra đòn, tích đủ Khí thế rồi thi triển tuyệt kỹ cho ta xem!' : c.turn > 1 && state.logs.length ? state.logs.at(-1).text : `${c.boss ? 'Thủ lĩnh' : 'Yêu thú'} ${c.name} đang chặn đường. Giữ vững kiếm tâm!`;
  const intentTitle = next.kind === 'guard' ? 'Lượt tới không tấn công, tạo hộ thể chặn 50% sát thương của một đòn công kích.' : `${next.name}: ${number(intent[0])}–${number(intent[1])} sát thương, chưa phòng thủ${next.kind === 'special' ? ' · sức mạnh 135%' : ''}`;
  const hint = c.shielded ? 'Hộ thể đang hiệu lực: đòn công kích kế tiếp bị giảm 50% sát thương.' : profile ? `Dùng hệ ${DISCIPLINES[profile.weak]} để khắc chế (+25%). Đòn hệ ${DISCIPLINES[profile.resist]} bị kháng (−25%).` : '';
  return `<main class="duel-screen ${training ? 'duel-training' : 'duel-monster'}" aria-label="Đấu trường toàn màn hình">
    <div class="duel-backdrop" aria-hidden="true"></div><div class="duel-shade" aria-hidden="true"></div>
    <section class="duel-stage" aria-label="${training ? 'Sư phụ chỉ điểm' : 'Giao tranh với ' + escape(c.name)}">
      <button class="duel-abode" data-action="battleOverview" aria-label="Động phủ" title="Trở về động phủ, giữ nguyên trận đấu">${training ? 'ĐỘNG PHỦ' : escape(REGIONS[state.region].name.toLocaleUpperCase('vi'))}</button>
      <div class="duel-round"><div class="duel-round-diamond"><span>LƯỢT</span><strong>${c.turn}</strong></div><div><h1>${training ? 'Sư phụ chỉ điểm' : 'Quyết chiến trong sương'}</h1><span class="duel-turn">${busy ? 'Đang giao chiêu' : 'Đến lượt ngươi'}</span></div></div>
      <div class="duel-utilities"><button data-action="tab" data-value="inventory" aria-label="Túi đồ" title="Túi đồ (I)">${icon('bag', '', 21)}</button><button data-action="help" aria-label="Hướng dẫn" title="Hướng dẫn (?)">${icon('help', '', 20)}</button><button data-action="settings" aria-label="Cài đặt" title="Cài đặt">${icon('settings', '', 20)}</button><button data-action="flee" class="duel-flee" ${busy ? 'disabled' : ''}>Rời trận ${icon('arrow', '', 13)}</button></div>
      <section class="duel-status duel-player-status duel-panel" aria-label="Chỉ số người chơi">${corners}<div class="duel-status-name"><h2 title="${escape(state.name)}">${escape(state.name)}</h2><span>${realmLabel(state)}</span></div>${bar('Máu', state.hp, stats.hp, 'hp')}${bar('Linh lực', state.mp, stats.mp, 'mp')}${bar('Khí thế', state.qi, 100, 'qi')}<p class="duel-crit"><span>Bạo kích</span><strong>${stats.crit}%</strong></p></section>
      <section class="duel-enemy-group" aria-label="Đối thủ"><div class="duel-intent intent-${next.kind}" title="${escape(intentTitle)}">${icon(next.kind === 'guard' ? 'shield' : next.kind === 'special' ? 'bolt' : 'swords', '', 16)} <span>${next.kind === 'special' ? 'Tuyệt chiêu' : next.name}</span><b>${next.kind === 'guard' ? '50%' : intent.map(short).join('–')}</b></div><div class="duel-status duel-enemy-status duel-panel">${corners}<div class="duel-status-name"><h2 title="${escape(c.name)}">${escape(c.name)}</h2><span>${training ? 'Sư phụ' : c.boss ? 'Thủ lĩnh' : 'Yêu thú'}</span></div>${bar('Máu đối thủ', c.hp, c.maxHp, 'hp')}${!training ? `<div class="duel-traits">${traits.map(trait => `<button class="${trait.kind}" data-action="monsterTraits" title="${trait.description}">${trait.label}</button>`).join('')}${c.shielded ? '<span class="duel-shield-tag">Hộ thể −50%</span>' : ''}</div>` : ''}</div></section>
      <div class="duel-actor duel-player" role="img" aria-label="${escape(state.name)} cầm kiếm sẵn sàng giao đấu"><div class="duel-ground"></div><div class="duel-portrait"></div></div>
      <div class="duel-actor duel-enemy ${training ? 'duel-master' : 'duel-wolf'} ${c.shielded ? 'duel-shielded' : ''}" role="img" aria-label="${training ? 'Sư phụ dùng kiếm chỉ điểm' : 'Linh lang đại diện yêu thú'}"><div class="duel-ground"></div>${training ? '<div class="duel-portrait"></div>' : `<img src="/art/${profile?.shadow ? 'shadow-wolf' : 'battle-wolf'}.webp" alt=""/>`}</div>
      <div class="duel-mist" aria-hidden="true"></div><div id="battle-fx" class="duel-fx" aria-hidden="true"></div><div class="duel-slash" aria-hidden="true"></div>
      <span class="duel-location">${icon('pin', '', 12)} ${escape(REGIONS[state.region].name)}</span>
    </section>
    <div class="duel-hint">${training ? `Dùng tấn công hoặc công pháp để tích Khí thế (${state.qi}/100). Sư phụ sẽ bảo hộ ngươi.` : `Phòng thủ hồi 18 linh lực và tích 18 Khí thế. Linh đan còn ${state.potions} viên; dùng đan tiêu tốn một lượt.`}<span>PHÍM 1–7</span></div>
    <div class="duel-bottom"><section class="duel-journal duel-panel">${corners}<p class="duel-master-message">✦ ${escape(message)}</p><button class="duel-log-toggle" data-action="duelLog" aria-expanded="${logOpen}" aria-controls="duel-log-lines"><span>${logOpen ? '▾' : '▸'}</span> Nhật ký trận <small>${state.logs.length}</small></button><div class="duel-log-lines" id="duel-log-lines" role="log" aria-live="polite" ${logOpen ? '' : 'hidden'}>${state.logs.map(log => `<p class="${escape(log.tone)}">${escape(log.text)}</p>`).join('')}</div><p class="duel-latest" ${logOpen ? 'hidden' : ''} role="status">${escape(training ? state.logs.at(-1)?.text || '' : hint)}</p></section>${battleControls(state, busy)}</div>
  </main>`;
}

export function animateBattle(response, action, root = document) {
  const scene = root.querySelector('.duel-stage');
  if (!scene) return;
  const kind = response.ultimate ? 'ultimate' : action === 'guard' ? 'guard' : action === 'potion' || (action === 'skill' && !response.damage) ? 'heal' : 'attack';
  scene.classList.add(`duel-${kind}-fx`);
  const fx = scene.querySelector('.duel-fx');
  fx.innerHTML = response.damage ? `<span class="duel-damage ${response.critical ? 'critical' : ''}">${response.critical ? '<small>BẠO KÍCH</small>' : ''}−${number(response.damage)}</span>` : `<span class="duel-recovery">${response.ultimate ? 'Nhất Kiếm Khai Thiên' : kind === 'guard' ? 'Thủ thế' : 'Vận công'}</span>`;
}
