import { icon } from './icons.js';
import { dispatch } from './engine.js';
import { VOWS, introScene, chapterScene, npcScene } from './narrative.js';
import './story.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** A standalone, keyboard-accessible visual novel stage. Game rules stay in the engine. */
export function createStoryPlayer({ root, getState, save, onExit, onShortcut, onService, onSettings, notify }) {
  let scene = null;
  let index = 0;
  let replay = false;
  let typing = false;
  let historyOpen = false;
  let animation = 0;
  let previousFocus = null;
  let previousScroll = 0;

  const find = selector => root.querySelector(selector);

  function cancelTyping() { cancelAnimationFrame(animation); animation = 0; }

  function finishTyping() {
    if (!scene) return;
    cancelTyping();
    typing = false;
    find('.vn-typed').textContent = scene.pages[index].text;
    root.firstElementChild.dataset.typing = 'false';
    updateActions();
  }

  function writeLine(text) {
    cancelTyping();
    find('.vn-accessible').textContent = text;
    const reduced = getState().settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    typing = !reduced;
    root.firstElementChild.dataset.typing = String(typing);
    if (reduced) { find('.vn-typed').textContent = text; updateActions(); return; }
    const start = performance.now();
    function tick(now) {
      if (!scene) return;
      const count = Math.min(text.length, Math.floor((now - start) / 13) + 1);
      find('.vn-typed').textContent = text.slice(0, count);
      if (count < text.length) animation = requestAnimationFrame(tick);
      else finishTyping();
    }
    animation = requestAnimationFrame(tick);
    updateActions();
  }

  function updateActions() {
    const page = scene.pages[index], last = index === scene.pages.length - 1;
    const choices = page.choices && !replay && !typing;
    const services = page.service && !typing;
    find('.vn-choices').hidden = !choices;
    find('.vn-services').hidden = !services;
    find('.vn-next').hidden = Boolean(choices || services);
    find('.vn-next').innerHTML = last && !typing ? `${scene.kind === 'intro' ? 'Trở về động phủ' : 'Trở về hành trình'} ${icon('arrow', '', 17)}` : `Tiếp tục ${icon('arrow', '', 17)}`;
    find('.vn-key-hint').textContent = choices ? 'Chọn điều ngươi muốn giữ trên tiên lộ' : services ? 'Chọn lời đáp của ngươi' : typing ? 'Nhấn Enter hoặc chạm để hiện toàn bộ' : 'Enter / Space để tiếp tục · ← để đọc lại';
    find('.vn-previous').disabled = index === 0;
    if ((choices || services) && document.activeElement === find('.vn-next')) {
      find(choices ? '.vn-choice' : '.vn-service')?.focus({ preventScroll: true });
    }
  }

  function renderHistory() {
    const panel = find('.vn-history');
    panel.hidden = !historyOpen;
    find('[data-vn="history"]').setAttribute('aria-expanded', String(historyOpen));
    if (!historyOpen) return;
    panel.innerHTML = `<div class="vn-history-heading"><h2>Tiên lộ ký</h2><button data-vn="history" aria-label="Đóng nhật ký">${icon('close')}</button></div><p class="vn-history-subtitle">${escape(scene.title)}</p><div class="vn-history-lines">${scene.pages.slice(0, index + 1).map((page, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span><div><strong>${escape(page.speaker)}</strong><p>${escape(page.text)}</p></div></article>`).join('')}</div>`;
  }

  function toggleHistory() {
    historyOpen = !historyOpen;
    renderHistory();
    if (historyOpen) find('.vn-history-heading button').focus();
    else [...root.querySelectorAll('.vn-next,.vn-choice,.vn-service')].find(button => button.getClientRects().length > 0)?.focus();
  }

  function renderPage() {
    const page = scene.pages[index];
    root.firstElementChild.dataset.page = String(index);
    root.firstElementChild.dataset.side = page.side;
    find('.vn-speaker').textContent = page.speaker;
    find('.vn-context').textContent = scene.context;
    find('.vn-page-count').textContent = `${index + 1}/${scene.pages.length}`;
    find('.vn-page-dots').innerHTML = scene.pages.map((_, i) => `<i class="${i === index ? 'current' : i < index ? 'read' : ''}"></i>`).join('');
    find('.vn-portrait-left').classList.toggle('speaking', page.side === 'left');
    find('.vn-portrait-right').classList.toggle('speaking', page.side === 'right');
    find('.vn-dialogue-box').classList.remove('vn-page-in');
    void find('.vn-dialogue-box').offsetWidth;
    find('.vn-dialogue-box').classList.add('vn-page-in');
    writeLine(page.text);
    renderHistory();
  }

  function serviceButton() {
    const label = ({ 'Thương nhân': 'Ghé Thương hội', 'Luyện đan sư': 'Đến Đan phòng', 'Trưởng lão': 'Xin chỉ giáo' })[scene.role] || 'Xem ủy thác';
    const symbol = ({ 'Thương nhân': 'coin', 'Luyện đan sư': 'potion', 'Trưởng lão': 'swords' })[scene.role] || 'scroll';
    return `<button class="vn-service" data-vn="service">${icon(symbol, '', 18)} ${label} ${icon('arrow', '', 16)}</button>`;
  }

  function mount() {
    const s = getState();
    const vowChoices = Object.entries(VOWS).map(([key, vow]) => `<button class="vn-choice" data-vn="vow" data-value="${key}"><span class="vn-choice-icon">${icon(vow.icon, '', 22)}</span><span><b>${vow.name}</b><em>${vow.text}</em><small>${vow.effect}</small></span></button>`).join('');
    root.innerHTML = `<section class="vn-scene" role="dialog" aria-modal="true" aria-label="${escape(scene.title)}" data-kind="${scene.kind}" data-role="${escape(scene.role || '')}">
      <div class="vn-atmosphere" aria-hidden="true"></div><div class="vn-mist" aria-hidden="true"></div>
      <header class="vn-header"><div class="vn-location-group"><button class="vn-back" data-vn="close" aria-label="Trở về động phủ" title="Trở về động phủ">${icon('arrow', '', 28)}</button><div class="vn-location"><span>${scene.kind === 'intro' ? 'THUỞ BAN ĐẦU' : scene.kind === 'npc' ? 'KẾT MỘT THIỆN DUYÊN' : 'TIÊN LỘ KÝ'}</span><h1>${escape(scene.location)}</h1></div></div>
        <nav class="vn-shortcuts" aria-label="Tiện ích trong đối thoại"><button data-vn="shortcut" data-value="cultivation"><span>${icon('lotus', '', 30)}</span><b>Tu luyện</b></button><button data-vn="shortcut" data-value="skills"><span>${icon('scroll', '', 30)}</span><b>Công pháp</b></button><button data-vn="shortcut" data-value="inventory"><span>${icon('bag', '', 30)}</span><b>Túi đồ</b></button><div class="vn-utility"><button data-vn="history" title="Tiên lộ ký (L)" aria-label="Nhật ký đối thoại" aria-expanded="false">${icon('book', '', 19)}</button><button data-vn="sound" aria-label="${s.settings.sound ? 'Tắt' : 'Bật'} âm thanh">${icon(s.settings.sound ? 'sound' : 'mute', '', 19)}</button><button data-vn="settings" aria-label="Cài đặt">${icon('settings', '', 19)}</button>${scene.kind === 'intro' && !replay ? '<button class="vn-skip" data-vn="skip">Bỏ qua</button>' : ''}</div></nav>
      </header>
      <div class="vn-scene-title" aria-hidden="true"><i></i><span>${escape(scene.title)}</span><i></i></div>
      <div class="vn-cast" aria-hidden="true"><div class="vn-portrait vn-portrait-left portrait-${scene.portrait}"><div class="vn-portrait-image"></div></div><div class="vn-portrait vn-portrait-right portrait-disciple"><div class="vn-portrait-image"></div></div></div>
      <div class="vn-bottom-shade" aria-hidden="true"></div>
      <div class="vn-dialogue-zone"><div class="vn-dialogue-box" data-vn="reveal"><span class="vn-corner top-left"></span><span class="vn-corner top-right"></span><span class="vn-corner bottom-left"></span><span class="vn-corner bottom-right"></span><div class="vn-speaker"></div><div class="vn-context"></div><p class="vn-dialogue-text"><span class="vn-accessible sr-only"></span><span class="vn-typed" aria-hidden="true"></span><span class="vn-text-caret" aria-hidden="true"></span></p><div class="vn-dialogue-meta"><div class="vn-page-dots" aria-hidden="true"></div><span class="vn-continue-glyph" aria-hidden="true">▾</span><span class="vn-page-count" aria-label="Trang đối thoại"></span></div></div>
        <div class="vn-choices" hidden>${vowChoices}</div><div class="vn-services" hidden>${serviceButton()}<button class="vn-goodbye" data-vn="close">Cáo từ</button></div>
        <div class="vn-next-row"><button class="vn-previous" data-vn="previous" aria-label="Đọc lời thoại trước">${icon('chevron', '', 17)}</button><button class="vn-next" data-vn="next">Tiếp tục ${icon('arrow', '', 17)}</button><button class="vn-history-shortcut" data-vn="history" aria-label="Mở nhật ký đối thoại">${icon('scroll', '', 19)}</button></div><p class="vn-key-hint"></p>
      </div><aside class="vn-history" aria-label="Nhật ký đối thoại" hidden></aside>
    </section>`;
    document.querySelector('#app').inert = true;
    document.querySelector('#app').setAttribute('aria-hidden', 'true');
    document.body.classList.add('story-open');
    renderPage();
    find('.vn-next').focus({ preventScroll: true });
  }

  function open(nextScene, { page = 0, isReplay = false } = {}) {
    if (!nextScene) return;
    if (!scene) { previousFocus = document.activeElement; previousScroll = window.scrollY; }
    cancelTyping();
    scene = nextScene; index = Math.min(page, scene.pages.length - 1); replay = isReplay; historyOpen = false;
    mount();
  }

  function close() {
    if (!scene) return;
    cancelTyping(); scene = null; typing = false; root.innerHTML = '';
    document.querySelector('#app').inert = false;
    document.querySelector('#app').removeAttribute('aria-hidden');
    document.body.classList.remove('story-open');
    onExit();
    window.scrollTo(0, previousScroll);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    else document.querySelector('.nav-item.active')?.focus({ preventScroll: true });
  }

  function completeIntro(vow) {
    if (replay || getState().narrative.introComplete) { close(); return; }
    const response = dispatch(getState(), 'finishIntro', vow);
    if (!response.ok) { notify(response.message, true); return; }
    save(); close(); notify(response.message);
  }

  function next() {
    if (!scene || historyOpen) return;
    if (typing) { finishTyping(); return; }
    const page = scene.pages[index];
    if (page.choices && !replay) { find('.vn-choice')?.focus(); return; }
    if (page.service) { find('.vn-service')?.focus(); return; }
    if (index < scene.pages.length - 1) {
      index++;
      if (scene.kind === 'intro' && !replay) {
        // Reading backwards does not rewind the saved furthest-read page.
        while (getState().narrative.introStep < index) dispatch(getState(), 'introNext');
        save();
      }
      renderPage();
    } else {
      if (scene.kind === 'chapter') { dispatch(getState(), 'readChapter', scene.id); save(); }
      close();
    }
  }

  function previous() { if (scene && index > 0) { index--; renderPage(); } }

  root.addEventListener('click', event => {
    const target = event.target.closest('[data-vn]');
    if (!target || !scene || target.disabled) return;
    event.stopPropagation(); event.preventDefault();
    switch (target.dataset.vn) {
      case 'next': next(); break;
      case 'reveal': if (!historyOpen) finishTyping(); break;
      case 'previous': previous(); break;
      case 'close': close(); break;
      case 'skip': completeIntro(null); break;
      case 'vow': completeIntro(target.dataset.value); break;
      case 'history': toggleHistory(); break;
      case 'settings': onSettings(); break;
      case 'sound': dispatch(getState(), 'sound'); save(); target.innerHTML = icon(getState().settings.sound ? 'sound' : 'mute', '', 19); target.setAttribute('aria-label', getState().settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh'); break;
      case 'shortcut': { const tab = target.dataset.value; if (!['inventory', 'cultivation'].includes(tab)) close(); onShortcut(tab); break; }
      case 'service': { const role = scene.role; close(); onService(role); break; }
    }
  });

  function handleKey(event) {
    if (!scene) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return true;
    if (event.key === 'Escape') { event.preventDefault(); if (historyOpen) toggleHistory(); else close(); return true; }
    if (event.key === 'Tab') {
      const scope = historyOpen ? find('.vn-history') : root;
      const buttons = [...scope.querySelectorAll('button:not(:disabled):not([hidden])')].filter(button => button.getClientRects().length > 0);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return true;
    }
    if (event.key.toLowerCase() === 'l') { event.preventDefault(); toggleHistory(); return true; }
    if (historyOpen) return true;
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
    else if (event.key === 'Enter' || event.key === ' ') {
      const action = document.activeElement?.dataset.vn;
      if (action && !['next', 'reveal'].includes(action)) return true;
      event.preventDefault(); next();
    }
    return true;
  }

  return {
    get active() { return Boolean(scene); },
    openIntro({ replay: isReplay = false } = {}) { const s = getState(); open(introScene(s.name), { page: isReplay ? 0 : s.narrative.introStep, isReplay: isReplay || s.narrative.introComplete }); },
    openChapter(chapter) { const s = getState(); if (chapter <= s.storyIndex) open(chapterScene(chapter, s.name)); },
    openNpc(npc) { open(npcScene(npc, getState().name)); },
    handleKey, close,
  };
}
