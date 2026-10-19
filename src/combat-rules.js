export const DISCIPLINES = { sword: 'Kiếm', fire: 'Hỏa', ice: 'Băng', lightning: 'Lôi', wood: 'Mộc', shadow: 'Ma đạo', spirit: 'Linh thuật', spear: 'Thương' };
const techniques = ['sword', 'fire', 'ice', 'sword', 'lightning', 'wood', 'spirit', 'shadow', 'sword', 'sword', 'sword', 'shadow', 'ice', 'sword', 'spirit', 'wood', 'spear', 'fire', 'shadow', 'sword'];
const beasts = [
  { weak: 'sword', resist: 'shadow', special: 'U Ảnh Vồ Mồi', shadow: true },
  { weak: 'ice', resist: 'fire', special: 'Xích Diệm Phệ Tâm' },
  { weak: 'lightning', resist: 'sword', special: 'Huyền Giáp Chấn Địa' },
  { weak: 'fire', resist: 'shadow', special: 'Ảnh Báo Tập Sát', shadow: true },
  { weak: 'ice', resist: 'wood', special: 'Độc Nha Xuyên Tâm' },
  { weak: 'lightning', resist: 'spear', special: 'Thiết Vũ Phá Không' },
  { weak: 'fire', resist: 'ice', special: 'Hàn Sương Hổ Khiếu' },
  { weak: 'wood', resist: 'lightning', special: 'Lôi Giác Xung Phong' },
  { weak: 'sword', resist: 'spirit', special: 'Ma Viên Toái Thạch' },
  { weak: 'fire', resist: 'wood', special: 'Cổ Mộc Triền Thân' },
];

export function skillDiscipline(skill) { return techniques[Number(skill?.id?.split('-')[1]) % 20] || 'spirit'; }
export function monsterProfile(enemy) {
  if (!enemy || enemy.type === 'training') return null;
  const match = /^monster-(\d+)$/.exec(enemy.id || '');
  return match ? beasts[Number(match[1]) % 10] : null;
}
export function affinityFactor(enemy, discipline) {
  const profile = monsterProfile(enemy);
  return profile?.weak === discipline ? 1.25 : profile?.resist === discipline ? .75 : 1;
}

// Used by both the actual hit and its preview, before one final rounding.
export function attackDamage({ attack, enemy, multiplier = 1, roll = 1, critical = false, discipline = 'sword' }) {
  const modifier = affinityFactor(enemy, discipline) * (enemy?.type !== 'training' && enemy?.shielded ? .5 : 1);
  return Math.max(1, Math.round((attack * multiplier * roll - (enemy?.defense || 0) * .35) * (critical ? 1.6 : 1) * modifier));
}

export function enemyIntent(enemy) {
  if (!monsterProfile(enemy)) return { kind: 'attack', name: 'Tấn công', multiplier: 1 };
  if (enemy.turn % 4 === 2) return { kind: 'guard', name: 'Hộ thể', multiplier: 0 };
  if (enemy.turn % 4 === 0) return { kind: 'special', name: monsterProfile(enemy).special, multiplier: 1.35 };
  return { kind: 'attack', name: 'Tấn công', multiplier: 1 };
}

export function enemyHitDamage({ enemy, defense, roll = 1, guarding = false }) {
  const intent = enemyIntent(enemy);
  if (intent.kind === 'guard') return 0;
  const damage = Math.max(1, Math.round(enemy.attack * intent.multiplier * roll - defense * .55));
  return guarding ? Math.max(1, Math.round(damage * .3)) : damage;
}

export function monsterTraits(enemy) {
  const profile = monsterProfile(enemy);
  return profile ? [
    { kind: 'resist', label: `Kháng ${DISCIPLINES[profile.resist]}`, description: `Giảm 25% sát thương nhận từ hệ ${DISCIPLINES[profile.resist]}.` },
    { kind: 'weak', label: `Yếu ${DISCIPLINES[profile.weak]}`, description: `Nhận thêm 25% sát thương từ hệ ${DISCIPLINES[profile.weak]}.` },
  ] : [];
}
