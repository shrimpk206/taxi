// localStorage 기반 주행 기록.
// 키: "taxi.rides"  값: [{ id, startTs, endTs, distanceM, fareKrw, kisses, nightRate, outsideSeoul }, ...]

const KEY = 'taxi.rides';

export function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function save(ride) {
  const all = loadAll();
  const entry = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), ...ride };
  all.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(all));
  return entry;
}

export function remove(id) {
  const all = loadAll().filter((r) => r.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearAll() {
  localStorage.removeItem(KEY);
}

export function totalKisses() {
  return loadAll().reduce((sum, r) => sum + (r.kisses || 0), 0);
}
