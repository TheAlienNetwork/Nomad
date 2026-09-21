import { huntArea } from '@/constants/sample-data';

type SkyRadarHtmlOptions = {
  latitude?: number;
  longitude?: number;
  zoom?: number;
};

export function buildSkyRadarHtml({
  latitude = huntArea.latitude,
  longitude = huntArea.longitude,
  zoom = 7,
}: SkyRadarHtmlOptions = {}): string {
  const payload = JSON.stringify({ lat: latitude, lng: longitude, zoom });
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'" />
  <style>
    html, body { position: fixed; inset: 0; width: 100%; height: 100%; margin: 0; background: #1a1c18; }
    #land, #map { position: fixed; inset: 0; width: 100%; height: 100%; }
    #land { overflow: hidden; z-index: 1; background: #1a1c18; }
    #map { z-index: 2; opacity: 0; pointer-events: none; background: transparent; }
    #map.is-live { opacity: 1; pointer-events: auto; }
    .leaflet-control-attribution { display: none !important; }
    .wind-arrow {
      width: 0; height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-bottom: 18px solid #F15A24;
      filter: drop-shadow(0 0 4px rgba(0,0,0,0.6));
    }
  </style>
</head>
<body>
  <div id="land"></div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'"></script>
  <script>
    const start = ${payload};
    const land = document.getElementById('land');
    let lat = start.lat;
    let lng = start.lng;
    let zoom = start.zoom || 7;
    function wrapX(x, z) {
      const n = Math.pow(2, z);
      return ((x % n) + n) % n;
    }
    function tileUrl(z, x, y, kind) {
      if (kind === 'osm') return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x;
    }
    function paintLand() {
      if (!land || land.dataset.hidden === '1') return;
      const w = land.clientWidth || window.innerWidth || 360;
      const h = land.clientHeight || window.innerHeight || 220;
      if (w < 2 || h < 2) return;
      const n = Math.pow(2, zoom);
      const latRad = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
      const worldX = (lng + 180) / 360 * n * 256;
      const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * 256;
      land.innerHTML = '';
      const minTx = Math.floor((worldX - w / 2) / 256) - 1;
      const maxTx = Math.floor((worldX + w / 2) / 256) + 1;
      const minTy = Math.floor((worldY - h / 2) / 256) - 1;
      const maxTy = Math.floor((worldY + h / 2) / 256) + 1;
      for (let x = minTx; x <= maxTx; x++) {
        for (let y = minTy; y <= maxTy; y++) {
          if (y < 0 || y >= n) continue;
          const img = document.createElement('img');
          const tx = wrapX(x, zoom);
          img.alt = '';
          img.src = tileUrl(zoom, tx, y, 'esri');
          img.onerror = function () {
            if (this.dataset.fb) return;
            this.dataset.fb = '1';
            this.src = tileUrl(zoom, tx, y, 'osm');
          };
          img.style.cssText = 'position:absolute;width:256px;height:256px;left:' + (x * 256 - worldX + w / 2) + 'px;top:' + (y * 256 - worldY + h / 2) + 'px;';
          land.appendChild(img);
        }
      }
    }
    window.__nomadSize = function (w, h) {
      if (!isFinite(w) || !isFinite(h) || w < 2 || h < 2) return;
      document.documentElement.style.width = w + 'px';
      document.documentElement.style.height = h + 'px';
      document.body.style.width = w + 'px';
      document.body.style.height = h + 'px';
      land.style.width = w + 'px';
      land.style.height = h + 'px';
      const mapEl = document.getElementById('map');
      if (mapEl) { mapEl.style.width = w + 'px'; mapEl.style.height = h + 'px'; }
      paintLand();
      if (window.__skyMap) window.__skyMap.invalidateSize();
    };
    paintLand();
    let map = null;
    let radarLayer = null;
    let lastUrl = '';
    let windMarker = null;
    function hideLand() {
      land.dataset.hidden = '1';
      land.style.display = 'none';
      const mapEl = document.getElementById('map');
      if (mapEl) mapEl.classList.add('is-live');
    }
    if (typeof L !== 'undefined') {
      map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], zoom);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Esri'
      }).addTo(map);
      map.whenReady(function () {
        hideLand();
        map.invalidateSize();
      });
      window.__skyMap = map;
    }
    window.__skyApply = function (raw) {
      const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!state) return;
      if (typeof state.latitude === 'number' && typeof state.longitude === 'number') {
        lat = state.latitude;
        lng = state.longitude;
        if (typeof state.zoom === 'number') zoom = state.zoom;
        if (map) map.setView([state.latitude, state.longitude], state.zoom || map.getZoom());
        else paintLand();
      }
      if (!map) return;
      if (state.radarUrl) {
        if (!radarLayer || lastUrl !== state.radarUrl) {
          if (radarLayer) map.removeLayer(radarLayer);
          radarLayer = L.tileLayer(state.radarUrl, { opacity: 0.62, maxNativeZoom: 7, maxZoom: 18 });
          lastUrl = state.radarUrl;
        }
        if (!map.hasLayer(radarLayer)) radarLayer.addTo(map);
      } else if (radarLayer && map.hasLayer(radarLayer)) {
        map.removeLayer(radarLayer);
      }
      if (typeof state.windFrom === 'number' && typeof state.latitude === 'number') {
        const icon = L.divIcon({
          className: '',
          html: '<div class="wind-arrow" style="transform:rotate(' + state.windFrom + 'deg)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        if (!windMarker) {
          windMarker = L.marker([state.latitude, state.longitude], { icon: icon, interactive: false }).addTo(map);
        } else {
          windMarker.setLatLng([state.latitude, state.longitude]);
          windMarker.setIcon(icon);
        }
      }
    };
    window.addEventListener('message', function (event) {
      if (typeof event.data === 'string' && event.data.charAt(0) === '{') {
        window.__skyApply(event.data);
      }
    });
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  </script>
</body>
</html>`;
}
