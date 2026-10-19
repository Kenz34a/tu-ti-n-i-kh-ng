import { REALMS, REGIONS, MONSTERS, NPCS, EQUIPMENT, SKILLS, QUESTS, RECIPES, STORY, ITEM_BY_ID, SKILL_BY_ID, SLOTS } from './data.js';
import { createNarrative, VOWS } from './narrative.js';
import { createCultivation, qiReserve, cultivationGain, QI_REFILL_MS, QI_CAPACITY, breakthroughCost } from './cultivation.js';
import { attackDamage, affinityFactor, enemyIntent, enemyHitDamage, skillDiscipline } from './combat-rules.js';

export const SAVE_KEY = 'thien-dao-save-v1';
export const SAVE_VERSION = 1;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const expRequired = s => Math.round((100 + s.stage * 28) * Math.pow(1.75, s.realm));
export const realmLabel = s => `${REALMS[s.realm].name} · Tầng ${s.stage}`;
export function getStats(s) {
  const gear = Object.values(s.equipped).map(id => ITEM_BY_ID[id]).filter(Boolean);
  const power = Math.pow(1.52, s.realm);
  return {
    hp: Math.round((120 + s.stage * 8) * power + gear.reduce((n, i) => n + i.hp, 0)),
    mp: 100 + s.realm * 30 + s.stage * 3 + (s.narrative?.vow === 'wisdom' ? 10 : 0),
    attack: Math.round((14 + s.stage * 0.8) * power + gear.reduce((n, i) => n + i.attack, 0)),
    defense: Math.round((5 + s.stage * 0.25) * power + gear.reduce((n, i) => n + i.defense, 0)),
    crit: 12 + Math.min(18, s.stage * 2),
  };
}
export function addLog(s, text, tone = 'normal') {
  s.logs.push({ text, tone, id: s.nextLog++ });
  s.logs = s.logs.slice(-60);
}
export function newGame() {
  const s = {
    version: SAVE_VERSION, name: 'Lâm Phong', realm: 0, stage: 1, exp: 38, gold: 1250, jade: 36,
    hp: 150, mp: 103, qi: 0, region: 0, day: 1, turns: 0, herbs: 8, potions: 3,
    inventory: ['item-0', 'item-1', 'item-2', 'item-18', 'item-23'],
    equipped: { weapon: 'item-0', armor: 'item-1', accessory: 'item-2' },
    knownSkills: ['skill-0', 'skill-1', 'skill-5'], loadout: ['skill-0', 'skill-1', 'skill-5'],
    storyIndex: 0, claimed: [], questStarts: {}, counters: { training: 0, kills: 0, explorations: 0, meditations: 0, crafted: 0 },
    discovered: ['region-0'], relationships: {}, talked: [], combat: null, logs: [], nextLog: 1,
    settings: { sound: false, reducedMotion: false }, seed: 176031, narrative: createNarrative(), cultivation: createCultivation(),
  };
  s.hp = getStats(s).hp;
  startTraining(s);
  return s;
}
export function random(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function startTraining(s) {
  s.hp = getStats(s).hp; s.mp = getStats(s).mp; s.qi = 0;
  s.combat = { type: 'training', name: 'Mặc Vô Trần', hp: 9999, maxHp: 9999, attack: 6, defense: 2, turn: 1, guarding: false };
  addLog(s, 'Mặc Vô Trần: “Cầm chắc kiếm. Hôm nay, ta sẽ dạy con cách lắng nghe linh khí.”', 'story');
  addLog(s, 'Tấn công để tích Khí thế. Đủ 100 điểm, hãy thi triển Nhất Kiếm Khai Thiên.', 'hint');
}
function result(ok, message, extra = {}) { return { ok, message, ...extra }; }
export function questProgress(s, q) {
  if (q.goal === 'realm') return s.realm;
  return Math.max(0, (s.counters[q.goal] || 0) - (q.main ? 0 : s.questStarts[q.id] || 0));
}
export function isQuestReady(s, q) { return questProgress(s, q) >= q.target; }
function gainExp(s, amount) { s.exp = Math.min(s.exp + Math.round(amount), expRequired(s) * 10); }
function endVictory(s) {
  const enemy = s.combat;
  if (enemy.type === 'training') {
    s.counters.training++;
    gainExp(s, 80); s.gold += 100;
    addLog(s, 'Mặc Vô Trần khẽ gật đầu: “Không tệ. Tiên lộ của con, từ hôm nay bắt đầu.”', 'story');
    addLog(s, 'Hoàn thành chỉ điểm · +80 tu vi · +100 linh thạch. Nhận thưởng chương truyện trong Nhiệm vụ.', 'reward');
  } else {
    s.counters.kills++; gainExp(s, enemy.exp); s.gold += enemy.gold;
    const herbs = 1 + Math.floor(random(s) * 3); s.herbs += herbs;
    addLog(s, `Chiến thắng ${enemy.name}! +${enemy.exp} tu vi · +${enemy.gold} linh thạch · +${herbs} linh thảo.`, 'reward');
    if (enemy.boss || random(s) < 0.55) {
      const item = EQUIPMENT[s.realm * 60 + Math.floor(random(s) * 60)];
      if (!s.inventory.includes(item.id)) { s.inventory.push(item.id); addLog(s, `Nhặt được ${item.name}. Kiểm tra trong Túi đồ.`, 'reward'); }
      else { s.gold += Math.floor(item.price / 4); addLog(s, 'Trang bị trùng được đổi thành linh thạch.', 'hint'); }
    }
  }
  s.combat = null; s.qi = 0;
  return result(true, enemy.type === 'training' ? 'Hoàn thành sư phụ chỉ điểm!' : 'Chiến thắng! Cơ duyên đã đến.', { victory: true });
}
function enemyTurn(s) {
  const c = s.combat, stats = getStats(s);
  const intent = enemyIntent(c);
  let damage = 0;
  if (c.type === 'training') {
    damage = Math.floor(3 + random(s) * 4);
    if (c.guarding) damage = 1;
    s.hp = Math.max(1, s.hp - (c.guarding ? 1 : damage));
    addLog(s, `Sư phụ dùng kiếm gỗ điểm nhẹ: −${c.guarding ? 1 : damage} sinh lực.`, 'enemy');
  } else if (intent.kind === 'guard') {
    c.shielded = true;
    addLog(s, `${c.name} ngưng kết Hộ thể · giảm 50% sát thương của đòn công kích kế tiếp.`, 'enemy');
  } else {
    damage = enemyHitDamage({ enemy: c, defense: stats.defense, roll: .85 + random(s) * .3, guarding: c.guarding });
    s.hp = Math.max(0, s.hp - damage);
    addLog(s, `${c.name} ${intent.kind === 'special' ? `dùng ${intent.name}` : 'phản kích'}${c.guarding ? ' · đã đỡ đòn' : ''}: −${damage} sinh lực.`, 'enemy');
  }
  c.guarding = false; c.turn++; s.turns++;
  if (s.turns % 8 === 0) s.day++;
  if (s.hp <= 0) {
    const lost = Math.floor(s.gold * 0.05); s.gold -= lost; s.combat = null; s.qi = 0;
    s.hp = getStats(s).hp; s.mp = getStats(s).mp;
    addLog(s, `Một tán tu cứu ngươi trở về động phủ. Mất ${lost} linh thạch, tu vi được giữ lại.`, 'enemy');
    return result(true, 'Bại trận. Đã hồi phục tại động phủ.', { defeat: true });
  }
  return result(true, 'Đến lượt ngươi.', { strike: 'enemy', enemyAction: intent.kind, enemyDamage: damage });
}
function attack(s, kind, skillId) {
  if (!s.combat) return result(false, 'Chưa có đối thủ. Hãy khám phá hoặc thỉnh giáo sư phụ.');
  const c = s.combat, stats = getStats(s);
  let multiplier = 1, title = 'Tấn công', gain = 25, discipline = 'sword';
  if (kind === 'ultimate') {
    if (s.qi < 100) return result(false, 'Cần 100 Khí thế để thi triển tuyệt kỹ.');
    s.qi = 0; multiplier = 4.8; title = 'Nhất Kiếm Khai Thiên'; gain = 0;
  } else if (kind === 'skill') {
    const skill = SKILL_BY_ID[skillId];
    if (!skill || !s.loadout.includes(skillId)) return result(false, 'Công pháp chưa được trang bị.');
    if (s.mp < skill.cost) return result(false, 'Linh lực không đủ. Dùng Linh đan hoặc phòng thủ để hồi phục.');
    s.mp -= skill.cost; title = skill.name; gain = 30;
    if (skill.type === 'heal') {
      const healed = Math.min(stats.hp - s.hp, Math.round(stats.hp * 0.38));
      s.hp += healed; s.qi = clamp(s.qi + 20, 0, 100);
      addLog(s, `${title}: hồi phục ${healed} sinh lực.`, 'heal');
      return enemyTurn(s);
    }
    if (skill.type === 'shield') {
      c.guarding = true; s.qi = clamp(s.qi + 20, 0, 100);
      addLog(s, `${title}: ngưng tụ linh khí hộ thể.`, 'heal');
      return enemyTurn(s);
    }
    multiplier = skill.multiplier;
    discipline = skillDiscipline(skill);
  }
  const critical = random(s) * 100 < stats.crit;
  const affinity = affinityFactor(c, discipline), shielded = c.type === 'monster' && c.shielded;
  const damage = attackDamage({ attack: stats.attack, enemy: c, multiplier, roll: .9 + random(s) * .2, critical, discipline });
  if (shielded) c.shielded = false;
  c.hp = Math.max(0, c.hp - damage); s.qi = clamp(s.qi + gain, 0, 100);
  addLog(s, `${title}${critical ? ' · BẠO KÍCH' : ''}${affinity > 1 ? ' · Khắc chế +25%' : affinity < 1 ? ' · Bị kháng −25%' : ''}${shielded ? ' · Hộ thể −50%' : ''}: gây ${damage} sát thương. Khí thế ${s.qi}/100.`, critical ? 'critical' : 'player');
  if (c.hp <= 0 || (c.type === 'training' && kind === 'ultimate')) return { ...endVictory(s), damage, critical, ultimate: kind === 'ultimate' };
  const response = enemyTurn(s);
  return { ...response, damage, critical, strike: 'player', ultimate: kind === 'ultimate' };
}
export function dispatch(s, action, payload, now = Date.now()) {
  switch (action) {
    case 'introNext': {
      if (s.narrative.introComplete) return result(false, 'Đã hoàn thành cảnh mở đầu.');
      s.narrative.introStep = Math.min(3, s.narrative.introStep + 1);
      return result(true, 'Tiếp tục câu chuyện.');
    }
    case 'finishIntro': {
      if (s.narrative.introComplete) return result(false, 'Đã nhận tâm pháp nhập môn.');
      if (payload !== null && !Object.hasOwn(VOWS, payload)) return result(false, 'Lựa chọn đạo tâm không hợp lệ.');
      s.narrative.introComplete = true; s.narrative.introStep = 3; s.narrative.vow = payload;
      gainExp(s, 20); s.potions++; s.herbs += 2; s.mp = getStats(s).mp;
      addLog(s, `Sư phụ truyền Tụ Khí Quyết. Nhận 20 tu vi, 1 Linh đan và 2 linh thảo.${payload ? ` Đạo tâm: ${VOWS[payload].name}. ${VOWS[payload].effect}` : ''}`, 'story');
      return result(true, 'Đã lĩnh hội Tụ Khí Quyết. Hãy bắt đầu buổi chỉ điểm!', { introComplete: true });
    }
    case 'readChapter': {
      const index = Number(payload);
      if (!Number.isInteger(index) || index < 0 || index >= STORY.length || index > s.storyIndex) return result(false, 'Chương truyện chưa mở.');
      if (!s.narrative.seenChapters.includes(index)) s.narrative.seenChapters.push(index);
      return result(true, 'Đã ghi lại câu chuyện trong Tiên lộ ký.');
    }
    case 'attack': return attack(s, 'attack');
    case 'skill': return attack(s, 'skill', payload);
    case 'ultimate': return attack(s, 'ultimate');
    case 'guard': {
      if (!s.combat) return result(false, 'Chưa có đối thủ.');
      s.combat.guarding = true; s.qi = clamp(s.qi + 18, 0, 100); s.mp = Math.min(getStats(s).mp, s.mp + 18);
      addLog(s, 'Thủ thế · giảm 70% sát thương, hồi 18 linh lực và tích 18 Khí thế.', 'heal');
      return enemyTurn(s);
    }
    case 'potion': {
      if (s.potions < 1) return result(false, 'Hết Linh đan. Có thể luyện thêm tại Đan phòng.');
      if (s.hp >= getStats(s).hp && s.mp >= getStats(s).mp) return result(false, 'Sinh lực và linh lực đã đầy.');
      const healing = s.narrative?.vow === 'compassion' ? 0.6 : 0.5;
      s.potions--; s.hp = Math.min(getStats(s).hp, s.hp + Math.round(getStats(s).hp * healing)); s.mp = Math.min(getStats(s).mp, s.mp + 50);
      addLog(s, `Dùng Linh đan · hồi ${Math.round(healing * 100)}% sinh lực và 50 linh lực.`, 'heal');
      return s.combat ? enemyTurn(s) : result(true, 'Đã hồi phục bằng Linh đan.');
    }
    case 'flee': {
      if (!s.combat) return result(false, 'Ngươi đang ở ngoài giao tranh.');
      s.combat = null; s.qi = 0; addLog(s, 'Thu kiếm về vỏ. Lùi một bước để đi xa hơn.', 'hint');
      return result(true, 'Đã rời trận.');
    }
    case 'training': {
      if (s.combat) return result(false, 'Hãy kết thúc trận hiện tại trước.');
      startTraining(s); return result(true, 'Sư phụ đang chờ con.');
    }
    case 'gatherQi': {
      if (s.combat) return result(false, 'Không thể tụ khí khi đang giao tranh.');
      if (s.exp >= expRequired(s) * 10) return result(false, 'Tu vi đã đầy. Hãy đột phá trước khi tiếp tục tụ khí.');
      const reserve = qiReserve(s.cultivation, now);
      if (!reserve.charges) return result(false, 'Đã dùng hết lượt tụ khí. Có thể tĩnh tọa trong lúc chờ hồi phục.');
      s.cultivation = { charges: reserve.charges - 1, refillAt: reserve.refillAt || now + QI_REFILL_MS };
      const gained = Math.min(cultivationGain(s), expRequired(s) * 10 - s.exp);
      gainExp(s, gained); s.hp = getStats(s).hp; s.mp = getStats(s).mp; s.counters.meditations++; s.turns++;
      if (s.counters.meditations % 5 === 0) s.day++;
      addLog(s, `Vận chuyển Tụ Khí Quyết · +${gained} tu vi; sinh lực và linh lực hồi phục hoàn toàn.`, 'heal');
      return result(true, `Tụ khí thành công · +${gained} tu vi.`, { meditate: true, gained });
    }
    case 'meditate': {
      if (s.combat) return result(false, 'Không thể nhập định khi đang giao tranh.');
      const exp = Math.round((22 + s.stage * 5) * Math.pow(1.75, s.realm) * (s.narrative?.vow === 'resolve' ? 1.05 : 1));
      gainExp(s, exp); s.hp = getStats(s).hp; s.mp = getStats(s).mp; s.counters.meditations++; s.turns++;
      if (s.counters.meditations % 5 === 0) s.day++;
      addLog(s, `Tĩnh tọa dưới cổ tùng. +${exp} tu vi; sinh lực và linh lực hồi phục hoàn toàn.`, 'heal');
      return result(true, `Nhập định thành công · +${exp} tu vi.`, { meditate: true });
    }
    case 'breakthrough': {
      if (s.combat) return result(false, 'Hãy rời giao tranh trước khi đột phá.');
      if (s.realm === 29 && s.stage === 9) return result(false, 'Ngươi đã đạt đỉnh Vô Thượng. Hãy tiếp tục khám phá tiên lộ.');
      if (s.exp < expRequired(s)) return result(false, `Cần thêm ${expRequired(s) - s.exp} tu vi để đột phá.`);
      const cost = breakthroughCost(s);
      if (s.gold < cost) return result(false, `Cần ${cost} linh thạch để bố trí Tụ Linh Trận.`);
      s.gold -= cost; s.exp -= expRequired(s);
      if (s.stage < 9) s.stage++; else { s.stage = 1; s.realm++; s.jade += 10; }
      s.hp = getStats(s).hp; s.mp = getStats(s).mp;
      addLog(s, `Thiên địa cộng hưởng! Đột phá ${realmLabel(s)}. Căn cơ, sinh lực và sức mạnh tăng trưởng.`, 'reward');
      return result(true, `Đột phá thành công · ${realmLabel(s)}!`, { breakthrough: true });
    }
    case 'travel': {
      const region = REGIONS.find(r => r.id === payload);
      if (!region) return result(false, 'Vùng đất không tồn tại.');
      if (s.combat) return result(false, 'Hãy kết thúc hoặc rời trận trước khi di chuyển.');
      if (region.realm > s.realm) return result(false, `Cần đạt ${REALMS[region.realm].name} để đi tới đây.`);
      s.region = Number(region.id.split('-')[1]);
      if (!s.discovered.includes(region.id)) s.discovered.push(region.id);
      addLog(s, `Đặt chân tới ${region.name}. ${region.description}`, 'story');
      return result(true, `Đã đến ${region.name}.`);
    }
    case 'explore': {
      if (s.combat) return result(false, 'Đối thủ vẫn đang chờ. Hãy kết thúc giao tranh trước.');
      s.counters.explorations++; s.turns++; if (s.turns % 8 === 0) s.day++;
      const roll = random(s);
      if (roll < 0.18) {
        const amount = Math.round(30 + random(s) * 70 * (s.realm + 1)); s.gold += amount; s.herbs += 2;
        gainExp(s, 12 * (s.realm + 1));
        addLog(s, `Dưới gốc cổ thụ, tìm được túi càn khôn cũ: +${amount} linh thạch · +2 linh thảo · +${12 * (s.realm + 1)} tu vi.`, 'reward');
        return result(true, `Cơ duyên! Tìm được ${amount} linh thạch và linh thảo.`);
      }
      if (roll < 0.28) {
        const npc = NPCS[s.region * 5 + 3];
        s.relationships[npc.id] = (s.relationships[npc.id] || 0) + 5; s.herbs += 1;
        gainExp(s, 18 * (s.realm + 1));
        addLog(s, `Gặp ${npc.name}: “${npc.dialogue}” +${18 * (s.realm + 1)} tu vi · +1 linh thảo.`, 'story');
        return result(true, `Kỳ ngộ với ${npc.name}.`);
      }
      const index = s.region * 10 + Math.floor(random(s) * 10), monster = MONSTERS[index];
      s.combat = { ...monster, type: 'monster', maxHp: monster.hp, turn: 1, guarding: false, shielded: false }; s.qi = 0;
      addLog(s, `${monster.boss ? 'THỦ LĨNH XUẤT HIỆN! ' : ''}${monster.name} chặn đường. Hãy cẩn thận!`, 'enemy');
      return result(true, `Chạm trán ${monster.name}!`, { encounter: true });
    }
    case 'equip': {
      const item = ITEM_BY_ID[payload];
      if (!item || !s.inventory.includes(payload)) return result(false, 'Ngươi chưa sở hữu trang bị này.');
      if (item.realm > s.realm) return result(false, `Cần đạt ${REALMS[item.realm].name} để sử dụng.`);
      if (s.combat) return result(false, 'Không thể đổi trang bị giữa trận.');
      s.equipped[item.slot] = payload; s.hp = Math.min(s.hp, getStats(s).hp);
      return result(true, `Đã trang bị ${item.name}.`);
    }
    case 'unequip': {
      if (!SLOTS.includes(payload) || !s.equipped[payload]) return result(false, 'Vị trí này chưa có trang bị.');
      if (s.combat) return result(false, 'Không thể tháo trang bị giữa trận.');
      const item = ITEM_BY_ID[s.equipped[payload]];
      delete s.equipped[payload];
      s.hp = Math.min(s.hp, getStats(s).hp);
      return result(true, `Đã tháo ${item.name}. Vật phẩm vẫn nằm trong hành trang.`);
    }
    case 'sell': {
      const item = ITEM_BY_ID[payload];
      if (!item || !s.inventory.includes(payload)) return result(false, 'Không tìm thấy vật phẩm.');
      if (Object.values(s.equipped).includes(payload)) return result(false, 'Hãy thay trang bị đang dùng trước khi bán.');
      const value = Math.floor(item.price * 0.4); s.gold += value; s.inventory = s.inventory.filter(id => id !== payload);
      return result(true, `Đã bán ${item.name} · +${value} linh thạch.`);
    }
    case 'buy': {
      const item = ITEM_BY_ID[payload];
      if (!item || item.realm > s.realm) return result(false, 'Trang bị chưa được mở khóa.');
      if (s.inventory.includes(payload)) return result(false, 'Ngươi đã sở hữu trang bị này.');
      if (s.gold < item.price) return result(false, 'Không đủ linh thạch.');
      s.gold -= item.price; s.inventory.push(payload);
      return result(true, `Đã mua ${item.name}.`);
    }
    case 'supplies': {
      if (payload === 'herbs') {
        if (s.gold < 50) return result(false, 'Cần 50 linh thạch.');
        s.gold -= 50; s.herbs += 5; return result(true, 'Đã mua 5 linh thảo.');
      }
      if (payload === 'potion') {
        if (s.gold < 60) return result(false, 'Cần 60 linh thạch.');
        s.gold -= 60; s.potions++; return result(true, 'Đã mua 1 Linh đan.');
      }
      if (payload === 'blessing') {
        if (s.combat) return result(false, 'Hãy rời trận trước khi dùng Tụ Linh Phù.');
        if (s.jade < 5) return result(false, 'Cần 5 tiên ngọc.');
        s.jade -= 5; const exp = Math.round(100 * Math.pow(1.75, s.realm)); gainExp(s, exp);
        return result(true, `Tụ Linh Phù · +${exp} tu vi.`);
      }
      return result(false, 'Vật phẩm không tồn tại.');
    }
    case 'learn': {
      const skill = SKILL_BY_ID[payload];
      if (!skill || skill.realm > s.realm) return result(false, 'Cảnh giới chưa đủ để lĩnh ngộ.');
      if (s.knownSkills.includes(payload)) return result(false, 'Ngươi đã lĩnh ngộ công pháp này.');
      if (s.gold < skill.price) return result(false, 'Không đủ linh thạch để đổi bí tịch.');
      s.gold -= skill.price; s.knownSkills.push(payload);
      return result(true, `Đã lĩnh ngộ ${skill.name}.`);
    }
    case 'loadout': {
      if (s.combat) return result(false, 'Không thể đổi công pháp giữa trận.');
      if (!s.knownSkills.includes(payload)) return result(false, 'Chưa lĩnh ngộ công pháp.');
      if (s.loadout.includes(payload)) { s.loadout = s.loadout.filter(id => id !== payload); return result(true, 'Đã gỡ công pháp khỏi thanh chiêu thức.'); }
      if (s.loadout.length >= 3) return result(false, 'Chỉ được mang 3 công pháp. Hãy gỡ một công pháp trước.');
      s.loadout.push(payload); return result(true, 'Đã trang bị công pháp.');
    }
    case 'acceptQuest': {
      const q = QUESTS.find(q => q.id === payload);
      if (!q || q.main || q.realm > s.realm || s.claimed.includes(q.id)) return result(false, 'Nhiệm vụ chưa sẵn sàng.');
      if (q.id in s.questStarts) return result(false, 'Đã nhận nhiệm vụ này.');
      s.questStarts[q.id] = s.counters[q.goal] || 0;
      return result(true, `Đã nhận nhiệm vụ: ${q.name}.`);
    }
    case 'claimQuest': {
      const q = QUESTS.find(q => q.id === payload);
      if (!q || s.claimed.includes(payload)) return result(false, 'Phần thưởng đã nhận hoặc nhiệm vụ không tồn tại.');
      if (q.main && q.id !== `quest-${s.storyIndex}`) return result(false, 'Hãy hoàn thành chương truyện hiện tại.');
      if (!q.main && !(q.id in s.questStarts)) return result(false, 'Hãy nhận nhiệm vụ trước.');
      if (!isQuestReady(s, q)) return result(false, 'Chưa hoàn thành mục tiêu nhiệm vụ.');
      s.claimed.push(payload); s.gold += q.gold; gainExp(s, q.exp);
      if (q.main) { s.storyIndex++; s.jade += 5; }
      addLog(s, `Hoàn thành “${q.name}” · +${q.exp} tu vi · +${q.gold} linh thạch${q.main ? ' · +5 tiên ngọc' : ''}.`, 'reward');
      return result(true, `Đã nhận thưởng “${q.name}”.`, { chapter: q.main });
    }
    case 'talk': {
      const npc = NPCS.find(n => n.id === payload);
      if (!npc || npc.region !== s.region) return result(false, 'Nhân vật này không ở vùng hiện tại.');
      if (s.combat) return result(false, 'Không thể trò chuyện giữa giao tranh.');
      const visit = `${npc.id}-${s.day}`;
      if (!s.talked.includes(visit)) {
        s.talked.push(visit); s.relationships[npc.id] = (s.relationships[npc.id] || 0) + 5;
        gainExp(s, 8 * (s.realm + 1));
        if (npc.role === 'Luyện đan sư') s.herbs += 2;
      }
      addLog(s, `${npc.name}: “${npc.dialogue}”`, 'story');
      return result(true, npc.dialogue, { npc });
    }
    case 'craft': {
      const recipe = RECIPES.find(r => r.id === payload);
      if (!recipe || recipe.realm > s.realm) return result(false, 'Chưa đủ cảnh giới để luyện đan này.');
      if (s.combat) return result(false, 'Không thể luyện đan trong giao tranh.');
      if (s.gold < recipe.cost || s.herbs < recipe.herbs) return result(false, `Cần ${recipe.cost} linh thạch và ${recipe.herbs} linh thảo.`);
      s.gold -= recipe.cost; s.herbs -= recipe.herbs; s.counters.crafted++;
      if (recipe.effect === 'exp') gainExp(s, recipe.value); else s.potions++;
      addLog(s, `Luyện thành ${recipe.name}${recipe.effect === 'exp' ? ` · +${recipe.value} tu vi` : ' · +1 Linh đan (hồi máu và linh lực)'}.`, 'reward');
      return result(true, `Luyện đan thành công! ${recipe.effect === 'exp' ? `+${recipe.value} tu vi.` : '+1 Linh đan.'}`);
    }
    case 'name': {
      const name = String(payload || '').trim().slice(0, 24);
      if (name.length < 2) return result(false, 'Đạo hiệu cần từ 2 đến 24 ký tự.');
      s.name = name; return result(true, `Đạo hiệu mới: ${name}.`);
    }
    case 'sound': s.settings.sound = !s.settings.sound; return result(true, s.settings.sound ? 'Đã bật âm thanh.' : 'Đã tắt âm thanh.');
    case 'motion': s.settings.reducedMotion = !s.settings.reducedMotion; return result(true, s.settings.reducedMotion ? 'Đã giảm hiệu ứng chuyển động.' : 'Đã bật hiệu ứng chuyển động.');
    default: return result(false, 'Thao tác không tồn tại.');
  }
}

// Validate imported and persisted saves before accepting them as game state.
export function parseSave(raw) {
  const s = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  if (!s || s.version !== SAVE_VERSION || typeof s.name !== 'string' || s.name.length < 2 || s.name.length > 24) throw new Error('Tệp lưu không hợp lệ.');
  // Older saves had no cutscene state. Preserve their progress without replaying onboarding.
  if (s.narrative === undefined) s.narrative = createNarrative(true);
  if (s.cultivation === undefined) s.cultivation = createCultivation();
  const cultivation = s.cultivation;
  if (!cultivation || !Number.isInteger(cultivation.charges) || cultivation.charges < 0 || cultivation.charges > QI_CAPACITY || !Number.isSafeInteger(cultivation.refillAt) || cultivation.refillAt < 0 || cultivation.refillAt > 8640000000000000 || (cultivation.charges < QI_CAPACITY && !cultivation.refillAt) || (cultivation.charges === QI_CAPACITY && cultivation.refillAt !== 0)) throw new Error('Dữ liệu tụ khí không hợp lệ.');
  s.cultivation = { charges: cultivation.charges, refillAt: cultivation.refillAt };
  const narrative = s.narrative;
  if (!narrative || typeof narrative.introComplete !== 'boolean' || !Number.isInteger(narrative.introStep) || narrative.introStep < 0 || narrative.introStep > 3 || (narrative.vow !== null && !Object.hasOwn(VOWS, narrative.vow)) || (!narrative.introComplete && narrative.vow !== null) || !Array.isArray(narrative.seenChapters) || narrative.seenChapters.some(index => !Number.isInteger(index) || index < 0 || index >= STORY.length || index > s.storyIndex)) throw new Error('Dữ liệu đối thoại không hợp lệ.');
  const numbers = ['realm', 'stage', 'exp', 'gold', 'jade', 'hp', 'mp', 'qi', 'region', 'day', 'turns', 'herbs', 'potions', 'storyIndex', 'nextLog', 'seed'];
  for (const k of numbers) if (!Number.isFinite(s[k]) || s[k] < 0 || s[k] > 1e15 || !Number.isInteger(s[k])) throw new Error('Dữ liệu số trong tệp lưu không hợp lệ.');
  if (s.realm > 29 || s.stage < 1 || s.stage > 9 || s.region > 119 || REGIONS[s.region].realm > s.realm || s.storyIndex > STORY.length || s.qi > 100 || s.seed > 0xffffffff) throw new Error('Tiến trình trong tệp lưu không hợp lệ.');
  for (const k of ['inventory', 'knownSkills', 'loadout', 'claimed', 'discovered', 'talked', 'logs']) if (!Array.isArray(s[k]) || s[k].length > 100000) throw new Error('Danh sách trong tệp lưu không hợp lệ.');
  if (!s.equipped || typeof s.equipped !== 'object' || !s.counters || !s.questStarts || !s.relationships || !s.settings) throw new Error('Thiếu dữ liệu nhân vật.');
  if (s.inventory.some(id => !ITEM_BY_ID[id]) || s.knownSkills.some(id => !SKILL_BY_ID[id]) || s.loadout.some(id => !s.knownSkills.includes(id)) || s.loadout.length > 3) throw new Error('Vật phẩm hoặc công pháp không hợp lệ.');
  for (const [slot, id] of Object.entries(s.equipped)) if (!SLOTS.includes(slot) || !s.inventory.includes(id) || ITEM_BY_ID[id].slot !== slot || ITEM_BY_ID[id].realm > s.realm) throw new Error('Trang bị không hợp lệ.');
  for (const key of ['training', 'kills', 'explorations', 'meditations', 'crafted']) if (!Number.isSafeInteger(s.counters[key]) || s.counters[key] < 0) throw new Error('Thống kê không hợp lệ.');
  if (s.claimed.some(id => !QUESTS.some(q => q.id === id)) || s.discovered.some(id => !REGIONS.some(r => r.id === id))) throw new Error('Mục lục tiến trình không hợp lệ.');
  for (const [id, value] of Object.entries(s.questStarts)) if (!QUESTS.some(q => q.id === id && !q.main) || !Number.isSafeInteger(value) || value < 0) throw new Error('Nhiệm vụ không hợp lệ.');
  for (const [id, value] of Object.entries(s.relationships)) if (!NPCS.some(n => n.id === id) || !Number.isSafeInteger(value) || value < 0) throw new Error('Quan hệ không hợp lệ.');
  for (const log of s.logs) if (!log || typeof log.text !== 'string' || typeof log.tone !== 'string' || !Number.isSafeInteger(log.id)) throw new Error('Nhật ký không hợp lệ.');
  if (s.combat !== null) {
    const c = s.combat;
    if (!c || !['training', 'monster'].includes(c.type) || typeof c.name !== 'string') throw new Error('Trận đấu không hợp lệ.');
    if (c.shielded !== undefined && typeof c.shielded !== 'boolean') throw new Error('Trạng thái hộ thể không hợp lệ.');
    for (const key of ['hp', 'maxHp', 'attack', 'defense', 'turn']) if (!Number.isFinite(c[key]) || c[key] < 0 || c[key] > 1e15) throw new Error('Trận đấu không hợp lệ.');
    if (c.hp > c.maxHp || c.maxHp < 1 || c.turn < 1 || (c.type === 'monster' && (!MONSTERS.some(m => m.id === c.id) || !Number.isFinite(c.exp) || c.exp < 0 || !Number.isFinite(c.gold) || c.gold < 0))) throw new Error('Trận đấu không hợp lệ.');
    if (c.type === 'monster') {
      const original = MONSTERS.find(m => m.id === c.id);
      if (c.maxHp !== original.hp) throw new Error('Sinh lực yêu thú không hợp lệ.');
      s.combat = { ...original, type: 'monster', hp: c.hp, maxHp: original.hp, turn: Math.floor(c.turn), guarding: c.guarding === true, ...(c.shielded === undefined ? {} : { shielded: c.shielded }) };
    } else {
      if (c.maxHp !== 9999) throw new Error('Trận chỉ điểm không hợp lệ.');
      s.combat = { type: 'training', name: 'Mặc Vô Trần', hp: c.hp, maxHp: 9999, attack: 6, defense: 2, turn: Math.floor(c.turn), guarding: c.guarding === true };
    }
  }
  s.settings = { sound: s.settings.sound === true, reducedMotion: s.settings.reducedMotion === true };
  s.hp = Math.min(s.hp, getStats(s).hp); s.mp = Math.min(s.mp, getStats(s).mp);
  return s;
}
