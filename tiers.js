// ============================================================
// tiers.js — rank tiers by best time (pure frontend, no DB)
// ============================================================

export const TIERS = [
  { max: 67,       name: '67 GOD',      th: 'เทพ 67',   emoji: '🔱', color: '#00F5FF' },
  { max: 120,      name: 'LIGHTNING',   th: 'สายฟ้า',   emoji: '⚡', color: '#FFE600' },
  { max: 200,      name: 'SPEEDSTER',   th: 'จอมสปีด',  emoji: '🚀', color: '#FF006E' },
  { max: 350,      name: 'QUICK HANDS', th: 'มือไว',    emoji: '🔥', color: '#FF8C00' },
  { max: 600,      name: 'RUNNER',      th: 'นักวิ่ง',  emoji: '🏃', color: '#7CFC00' },
  { max: 1200,     name: 'ROOKIE',      th: 'มือใหม่',  emoji: '🐣', color: '#E8E8FF' },
  { max: Infinity, name: 'SNAIL',       th: 'หอยทาก',   emoji: '🐌', color: '#8888AA' },
];

export function tierFor(ms) {
  return TIERS.find(t => ms < t.max) ?? TIERS[TIERS.length - 1];
}

export function tierBadge(ms, { withName = true } = {}) {
  const t = tierFor(ms);
  const span = document.createElement('span');
  span.className = 'tier-badge';
  span.style.color = t.color;
  span.textContent = withName ? `${t.emoji} ${t.name} · ${t.th}` : t.emoji;
  span.title = `${t.name} · ${t.th}`;
  return span;
}
