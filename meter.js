// 서울 중형택시 요금 엔진 (2024~ 기준)
//
// 기본요금 4,800원 (최초 1.6km)
// 거리요금 131m당 100원
// 시간요금 시속 15km 이하일 때 30초당 100원
// 심야할증 22-23시, 02-04시 : +20%
// 심야할증 23-02시         : +40%
// 시계외 할증 (토글)        : +20%
//
// 핵심 아이디어: 거리/시간 카운터가 "131m" 또는 "30초" 쌓일 때마다
// 100원씩 튀어오르도록 임계 누적기 패턴을 쓴다. 매 샘플 0.3원씩
// 흘리면 LED가 부자연스럽게 보이고, 실제 택시 미터기도 이산적으로 뛴다.

const BASE_FARE = 4800;
const BASE_DISTANCE_M = 1600;
const DISTANCE_UNIT_M = 131;
const DISTANCE_UNIT_FARE = 100;
const TIME_UNIT_SEC = 30;
const TIME_UNIT_FARE = 100;
const TIME_FARE_SPEED_THRESHOLD_KMH = 15;
const OUTSIDE_SEOUL_SURCHARGE = 0.20;

export function createMeter(options = {}) {
  const outsideSeoul = !!options.outsideSeoul;

  // 누적기 (기본 요금 구간 이후에만 의미 있음)
  let extraDistanceAcc = 0;  // 미터, 거리요금 계산용
  let extraTimeAcc = 0;      // 초, 시간요금 계산용

  // "순수 요금" — 할증 적용 전. 기본요금 + 거리요금 + 시간요금의 합.
  let preSurchargeFare = BASE_FARE;

  // 거리/시간 요금 breakdown (영수증용)
  let distanceFareRaw = 0;
  let timeFareRaw = 0;

  // 현재 적용 중인 심야할증 배율 (0 또는 0.2 또는 0.4)
  let currentNightRate = 0;

  // 요금이 오른 순간을 외부에 알리기 위한 플래그 (효과음 트리거)
  let fareBumpedThisTick = false;
  let surchargeChangedThisTick = false;

  return {
    // 매 GPS 업데이트마다 호출.
    //   addedDistanceM : 이번 샘플에서 새로 이동한 거리 (m)
    //   addedTimeSec   : 이번 샘플의 경과 시간 (s)
    //   totalDistanceM : 주행 시작 이후 누적 거리 (m)
    //   speedKmh       : 현재 속도 (km/h)
    //   nowMs          : 현재 시각 (ms)  — 심야할증 판정용
    tick({ addedDistanceM, addedTimeSec, totalDistanceM, speedKmh, nowMs }) {
      fareBumpedThisTick = false;

      // 기본요금 구간 밖일 때만 거리/시간 카운터 가동
      if (totalDistanceM >= BASE_DISTANCE_M) {
        // 이번에 추가된 거리가 기본요금 경계를 가로질렀을 수 있다 →
        // 경계 이후 분량만 카운트
        const distanceBeyondBase = Math.max(
          0,
          addedDistanceM - Math.max(0, BASE_DISTANCE_M - (totalDistanceM - addedDistanceM))
        );
        extraDistanceAcc += distanceBeyondBase;

        while (extraDistanceAcc >= DISTANCE_UNIT_M) {
          extraDistanceAcc -= DISTANCE_UNIT_M;
          distanceFareRaw += DISTANCE_UNIT_FARE;
          preSurchargeFare += DISTANCE_UNIT_FARE;
          fareBumpedThisTick = true;
        }

        if (speedKmh < TIME_FARE_SPEED_THRESHOLD_KMH) {
          extraTimeAcc += addedTimeSec;
          while (extraTimeAcc >= TIME_UNIT_SEC) {
            extraTimeAcc -= TIME_UNIT_SEC;
            timeFareRaw += TIME_UNIT_FARE;
            preSurchargeFare += TIME_UNIT_FARE;
            fareBumpedThisTick = true;
          }
        }
      }

      // 심야할증 갱신
      const newNightRate = nightSurchargeRate(new Date(nowMs));
      surchargeChangedThisTick = newNightRate !== currentNightRate;
      currentNightRate = newNightRate;
    },

    snapshot() {
      const surchargeRate = currentNightRate + (outsideSeoul ? OUTSIDE_SEOUL_SURCHARGE : 0);
      const surchargeAmount = Math.round((preSurchargeFare * surchargeRate) / 10) * 10;
      const totalFare = preSurchargeFare + surchargeAmount;

      // 실제 택시 미터기는 100원 단위로 반올림 표시됨
      const displayFare = Math.round(totalFare / 100) * 100;

      return {
        baseFare: BASE_FARE,
        distanceFareRaw,
        timeFareRaw,
        preSurchargeFare,
        nightRate: currentNightRate,
        outsideSeoul,
        surchargeRate,
        surchargeAmount,
        totalFare: displayFare,
        fareBumped: fareBumpedThisTick,
        surchargeChanged: surchargeChangedThisTick,
      };
    },

    setOutsideSeoul(flag) {
      // eslint-disable-next-line no-param-reassign
      options.outsideSeoul = !!flag;
    },
  };
}

// 22:00-23:00  → 0.20
// 23:00-02:00  → 0.40
// 02:00-04:00  → 0.20
// 그 외         → 0
export function nightSurchargeRate(date) {
  const h = date.getHours();
  if (h === 22) return 0.20;
  if (h === 23 || h === 0 || h === 1) return 0.40;
  if (h === 2 || h === 3) return 0.20;
  return 0;
}

export function formatKrw(n) {
  return n.toLocaleString('ko-KR');
}
