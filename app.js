// 메인 앱: 상태머신, 이벤트 와이어링, DOM 갱신.

import { createMeter, formatKrw } from './meter.js';
import { createGpsTracker } from './geo.js';
import { renderReceiptHtml, buildReceipt, kissesFor } from './receipt.js';
import * as sound from './sound.js';
import * as storage from './storage.js';
import { createMap } from './map.js';

const $ = (id) => document.getElementById(id);

const els = {
  fareLed: $('fareLed'),
  distStat: $('distStat'),
  timeStat: $('timeStat'),
  speedStat: $('speedStat'),
  nightChip: $('nightChip'),
  outsideChip: $('outsideChip'),
  timeFareChip: $('timeFareChip'),
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),
  outsideSeoul: $('outsideSeoul'),
  muteToggle: $('muteToggle'),
  historyBtn: $('historyBtn'),
  mapToggle: $('mapToggle'),
  mapContainer: $('mapContainer'),
  cumKissBadge: $('cumKissBadge'),
  // 모달
  receiptModal: $('receiptModal'),
  receiptHost: $('receiptHost'),
  saveRideBtn: $('saveRideBtn'),
  closeReceiptBtn: $('closeReceiptBtn'),
  historyModal: $('historyModal'),
  historyList: $('historyList'),
  closeHistoryBtn: $('closeHistoryBtn'),
  clearHistoryBtn: $('clearHistoryBtn'),
  toast: $('toast'),
};

// --- 상태 ---
let state = 'idle'; // idle | running | stopped
let meter = null;
let gps = null;
let mapApi = null;
let tickTimer = null;
let lastSample = { speedKmh: 0, elapsedSec: 0, distanceM: 0 };
let lastReceiptCtx = null; // 종료 직후 영수증 저장용
let lastSurchargeWasPositive = false;

// ---- 누적 뽀뽀 뱃지 ----
function refreshCumKiss() {
  els.cumKissBadge.textContent = `누적 뽀뽀 ${storage.totalKisses()} 💋`;
}
refreshCumKiss();

// ---- 시작/종료 ----
function start() {
  if (state === 'running') return;
  sound.primeAudio();

  meter = createMeter({ outsideSeoul: els.outsideSeoul.checked });
  gps = createGpsTracker({ onSample: handleSample, onError: handleGpsError });
  gps.start();

  state = 'running';
  els.startBtn.disabled = true;
  els.stopBtn.disabled = false;
  els.outsideSeoul.disabled = false;

  // 초기 표시 리셋
  updateFare(0, false);
  els.distStat.textContent = '0.00 km';
  els.timeStat.textContent = '00:00';
  els.speedStat.textContent = '0 km/h';
  els.timeFareChip.hidden = true;

  // 1초마다 경과시간/심야할증 업데이트 (GPS 콜백 사이 시간도 메꿈)
  tickTimer = setInterval(heartbeat, 1000);

  ensureMap(true);
  toast('GPS 추적 시작! 안전운행 하세요 🚕');
}

function stop() {
  if (state !== 'running') return;
  state = 'stopped';
  clearInterval(tickTimer);
  tickTimer = null;
  gps.stop();

  const endTs = Date.now();
  const startTs = gps.getStartTs() || endTs;
  const distanceM = gps.getTotalDistanceM();
  const snap = meter.snapshot();

  lastReceiptCtx = {
    startTs, endTs, distanceM, meterSnap: snap,
    outsideSeoul: els.outsideSeoul.checked,
  };

  els.receiptHost.innerHTML = renderReceiptHtml(lastReceiptCtx);
  els.receiptModal.hidden = false;

  els.startBtn.disabled = false;
  els.stopBtn.disabled = true;
}

function heartbeat() {
  if (state !== 'running') return;
  const now = Date.now();
  // GPS가 멈춰있어도 심야할증 전환은 반영되어야 함
  meter.tick({
    addedDistanceM: 0,
    addedTimeSec: 0, // 기본 요금 구간 안이거나 정지 중이면 시간요금은 이미 tick 쪽에서 속도 0으로 걸러짐
    totalDistanceM: gps.getTotalDistanceM(),
    speedKmh: lastSample.speedKmh,
    nowMs: now,
  });
  // 경과시간 표시
  const startTs = gps.getStartTs();
  if (startTs) {
    const sec = Math.floor((now - startTs) / 1000);
    els.timeStat.textContent = fmtElapsed(sec);
  }
  // 심야할증 표시 동기화
  refreshSurchargeChips(meter.snapshot());
}

function handleSample(sample) {
  if (sample.firstSample) {
    ensureMap(true, [sample.lat, sample.lon]);
    mapApi?.setPath([[sample.lat, sample.lon]]);
    return;
  }

  meter.tick({
    addedDistanceM: sample.addedDistanceM,
    addedTimeSec: sample.addedTimeSec,
    totalDistanceM: sample.totalDistanceM,
    speedKmh: sample.speedKmh,
    nowMs: sample.nowMs,
  });

  const snap = meter.snapshot();

  if (snap.fareBumped) {
    sound.bump();
    els.fareLed.classList.remove('bump');
    void els.fareLed.offsetWidth;
    els.fareLed.classList.add('bump');
  }

  // 시간요금 구간 진입 뱃지
  els.timeFareChip.hidden = !(sample.totalDistanceM >= 1600 && sample.speedKmh < 15);

  refreshSurchargeChips(snap);

  updateFare(snap.totalFare, snap.fareBumped);
  els.distStat.textContent = (sample.totalDistanceM / 1000).toFixed(2) + ' km';
  els.speedStat.textContent = Math.round(sample.speedKmh) + ' km/h';

  lastSample = { speedKmh: sample.speedKmh, elapsedSec: sample.elapsedSec, distanceM: sample.totalDistanceM };

  // 지도 경로 업데이트
  mapApi?.setPath(gps.getPath());
}

function refreshSurchargeChips(snap) {
  const hasNight = snap.nightRate > 0;
  const hasOutside = snap.outsideSeoul;

  if (hasNight) {
    els.nightChip.textContent = `심야할증 ${Math.round(snap.nightRate * 100)}%`;
    els.nightChip.hidden = false;
  } else {
    els.nightChip.hidden = true;
  }
  els.outsideChip.hidden = !hasOutside;

  const isPositive = snap.surchargeRate > 0;
  if (isPositive && !lastSurchargeWasPositive) {
    sound.surcharge();
  }
  lastSurchargeWasPositive = isPositive;
}

function handleGpsError(err) {
  console.warn('GPS error', err);
  const msg = err.code === 1
    ? '위치 권한을 허용해 주세요.'
    : err.code === 2
    ? '위치를 못 찾고 있어요 (실외/GPS 확인).'
    : '위치 오류가 발생했어요.';
  toast(msg);
}

function updateFare(n, bumped) {
  els.fareLed.textContent = formatKrw(n);
  if (bumped) {
    els.fareLed.classList.remove('bump');
    void els.fareLed.offsetWidth;
    els.fareLed.classList.add('bump');
  }
}

// ---- 지도 ----
function ensureMap(autoExpand = false, center = null) {
  if (mapApi) {
    if (center) mapApi.setPath([center]);
    mapApi.invalidate();
    return;
  }
  if (!window.L) {
    // Leaflet 아직 로드 전 → 재시도
    setTimeout(() => ensureMap(autoExpand, center), 300);
    return;
  }
  mapApi = createMap(els.mapContainer);
  if (autoExpand && els.mapContainer.hidden) {
    // 접힌 상태로 두지만 내부적으로는 초기화
  }
  // 지도 사이즈 계산 타이밍 보정
  setTimeout(() => mapApi?.invalidate(), 100);
}

els.mapToggle.addEventListener('click', () => {
  const show = els.mapContainer.hidden;
  els.mapContainer.hidden = !show;
  els.mapToggle.textContent = show ? '🗺  지도 접기  ▴' : '🗺  지도 펼치기  ▾';
  if (show) {
    ensureMap();
    setTimeout(() => {
      mapApi?.invalidate();
      mapApi?.fit(gps ? gps.getPath() : []);
    }, 60);
  }
});

// ---- 버튼 이벤트 ----
els.startBtn.addEventListener('click', start);
els.stopBtn.addEventListener('click', stop);

els.outsideSeoul.addEventListener('change', () => {
  if (meter) meter.setOutsideSeoul(els.outsideSeoul.checked);
});

els.muteToggle.addEventListener('change', () => {
  sound.setMuted(els.muteToggle.checked);
});

// ---- 영수증 모달 ----
els.closeReceiptBtn.addEventListener('click', () => {
  els.receiptModal.hidden = true;
});

els.saveRideBtn.addEventListener('click', () => {
  if (!lastReceiptCtx) return;
  const { startTs, endTs, distanceM, meterSnap, outsideSeoul } = lastReceiptCtx;
  const { totalFare, kisses } = buildReceipt(lastReceiptCtx);
  storage.save({
    startTs, endTs,
    distanceM: Math.round(distanceM),
    fareKrw: totalFare,
    kisses,
    nightRate: meterSnap.nightRate,
    outsideSeoul,
  });
  refreshCumKiss();
  els.receiptModal.hidden = true;
  toast(`기록에 저장했어요. 뽀뽀 +${kisses} 💋`);
});

// ---- 기록 모달 ----
els.historyBtn.addEventListener('click', () => {
  renderHistory();
  els.historyModal.hidden = false;
});
els.closeHistoryBtn.addEventListener('click', () => {
  els.historyModal.hidden = true;
});
els.clearHistoryBtn.addEventListener('click', () => {
  if (!confirm('모든 기록을 삭제할까요?')) return;
  storage.clearAll();
  refreshCumKiss();
  renderHistory();
});

function renderHistory() {
  const rides = storage.loadAll();
  if (rides.length === 0) {
    els.historyList.innerHTML = '<div class="history-empty">아직 기록이 없어요 🚕</div>';
    return;
  }
  els.historyList.innerHTML = rides.map(r => {
    const d = new Date(r.startTs);
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `
      <div class="history-item" data-id="${r.id}">
        <div class="left">
          <div>${date} · ${(r.distanceM/1000).toFixed(2)} km</div>
          <div>${formatKrw(r.fareKrw)} 원 · <span class="kisses">뽀뽀 ${r.kisses}</span></div>
        </div>
        <button class="del" aria-label="삭제">✕</button>
      </div>
    `;
  }).join('');

  els.historyList.querySelectorAll('.history-item').forEach(item => {
    const id = item.dataset.id;
    item.querySelector('.del').addEventListener('click', () => {
      storage.remove(id);
      refreshCumKiss();
      renderHistory();
    });
  });
}

// ---- 토스트 ----
let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2400);
}

// ---- 유틸 ----
function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---- 서비스워커 ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 개발 중엔 무시 */ });
  });
}

// 초기 요금 표시
updateFare(0, false);
