# 개인택시 장난 여객 🚕💋

GPS 기반 택시 미터기 PWA. 서울 중형택시 요금(심야/시계외 할증 포함)으로 계산하고, **정산은 1,000원당 뽀뽀 1회**로 환산해 영수증을 찍어줍니다.

## 기능

- 실시간 GPS 추적 (Haversine + 정확도/속도 필터)
- 서울 택시 요금 정확 재현
  - 기본요금 4,800원 (최초 1.6km)
  - 거리요금 131m당 100원
  - 시간요금 시속 15km 이하 시 30초당 100원
  - 심야할증 22-23시/02-04시 +20%, 23-02시 +40%
  - 시계외 할증 토글 +20%
- 빨간 LED 글로우 미터기 UI + 100원 오를 때 "띡" 효과음
- 종료 시 진짜 택시 영수증 모양 모달 → 뽀뽀 환산 표시
- 주행 경로 지도 (OpenStreetMap / Leaflet)
- `localStorage` 주행 기록 + 누적 뽀뽀 배지
- PWA: 홈 화면 추가, 오프라인 캐시

## 로컬 실행

```bash
# 아무 정적 서버로도 OK
python -m http.server 8080
# → http://localhost:8080 접속
```

> GPS는 **HTTPS 또는 localhost**에서만 동작합니다. `file://`로 직접 열면 위치 권한이 막힙니다.

### 브라우저에서 GPS 목 (개발용)

Chrome DevTools → `More tools` → `Sensors` → Location에서 좌표를 수동 조정하면 기본요금 → 거리요금 → 할증 구간이 어떻게 뛰는지 바로 볼 수 있습니다.

## GitHub Pages 배포

```bash
git init
git add .
git commit -m "taxi meter prank app"

# gh CLI가 설치되어 있다면:
gh repo create taxi --public --source=. --push

# 아니면 GitHub에 빈 repo를 만들고 수동 push:
git remote add origin https://github.com/<유저명>/taxi.git
git branch -M main
git push -u origin main
```

푸시 후 GitHub → 해당 repo → Settings → Pages → Source: `main` 브랜치 `/` (root) 선택 → 저장. 1-2분 뒤 `https://<유저명>.github.io/taxi/` 에서 접속 가능.

## 모바일에서 쓰기

1. 배포된 https URL을 여친 폰 브라우저(Chrome/Safari)에서 연다.
2. 위치 권한 허용.
3. Chrome: 메뉴 → "홈 화면에 추가" / Safari: 공유 → "홈 화면에 추가".
4. 홈에서 아이콘 탭하면 전체화면 PWA로 실행.

## 파일 구조

```
index.html   styles.css   app.js      (UI + 상태머신)
meter.js                               (요금 계산 엔진)
geo.js                                 (GPS + Haversine + 필터)
receipt.js                             (영수증 + 뽀뽀 환산)
storage.js                             (localStorage CRUD)
map.js                                 (Leaflet 래퍼)
sound.js                               (Web Audio 비프)
manifest.json   sw.js                  (PWA)
icons/icon.svg  icon-192.png  icon-512.png
```

## 아이콘 재생성

디자인을 바꾸고 싶다면 `icons/icon.svg`를 수정한 뒤 `icons/_make_png.py`를 고쳐서 재실행:

```bash
cd icons && python _make_png.py
```

필요 패키지: `pip install Pillow`

## 면책

진짜 택시 요금이 아닙니다. 법적 효력이 없으며, 실제 뽀뽀는 상대방 동의하에 지급해 주세요 🥰
