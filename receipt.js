// 택시 영수증 모달 렌더링 + 뽀뽀 환산.
// 정산: 1,000원당 뽀뽀 1회, 천원 미만 올림.

import { formatKrw } from './meter.js';

export function kissesFor(fareKrw) {
  if (fareKrw <= 0) return 0;
  return Math.ceil(fareKrw / 1000);
}

export function buildReceipt({ startTs, endTs, distanceM, meterSnap }) {
  const {
    baseFare,
    distanceFareRaw,
    timeFareRaw,
    preSurchargeFare,
    nightRate,
    outsideSeoul,
    surchargeAmount,
    totalFare,
  } = meterSnap;

  const kisses = kissesFor(totalFare);

  const rows = [
    ['승차시간', fmtTime(startTs)],
    ['하차시간', fmtTime(endTs)],
    ['주행거리', `${(distanceM / 1000).toFixed(2)} km`],
    ['기본요금', `${formatKrw(baseFare)} 원`],
  ];
  if (distanceFareRaw > 0) rows.push(['거리요금', `${formatKrw(distanceFareRaw)} 원`]);
  if (timeFareRaw > 0) rows.push(['시간요금', `${formatKrw(timeFareRaw)} 원`]);
  if (surchargeAmount > 0) {
    const labels = [];
    if (nightRate > 0) labels.push(`심야 ${Math.round(nightRate * 100)}%`);
    if (outsideSeoul) labels.push('시계외 20%');
    rows.push([`할증 ${labels.join('+')}`, `+${formatKrw(surchargeAmount)} 원`]);
  }

  return { rows, totalFare, kisses };
}

export function renderReceiptHtml({ startTs, endTs, distanceM, meterSnap }) {
  const { rows, totalFare, kisses } = buildReceipt({ startTs, endTs, distanceM, meterSnap });
  const rowsHtml = rows
    .map(([k, v]) => `<div class="rc-row"><span>${k}</span><span>${v}</span></div>`)
    .join('');

  return `
    <div class="receipt">
      <div class="rc-title">영수증  RECEIPT</div>
      <div class="rc-sep"></div>
      ${rowsHtml}
      <div class="rc-sep dashed"></div>
      <div class="rc-row rc-total"><span>합계</span><span>${formatKrw(totalFare)} 원</span></div>
      <div class="rc-sep"></div>
      <div class="rc-kiss">뽀뽀 × ${kisses} 회</div>
      <div class="rc-note">1,000원당 뽀뽀 1회 · 천원 미만 올림 🥰</div>
      <div class="rc-sep"></div>
    </div>
  `;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
