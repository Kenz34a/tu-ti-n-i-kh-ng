import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CONTENT_COUNT, REGIONS, MONSTERS, EQUIPMENT, SKILLS, QUESTS, STORY } from '../src/data.js';
import { newGame, dispatch, getStats, expRequired, parseSave, questProgress, isQuestReady } from '../src/engine.js';

function outside() { const s=newGame();dispatch(s,'flee');return s; }
function monsterFight(s, index=0) { const m=MONSTERS[index];s.combat={...m,type:'monster',maxHp:m.hp,turn:1,guarding:false};s.qi=0;return s; }

test('catalog contains exactly 5,000 valid and individually addressable entries',()=>{
  assert.equal(CONTENT_COUNT,5000);
  const all=Object.values(CATALOG).flat();
  assert.equal(new Set(all.map(e=>e.id)).size,5000);
  for(const e of all) {
    assert.ok(e.name,`Missing name: ${e.id}`);
    if(e.realm!==undefined)assert.ok(e.realm>=0&&e.realm<30);
    if(e.region!==undefined)assert.ok(REGIONS[e.region]);
  }
  for(const c of Object.values(CATALOG))assert.equal(new Set(c.map(e=>e.name)).size,c.length,'Names should distinguish catalog variants');
  assert.equal(STORY.length,20);assert.equal(QUESTS.filter(q=>q.main).length,20);
});
test('tutorial requires accumulating energy and casting the ultimate; it unlocks the story reward',()=>{
  const s=newGame();
  assert.equal(dispatch(s,'ultimate').ok,false);
  for(let i=0;i<4;i++)assert.equal(dispatch(s,'attack').ok,true);
  assert.equal(s.qi,100);assert.ok(s.hp>0);
  assert.equal(dispatch(s,'ultimate').victory,true);assert.equal(s.combat,null);assert.equal(s.counters.training,1);
  const gold=s.gold;assert.equal(dispatch(s,'claimQuest','quest-0').ok,true);
  assert.equal(s.storyIndex,1);assert.ok(s.gold>gold);
  assert.equal(dispatch(s,'claimQuest','quest-0').ok,false,'Cannot claim rewards twice');
});
test('skills consume mana and the same mana cannot be spent twice',()=>{
  const s=newGame();s.mp=13;const before=structuredClone(s);
  assert.equal(dispatch(s,'skill','skill-0').ok,false);assert.deepEqual(s,before);
  s.mp=30;assert.equal(dispatch(s,'skill','skill-0').ok,true);assert.equal(s.mp,16);assert.equal(s.qi,30);
  assert.equal(dispatch(s,'skill','skill-19').ok,false,'Unknown or unequipped skills are unavailable');
});
test('guard mitigates the immediate enemy hit and restores mana',()=>{
  const a=monsterFight(outside(),9),b=structuredClone(a);a.mp=0;b.mp=0;
  const hp=a.hp;dispatch(a,'guard');dispatch(b,'attack');
  assert.ok(hp-a.hp<hp-b.hp);assert.equal(a.mp,18);assert.equal(a.qi,18);assert.equal(a.combat.guarding,false);
});
test('healing skill and potions restore vitals, consume resources and advance combat',()=>{
  const s=newGame();s.hp=20;
  dispatch(s,'skill','skill-5');assert.ok(s.hp>20);assert.equal(s.combat.turn,2);
  const potions=s.potions;s.hp=20;s.mp=0;dispatch(s,'potion');
  assert.equal(s.potions,potions-1);assert.ok(s.hp>20);assert.equal(s.mp,50);assert.equal(s.combat.turn,3);
  const peaceful=outside(),before=peaceful.potions;assert.equal(dispatch(peaceful,'potion').ok,false);assert.equal(peaceful.potions,before);
});
test('victory grants enemy-specific rewards and defeat revives without erasing progress',()=>{
  const s=monsterFight(outside());const before={exp:s.exp,gold:s.gold};
  for(let i=0;i<10&&s.combat;i++)dispatch(s,'attack');
  assert.equal(s.combat,null);assert.equal(s.counters.kills,1);assert.ok(s.exp>before.exp);assert.ok(s.gold>before.gold);assert.ok(s.herbs>8);
  monsterFight(s,9);s.hp=1;s.combat.attack=10000;const exp=s.exp,gold=s.gold;
  assert.equal(dispatch(s,'attack').defeat,true);assert.equal(s.combat,null);assert.equal(s.hp,getStats(s).hp);assert.equal(s.exp,exp);assert.equal(s.gold,gold-Math.floor(gold*.05));
});
test('exploration produces both encounters and noncombat rewards through a deterministic seed',()=>{
  const s=outside();let encounters=0,finds=0;
  for(let i=0;i<30;i++){const r=dispatch(s,'explore');assert.equal(r.ok,true);if(r.encounter){encounters++;dispatch(s,'flee');}else finds++;}
  assert.equal(s.counters.explorations,30);assert.ok(encounters>0);assert.ok(finds>0);assert.ok(s.day>1);
});
test('meditation and breakthrough have resource gates and unlock the next realm after nine stages',()=>{
  const s=newGame();assert.equal(dispatch(s,'meditate').ok,false);dispatch(s,'flee');
  const exp=s.exp;dispatch(s,'meditate');assert.ok(s.exp>exp);assert.equal(s.hp,getStats(s).hp);
  s.exp=0;assert.equal(dispatch(s,'breakthrough').ok,false);
  s.exp=expRequired(s);s.gold=0;assert.equal(dispatch(s,'breakthrough').ok,false);
  s.gold=10000;s.stage=9;s.exp=expRequired(s);const stats=getStats(s);
  assert.equal(dispatch(s,'breakthrough').breakthrough,true);assert.equal(s.realm,1);assert.equal(s.stage,1);for(const key of ['hp','mp','attack','defense'])assert.ok(getStats(s)[key]>stats[key],`${key} must improve across realms`);assert.equal(s.hp,getStats(s).hp);
});
test('world travel obeys realm restrictions and cannot interrupt combat',()=>{
  const s=newGame();assert.equal(dispatch(s,'travel','region-1').ok,false);dispatch(s,'flee');
  assert.equal(dispatch(s,'travel','region-4').ok,false);assert.equal(dispatch(s,'travel','region-3').ok,true);assert.equal(s.region,3);assert.ok(s.discovered.includes('region-3'));
  s.realm=1;assert.equal(dispatch(s,'travel','region-4').ok,true);assert.equal(dispatch(s,'travel','region-999').ok,false);
});
test('equipment affects attributes and cannot be sold while worn',()=>{
  const s=outside();const atk=getStats(s).attack;
  assert.equal(dispatch(s,'equip','item-18').ok,true);assert.ok(getStats(s).attack>atk);
  assert.equal(dispatch(s,'sell','item-18').ok,false);
  const gold=s.gold;assert.equal(dispatch(s,'sell','item-0').ok,true);assert.ok(s.gold>gold);assert.ok(!s.inventory.includes('item-0'));
  assert.equal(dispatch(s,'equip','item-60').ok,false);
});
test('buying, learning and the three-skill limit preserve currencies and ownership',()=>{
  const s=outside();s.gold=10000;
  const price=EQUIPMENT[12].price,before=s.gold;assert.equal(dispatch(s,'buy','item-12').ok,true);assert.equal(s.gold,before-price);assert.equal(dispatch(s,'buy','item-12').ok,false);
  assert.equal(dispatch(s,'learn','skill-2').ok,true);assert.ok(s.knownSkills.includes('skill-2'));assert.equal(dispatch(s,'learn','skill-2').ok,false);
  assert.equal(dispatch(s,'loadout','skill-2').ok,false);dispatch(s,'loadout','skill-1');assert.equal(dispatch(s,'loadout','skill-2').ok,true);assert.equal(s.loadout.length,3);
});
test('commissions begin counting after acceptance and grant rewards exactly once',()=>{
  const s=outside(),q=QUESTS[20];s.counters.kills=100;
  assert.equal(dispatch(s,'claimQuest',q.id).ok,false);dispatch(s,'acceptQuest',q.id);assert.equal(questProgress(s,q),0);
  s.counters.kills+=q.target;assert.equal(isQuestReady(s,q),true);assert.equal(dispatch(s,'claimQuest',q.id).ok,true);assert.equal(dispatch(s,'claimQuest',q.id).ok,false);
  assert.equal(dispatch(s,'claimQuest','quest-19').ok,false,'Cannot skip story chapters');
});
test('NPCs are local and reward the player once per game day',()=>{
  const s=outside();assert.equal(dispatch(s,'talk','npc-5').ok,false);
  const exp=s.exp;assert.equal(dispatch(s,'talk','npc-0').ok,true);assert.ok(s.exp>exp);const first=s.exp;
  dispatch(s,'talk','npc-0');assert.equal(s.exp,first);assert.equal(s.relationships['npc-0'],5);
  s.day++;dispatch(s,'talk','npc-0');assert.ok(s.exp>first);assert.equal(s.relationships['npc-0'],10);
});
test('crafting consumes actual materials and provides usable consumables or cultivation',()=>{
  const s=outside();let herbs=s.herbs,potions=s.potions;assert.equal(dispatch(s,'craft','recipe-0').ok,true);assert.equal(s.herbs,herbs-2);assert.equal(s.potions,potions+1);
  const exp=s.exp;assert.equal(dispatch(s,'craft','recipe-2').ok,true);assert.ok(s.exp>exp);
  s.herbs=0;const before=structuredClone(s);assert.equal(dispatch(s,'craft','recipe-0').ok,false);assert.deepEqual(s,before);
});
test('supplies consume their respective currencies',()=>{
  const s=outside(),gold=s.gold,jade=s.jade;
  dispatch(s,'supplies','herbs');assert.equal(s.gold,gold-50);assert.equal(s.herbs,13);
  dispatch(s,'supplies','blessing');assert.equal(s.jade,jade-5);assert.ok(s.exp>38);
  s.jade=0;assert.equal(dispatch(s,'supplies','blessing').ok,false);
});
test('save roundtrip preserves live combat and rejects malformed or impossible data',()=>{
  const s=newGame();dispatch(s,'attack');assert.deepEqual(parseSave(JSON.stringify(s)),s);
  for(const mutate of [s=>s.realm=30,s=>s.stage=0,s=>s.gold=-1,s=>s.inventory.push('item-9999'),s=>s.loadout.push('skill-88'),s=>s.equipped.weapon='item-1',s=>s.combat.hp=Infinity,s=>s.counters.kills='2',s=>s.logs[0].text=null,s=>s.questStarts.unknown=1,s=>s.relationships.unknown=1]){
    const bad=structuredClone(s);mutate(bad);assert.throws(()=>parseSave(bad));
  }
  assert.throws(()=>parseSave('{bad json}'));
});
test('all thirty realms have reachable advancement and unlocked catalog tiers',()=>{
  const s=outside();
  for(let realm=0;realm<30;realm++){
    s.realm=realm;s.stage=9;s.gold=1e14;s.exp=expRequired(s);s.hp=getStats(s).hp;
    assert.ok(SKILLS.some(sk=>sk.realm===realm));assert.ok(EQUIPMENT.some(item=>item.realm===realm));
    assert.equal(dispatch(s,'travel',`region-${realm*4}`).ok,true);
    const response=dispatch(s,'breakthrough');
    if(realm<29){assert.equal(response.ok,true);assert.equal(s.realm,realm+1);}else assert.equal(response.ok,false);
  }
});
