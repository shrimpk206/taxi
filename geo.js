// GPS 추적 + 거리 계산 + 잡음 필터.
// watchPosition 콜백이 매번 호출되므로, 콜백 내부에서
// 비정상 샘플(정확도 나쁨 / 순간이동 / 미세 진동)을 걸러낸다.

const EARTH_RADIUS_M = 6371000;
const ACCURACY_THRESHOLD_M = 50;        // accuracy가 이 값보다 크면 폐기
const SPEED_SANITY_KMH = 150;           // 이 속도보다 빠르면 GPS 튐
const JITTER_THRESHOLD_M = 3;           // 이 거리 미만은 "정지"로 간주

export function createGpsTracker({ onSample, onError }) {
  let watchId = null;
  let previous = null;  // { lat, lon, ts }
  let totalDistanceM = 0;
  let startTs = null;
  let path = [];        // 지도용 경로

  function handlePosition(pos) {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    const ts = pos.timestamp || Date.now();

    if (accuracy > ACCURACY_THRESHOLD_M) {
      return; // 정확도 낮음 → 무시
    }

    if (!previous) {
      previous = { lat, lon, ts };
      startTs = ts;
      path.push([lat, lon]);
      onSample({
        lat, lon,
        addedDistanceM: 0,
        addedTimeSec: 0,
        totalDistanceM: 0,
        speedKmh: 0,
        elapsedSec: 0,
        nowMs: ts,
        firstSample: true,
      });
      return;
    }

    const dt = (ts - previous.ts) / 1000; // s
    if (dt <= 0) return;

    const rawDist = haversineM(previous.lat, previous.lon, lat, lon);
    const speedKmh = (rawDist / dt) * 3.6;

    if (speedKmh > SPEED_SANITY_KMH) {
      return; // GPS 튐
    }

    const added = rawDist < JITTER_THRESHOLD_M ? 0 : rawDist;
    totalDistanceM += added;
    if (added > 0) {
      path.push([lat, lon]);
    }

    // previous는 항상 갱신 (잡음 누적 방지)
    previous = { lat, lon, ts };

    onSample({
      lat, lon,
      addedDistanceM: added,
      addedTimeSec: dt,
      totalDistanceM,
      speedKmh: added === 0 ? 0 : speedKmh,
      elapsedSec: (ts - startTs) / 1000,
      nowMs: ts,
      firstSample: false,
    });
  }

  return {
    start() {
      if (!('geolocation' in navigator)) {
        onError(new Error('이 브라우저는 GPS를 지원하지 않습니다.'));
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        (err) => onError(err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    },
    stop() {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    },
    getPath() {
      return path.slice();
    },
    getTotalDistanceM() {
      return totalDistanceM;
    },
    getStartTs() {
      return startTs;
    },
    reset() {
      previous = null;
      totalDistanceM = 0;
      startTs = null;
      path = [];
    },
  };
}

export function haversineM(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
