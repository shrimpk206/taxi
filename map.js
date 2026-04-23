// Leaflet 래퍼. window.L 이 CDN으로 로드되어 있다고 가정.

export function createMap(container) {
  if (!window.L) return null;
  const map = window.L.map(container, {
    zoomControl: true,
    attributionControl: true,
  }).setView([37.5665, 126.9780], 14); // 초기 서울시청

  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  const poly = window.L.polyline([], { color: '#ff2a2a', weight: 5, opacity: 0.85 }).addTo(map);
  let marker = null;

  return {
    setPath(points) {
      poly.setLatLngs(points);
      if (points.length > 0) {
        const last = points[points.length - 1];
        if (!marker) {
          marker = window.L.circleMarker(last, {
            radius: 7, color: '#ffffff', fillColor: '#ff2a2a', fillOpacity: 1, weight: 2,
          }).addTo(map);
        } else {
          marker.setLatLng(last);
        }
        map.panTo(last, { animate: true });
      }
    },
    fit(points) {
      if (points.length >= 2) {
        map.fitBounds(window.L.latLngBounds(points).pad(0.15));
      } else if (points.length === 1) {
        map.setView(points[0], 16);
      }
    },
    invalidate() {
      map.invalidateSize();
    },
  };
}
