export const QI_CAPACITY = 10;
export const QI_REFILL_MS = 3 * 60 * 60 * 1000;

export const createCultivation = () => ({ charges: QI_CAPACITY, refillAt: 0 });

// A whole batch refills three hours after its first use, including time offline.
// Reading the clock never changes the save or moves its deadline.
export function qiReserve(cultivation, now = Date.now()) {
  const value = cultivation || createCultivation();
  if (!value.refillAt || now >= value.refillAt) return { ...createCultivation(), remaining: 0 };
  return { ...value, remaining: Math.min(QI_REFILL_MS, value.refillAt - now) };
}

export function cultivationGain(state) {
  return Math.round((52 + state.stage * 8) * Math.pow(1.75, state.realm) * (state.narrative?.vow === 'resolve' ? 1.05 : 1));
}

export function formatRefill(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export const breakthroughCost = state => Math.round((50 + state.stage * 20) * Math.pow(1.5, state.realm));
