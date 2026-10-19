import { expRequired, realmLabel } from './engine.js';
import { REALMS } from './data.js';
import { qiReserve, cultivationGain, formatRefill, breakthroughCost, QI_CAPACITY } from './cultivation.js';
import { icon } from './icons.js';
import './cultivation.css';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => Math.round(value).toLocaleString('vi-VN');
const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.4 7 .9-5.1 5 1.3 7-6.2-3.4-6.2 3.4 1.3-7-5.1-5 7-.9Z"/></svg>';

export function createCultivationPanel({ root, getState, onAction, onExit }) {
  let opened = false, previousFocus, previousControl, previousScroll, suspended = [], timer, feedback = '', effect = '';
  const find = selector => root.querySelector(selector);

  function render() {
    const s = getState(), reserve = qiReserve(s.cultivation), required = expRequired(s), cost = breakthroughCost(s);
    const peak = s.realm === REALMS.length - 1 && s.stage === 9;
    const ready = s.exp >= required && s.gold >= cost && !s.combat && !peak;
    root.innerHTML = `<section class="cu-overlay" role="dialog" aria-modal="true" aria-labelledby="cu-title" data-reduced="${s.settings.reducedMotion}">
      <div class="cu-background" aria-hidden="true"></div><div class="cu-veil" aria-hidden="true"></div>
      <div class="cu-world-hud" aria-hidden="true"><span>ĐỘNG PHỦ</span><span>${icon('lotus', '', 34)} ${icon('scroll', '', 34)} ${icon('bag', '', 34)}</span><div class="cu-ghost-profile"><b>${escape(s.name)}</b><small>${realmLabel(s)}</small><i></i><i></i></div></div>
      <div class="cu-content"><button class="cu-close" data-cu="close" aria-label="Đóng tu luyện" title="Đóng (Esc)">${icon('close', '', 30)}</button>
        <h2 id="cu-title">${realmLabel(s)}</h2>
        <div class="cu-orbit ${effect}" role="img" aria-label="${REALMS[s.realm].name}, đã khai mở ${s.stage} trên 9 tầng">
          <div class="cu-ring"></div><div class="cu-inner-ring"></div><div class="cu-aura"></div><div class="cu-spirit-floor"></div>
          <img class="cu-meditator" src="/art/cultivation-master.webp" alt="Kiếm tu ngồi nhập định trong linh khí"/>
          ${Array.from({ length: 9 }, (_, index) => { const angle = index * Math.PI * 2 / 9; return `<span class="cu-star ${index < s.stage ? 'lit' : ''} ${index + 1 === s.stage ? 'current' : ''}" style="--x:${50 + 45 * Math.sin(angle)}%;--y:${50 - 45 * Math.cos(angle)}%" title="Tầng ${index + 1}${index < s.stage ? ' · Đã khai mở' : ' · Chưa khai mở'}">${star}</span>`; }).join('')}
        </div>
        <div class="cu-progress"><div><span>Tu vi</span><strong>${number(s.exp)} / ${number(required)}</strong></div><div class="cu-track" role="progressbar" aria-label="Tu vi tu luyện" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${Math.min(s.exp, required)}"><i style="width:${Math.min(100, s.exp / required * 100)}%"></i></div></div>
        <button class="cu-gather" data-cu="gatherQi" aria-label="Tụ khí" ${s.combat || !reserve.charges || s.exp >= required * 10 ? 'disabled' : ''}><strong>Tụ khí</strong><span class="cu-charges">${reserve.charges}/${QI_CAPACITY}</span></button>
        <p class="cu-feedback" role="status">${escape(feedback || (s.combat ? 'Hãy kết thúc hoặc rời trận để nhập định.' : s.exp >= required * 10 ? 'Tu vi đã đầy. Hãy đột phá để tiếp tục tụ khí.' : `Tụ Khí Quyết · +${number(Math.min(cultivationGain(s), required * 10 - s.exp))} tu vi mỗi lượt`))}</p>
        <div class="cu-secondary"><button data-cu="meditate" ${s.combat ? 'disabled' : ''} title="Tĩnh tọa không tốn lượt; hồi sinh lực, linh lực và tăng tu vi">Tĩnh tọa</button><span></span><button class="cu-breakthrough ${ready ? 'ready' : ''}" data-cu="breakthrough" ${ready ? '' : 'disabled'}>${peak ? 'Đã viên mãn' : 'Đột phá'} ${icon('arrow', '', 13)}</button></div>
        <p class="cu-breakthrough-note">${peak ? 'Vô Thượng viên mãn · Tiên lộ vẫn còn cơ duyên.' : `Đột phá cần ${number(required)} tu vi · ${number(cost)} linh thạch <span>(hiện có ${number(s.gold)})</span>`}</p>
        <p class="cu-refill"></p><p class="cu-refill-note">10 lượt mỗi chu kỳ 3 giờ · Hồi phục cả khi rời game</p>
      </div>
    </section>`;
    tick();
  }

  function tick() {
    if (!opened) return;
    const s = getState(), reserve = qiReserve(s.cultivation);
    find('.cu-refill').textContent = reserve.remaining ? `Làm mới lượt sau ${formatRefill(reserve.remaining)}` : 'Khí hải đã hồi đầy';
    find('.cu-charges').textContent = `${reserve.charges}/${QI_CAPACITY}`;
    find('.cu-gather').disabled = Boolean(s.combat || !reserve.charges || s.exp >= expRequired(s) * 10);
  }

  function open() {
    if (opened) return;
    opened = true; feedback = ''; effect = ''; previousFocus = document.activeElement;
    previousControl = previousFocus?.dataset.action ? { action: previousFocus.dataset.action, value: previousFocus.dataset.value } : null;
    previousScroll = window.scrollY;
    suspended = ['#app', '#story-root', '#inventory-root'].map(selector => {
      const element = document.querySelector(selector);
      const snapshot = { element, inert: element.inert, hidden: element.getAttribute('aria-hidden') };
      element.inert = true; element.setAttribute('aria-hidden', 'true'); return snapshot;
    });
    document.body.classList.add('cultivation-open'); render(); find('.cu-close').focus();
    timer = window.setInterval(tick, 1000);
  }

  function close() {
    if (!opened) return;
    opened = false; clearInterval(timer); root.innerHTML = ''; document.body.classList.remove('cultivation-open');
    for (const { element, inert, hidden } of suspended) { element.inert = inert; if (hidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', hidden); }
    onExit(); window.scrollTo(0, previousScroll);
    const replacement = previousControl && [...document.querySelectorAll('#app [data-action]')].find(element => element.dataset.action === previousControl.action && element.dataset.value === previousControl.value);
    const focus = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : replacement || document.querySelector('#app [data-action="cultivation"]') || document.querySelector('#app button:not(:disabled)');
    focus?.focus({ preventScroll: true });
  }

  root.addEventListener('click', event => {
    const target = event.target.closest('[data-cu]'); if (!target || target.disabled) return;
    event.preventDefault(); event.stopPropagation();
    const action = target.dataset.cu;
    if (action === 'close') { close(); return; }
    const result = onAction(action);
    if (!result) return;
    feedback = result.message; effect = result.ok ? action === 'breakthrough' ? 'cu-ascend' : 'cu-pulse' : '';
    render();
    const next = find(`[data-cu="${action}"]:not(:disabled)`) || find('[data-cu="meditate"]:not(:disabled)') || find('.cu-close');
    next.focus({ preventScroll: true });
  });

  function handleKey(event) {
    if (!opened) return false;
    if (event.key === 'Escape' || (event.key.toLowerCase() === 't' && !event.ctrlKey && !event.metaKey && !event.altKey)) { event.preventDefault(); close(); }
    else if (event.key === 'Tab') {
      const buttons = [...root.querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return true;
  }
  return { open, close, handleKey, get active() { return opened; } };
}
