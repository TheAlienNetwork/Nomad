import { huntArea } from '@/constants/sample-data';

type HuntMapHtmlOptions = {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  demTiles?: string;
};

const TERRARIUM_S3 =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export function buildHuntMapHtml({
  center = huntArea,
  zoom = 11,
  demTiles = TERRARIUM_S3,
}: HuntMapHtmlOptions = {}): string {
  const payload = JSON.stringify({
    lat: center.latitude,
    lng: center.longitude,
    zoom,
    demTiles,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.css'" />
  <style>
    html, body {
      position: fixed; inset: 0; width: 100%; height: 100%; margin: 0; background: #1a1c18;
    }
    #land {
      position: fixed; inset: 0; overflow: hidden; z-index: 1; background: #1a1c18;
    }
    #map {
      position: fixed; inset: 0; width: 100%; height: 100%; margin: 0;
      background: transparent; z-index: 2; opacity: 0; pointer-events: none;
    }
    #map.is-live { opacity: 1; pointer-events: auto; }
    canvas.maplibregl-canvas { display: block; width: 100% !important; height: 100% !important; }
    #map.is-elevation { background: #02080c; }
    #map.is-elevation-light { background: #d7e4dc; }
    #map.is-nera { background: #000208; }
    #map.is-nera-wire { background: #000104; }
    #map.is-wireframe-mesh { background: #000104; }
    #map.is-wireframe-mesh::after {
      content: ""; pointer-events: none; position: absolute; inset: 0;
      background: repeating-linear-gradient(to bottom, rgba(34,211,238,0.05) 0px, rgba(34,211,238,0.05) 1px, transparent 1px, transparent 4px);
      mix-blend-mode: screen; z-index: 1;
    }
    .maplibregl-ctrl-attrib { display: none !important; }
    .maplibregl-ctrl-group {
      background: rgba(10,9,7,0.82) !important;
      border: 1px solid rgba(241,90,36,0.45) !important;
      border-radius: 8px !important;
      box-shadow: none !important;
    }
    .maplibregl-ctrl-group button { width: 28px !important; height: 28px !important; }
    .nomad-north {
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      color: #F15A24; font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      background: rgba(10,9,7,0.82); border: 1px solid rgba(241,90,36,0.45); border-radius: 8px; cursor: pointer;
    }
    .nomad-pin, .truck-pin, .harvest-pin, .plan-pin, .stand-pin, .blind-pin, .water-pin, .sign-pin, .cam-pin {
      width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff;
    }
    .nomad-pin { background: #f15a24; box-shadow: 0 0 0 2px rgba(241,90,36,0.35); }
    .stand-pin { background: #c2410c; }
    .blind-pin { background: #7c5c3e; }
    .water-pin { background: #2a9d8f; }
    .sign-pin { background: #e6a31a; }
    .cam-pin { background: #7c3aed; }
    .truck-pin { background: #8a9bb0; }
    .harvest-pin { background: #8b1e12; border-radius: 2px; transform: rotate(45deg); }
    .plan-pin { background: #e6a31a; border-radius: 3px; }
    .nomad-hit { min-width: 32px; min-height: 32px; display: flex; align-items: center; justify-content: center; }
    .nomad-mark { display: flex; flex-direction: column; align-items: center; width: 72px; }
    .nomad-drop {
      width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
      border: 2px solid #E8DFD0; box-shadow: 0 2px 8px rgba(0,0,0,0.55);
    }
    .nomad-mark.is-on .nomad-drop, .photo-pin.pin-selected {
      box-shadow: 0 0 0 3px rgba(103,232,249,0.9), 0 0 16px rgba(103,232,249,0.5);
    }
    .nomad-mark-label {
      margin-top: 6px; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: #E8DFD0; font: 700 9px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace; text-shadow: 0 1px 3px #000;
    }
    .photo-pin {
      width: 56px; height: 56px; border-radius: 50%; border: 2px solid #E8DFD0;
      box-shadow: 0 4px 14px rgba(0,0,0,0.55); background-size: cover; background-position: center; position: relative;
    }
    .photo-pin .pip {
      position: absolute; right: 2px; bottom: 2px; width: 11px; height: 11px; border-radius: 50%;
      border: 1.5px solid #E8DFD0; background: #e6a31a;
    }
    .gps-wrap { position: relative; width: 36px; height: 36px; }
    .gps-pulse {
      position: absolute; left: 8px; top: 8px; width: 20px; height: 20px; border-radius: 50%;
      border: 1.5px solid rgba(241,90,36,0.4); animation: gpsPulse 2.8s ease-out infinite;
    }
    .gps-wrap.is-operator .gps-pulse, .gps-wrap.is-poor .gps-pulse { animation: none; opacity: 0; }
    @keyframes gpsPulse { 0% { transform: scale(0.85); opacity: 0.45; } 100% { transform: scale(1.7); opacity: 0; } }
    .gps-puck {
      position: absolute; left: 12px; top: 12px; width: 12px; height: 12px; border-radius: 50%;
      background: #F15A24; border: 1.5px solid #E8DFD0; box-shadow: 0 0 0 1px #070806, 0 0 10px rgba(241,90,36,0.55);
    }
    .gps-wrap.is-operator .gps-puck { background: #A39A8C; }
    .gps-needle {
      position: absolute; top: 1px; left: 15px; width: 0; height: 0;
      border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 7px solid #E8DFD0;
    }
    .maplibregl-popup.pin-pop-wrap .maplibregl-popup-content {
      background: rgba(2, 8, 12, 0.9); color: #E8DFD0; border: 1px solid rgba(103,232,249,0.28);
      border-radius: 12px; box-shadow: 0 10px 28px rgba(0,0,0,0.55); padding: 10px 12px; min-width: 180px;
    }
    .maplibregl-popup.pin-pop-wrap .maplibregl-popup-tip { border-top-color: rgba(2,8,12,0.9); }
    .pin-pop { display: flex; flex-direction: column; gap: 6px; }
    .pin-pop-photos { display: flex; gap: 6px; overflow-x: auto; max-width: 220px; }
    .pin-pop-photos img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; }
    .pin-pop-title { font: 800 14px/1.2 ui-sans-serif, system-ui, sans-serif; color: #E8DFD0; }
    .pin-pop-meta { margin: 0; color: #A39A8C; font: 600 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .pin-pop-notes { margin: 0; color: #E8DFD0; font: 400 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
    .pin-pop-notes.is-empty { color: #7A7A7A; }
    .pin-pop-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .pin-pop-actions button {
      background: rgba(103,232,249,0.12); color: #E8DFD0; border: 1px solid rgba(103,232,249,0.35);
      border-radius: 8px; padding: 6px 8px; font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .memory-pin {
      width: 44px; height: 52px; border: 1.5px solid rgba(103,232,249,0.9);
      box-shadow: 0 0 14px rgba(103,232,249,0.55), 0 8px 18px rgba(0,0,0,0.55);
      background-size: cover; background-position: center; transform: rotate(-4deg);
      position: relative;
    }
    .memory-pin.is-on {
      box-shadow: 0 0 0 2px rgba(241,90,36,0.85), 0 0 22px rgba(103,232,249,0.75);
      transform: rotate(0deg) scale(1.08);
    }
    .memory-pin::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(180deg, rgba(103,232,249,0.22), transparent 42%, rgba(241,90,36,0.18));
    }
    .maplibregl-popup.hologram-pop .maplibregl-popup-content {
      background: linear-gradient(180deg, rgba(2,18,24,0.94), rgba(8,6,4,0.96));
      color: #E8DFD0; border: 1px solid rgba(103,232,249,0.55);
      border-radius: 14px; box-shadow: 0 0 28px rgba(103,232,249,0.35), 0 16px 40px rgba(0,0,0,0.65);
      padding: 0; min-width: 220px; overflow: hidden;
      animation: holoIn 280ms ease-out;
    }
    .maplibregl-popup.hologram-pop .maplibregl-popup-tip { border-top-color: rgba(2,18,24,0.94); }
    .holo {
      position: relative; display: flex; flex-direction: column; gap: 8px; padding: 0 0 10px;
    }
    .holo-hero {
      width: 100%; height: 158px; object-fit: cover; display: block;
      filter: saturate(1.08) contrast(1.05);
    }
    .holo::before {
      content: ''; position: absolute; left: 0; right: 0; top: 0; height: 158px; pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(103,232,249,0.28), transparent);
      animation: holoSweep 2.4s linear infinite;
    }
    .holo-copy { padding: 0 12px; display: flex; flex-direction: column; gap: 4px; }
    .holo-title { font: 800 13px/1.2 ui-sans-serif, system-ui, sans-serif; color: #E8DFD0; }
    .holo-meta { margin: 0; color: #67e8f9; font: 600 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.4px; }
    .holo-note { margin: 0; color: #A39A8C; font: 400 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
    .holo-actions { display: flex; gap: 6px; padding: 0 12px; }
    .holo-actions button {
      background: rgba(103,232,249,0.12); color: #E8DFD0; border: 1px solid rgba(103,232,249,0.4);
      border-radius: 8px; padding: 6px 10px; font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    @keyframes holoSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    @keyframes holoIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
  </style>
</head>
<body>
  <div id="land"></div>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.js'"></script>
  <script>
    const boot = ${payload};
    const empty = { type: 'FeatureCollection', features: [] };
    const tileWait = {};
    const overlayIndex = {};
    let lastState = null;
    let lastVectors = {};
    let lastSelectedEase = null;
    let lastFlyId = '';
    let lastRadarUrl = '';
    let currentBasemapId = '';
    let userZooming = false;
    let lastNeraGridMs = 0;
    let lastGpsRingMs = 0;
    let lastRingIntelKey = '';
    let lastFpvCamera = false;
    let fpvProgrammatic = false;
    let terrainReady = false;
    let terrainIdleHooked = false;
    let terrainMeshReady = false;
    const FPV_ZOOM = 17.4;
    const FPV_PITCH = 80;
    const FPV_LOOKAHEAD_M = 110;
    const GPS_RANGE_YARDS = [100, 200, 400];
    const GPS_RING_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
    const GPS_RING_HIGH_FT = 10;
    const METERS_TO_FEET = 3.28084;
    let didLongPress = false;
    let pressTimer = null;
    const waypointMarkers = [];
    const planMarkers = [];
    const memoryMarkers = [];
    let gpsMarker = null;
    let popup = null;

    function emit(message) {
      const payload = JSON.stringify(message);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
    }

    (function setupLand() {
      const el = document.getElementById('land');
      if (!el) return;
      let lat = boot.lat;
      let lng = boot.lng;
      let zoom = Math.max(4, Math.min(16, Math.round(boot.zoom || 11)));
      let drag = null;
      function wrapX(x, z) {
        const n = Math.pow(2, z);
        return ((x % n) + n) % n;
      }
      function tileUrl(z, x, y, kind) {
        if (kind === 'osm') return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x;
      }
      window.__nomadMapLive = false;
      window.__nomadPaintLand = function (nextLat, nextLng, nextZoom) {
        if (window.__nomadMapLive) return;
        if (typeof nextLat === 'number' && isFinite(nextLat)) lat = nextLat;
        if (typeof nextLng === 'number' && isFinite(nextLng)) lng = nextLng;
        if (typeof nextZoom === 'number' && isFinite(nextZoom)) zoom = Math.max(3, Math.min(18, Math.round(nextZoom)));
        const w = el.clientWidth || window.innerWidth || 360;
        const h = el.clientHeight || window.innerHeight || 640;
        if (w < 2 || h < 2) return;
        const n = Math.pow(2, zoom);
        const latRad = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
        const worldX = (lng + 180) / 360 * n * 256;
        const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * 256;
        el.innerHTML = '';
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
            img.onload = function () {
              if (!this.naturalWidth || window.__nomadRevealed) return;
              window.__nomadRevealed = true;
              emit({ type: 'painted' });
            };
            img.style.cssText = 'position:absolute;width:256px;height:256px;left:' + (x * 256 - worldX + w / 2) + 'px;top:' + (y * 256 - worldY + h / 2) + 'px;';
            el.appendChild(img);
          }
        }
      };
      window.__nomadSize = function (w, h) {
        if (!isFinite(w) || !isFinite(h) || w < 2 || h < 2) return;
        document.documentElement.style.width = w + 'px';
        document.documentElement.style.height = h + 'px';
        document.body.style.width = w + 'px';
        document.body.style.height = h + 'px';
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        const mapEl = document.getElementById('map');
        if (mapEl) {
          mapEl.style.width = w + 'px';
          mapEl.style.height = h + 'px';
        }
        window.__nomadPaintLand();
        if (window.__huntosResize) window.__huntosResize();
      };
      el.addEventListener('touchstart', function (e) {
        if (window.__nomadMapLive || !e.touches || !e.touches[0]) return;
        drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, lat: lat, lng: lng };
      }, { passive: true });
      el.addEventListener('touchmove', function (e) {
        if (!drag || window.__nomadMapLive || !e.touches || !e.touches[0]) return;
        const n = Math.pow(2, zoom);
        lng = drag.lng - ((e.touches[0].clientX - drag.x) / 256) * (360 / n);
        const latRad = drag.lat * Math.PI / 180;
        const merc = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
        const next = merc + ((e.touches[0].clientY - drag.y) / 256) * (2 * Math.PI / n);
        lat = Math.max(-85, Math.min(85, (2 * Math.atan(Math.exp(next)) - Math.PI / 2) * 180 / Math.PI));
        window.__nomadPaintLand(lat, lng, zoom);
      }, { passive: true });
      el.addEventListener('touchend', function () { drag = null; }, { passive: true });
      window.__huntosApply = function (state) {
        lastState = state;
        if (state && state.gps && typeof state.gps.latitude === 'number' && typeof state.gps.longitude === 'number') {
          window.__nomadPaintLand(state.gps.latitude, state.gps.longitude, 14);
        }
      };
      window.__huntosLayers = function () {};
      window.__huntosVectors = function () {};
      window.__nomadPaintLand();
      setTimeout(function () { window.__nomadPaintLand(); }, 160);
      emit({ type: 'ready' });
    })();

    function tileToBBox(z, x, y) {
      const n = Math.pow(2, z);
      return {
        west: (x / n) * 360 - 180,
        east: ((x + 1) / n) * 360 - 180,
        north: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI,
        south: (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI,
      };
    }

    function overlayUrl(tile, z, x, y) {
      const bbox = tileToBBox(z, x, y);
      if (tile.protocol === 'wms') {
        const url = new URL(tile.mapServer);
        url.searchParams.set('SERVICE', 'WMS');
        url.searchParams.set('VERSION', '1.1.1');
        url.searchParams.set('REQUEST', 'GetMap');
        url.searchParams.set('LAYERS', tile.wmsLayer || tile.layerIdentifier);
        url.searchParams.set('STYLES', '');
        url.searchParams.set('SRS', 'EPSG:4326');
        url.searchParams.set('BBOX', bbox.west + ',' + bbox.south + ',' + bbox.east + ',' + bbox.north);
        url.searchParams.set('WIDTH', '256');
        url.searchParams.set('HEIGHT', '256');
        url.searchParams.set('FORMAT', 'image/png');
        url.searchParams.set('TRANSPARENT', 'true');
        return url.toString();
      }
      if (tile.protocol === 'arcgis-image') {
        const url = new URL(String(tile.mapServer || '').replace(/\\/+$/, '') + '/exportImage');
        url.searchParams.set('bbox', bbox.west + ',' + bbox.south + ',' + bbox.east + ',' + bbox.north);
        url.searchParams.set('bboxSR', '4326');
        url.searchParams.set('imageSR', '3857');
        url.searchParams.set('size', '256,256');
        url.searchParams.set('format', 'png32');
        url.searchParams.set('pixelType', 'U8');
        url.searchParams.set('interpolation', 'RSP_BilinearInterpolation');
        url.searchParams.set('f', 'image');
        let built = url.toString();
        if (tile.renderingRule) {
          built += '&renderingRule=' + encodeURIComponent(JSON.stringify({ rasterFunction: tile.renderingRule }));
        }
        return built;
      }
      const url = new URL(String(tile.mapServer || '').replace(/\\/+$/, '') + '/export');
      url.searchParams.set('bbox', bbox.west + ',' + bbox.south + ',' + bbox.east + ',' + bbox.north);
      url.searchParams.set('bboxSR', '4326');
      url.searchParams.set('imageSR', '3857');
      url.searchParams.set('size', '256,256');
      url.searchParams.set('format', 'png32');
      url.searchParams.set('transparent', 'true');
      url.searchParams.set('layers', 'show:' + (tile.layerIdentifier || '0'));
      url.searchParams.set('f', 'image');
      let built = url.toString();
      if (tile.layerDefs) built += '&layerDefs=' + encodeURIComponent(JSON.stringify(tile.layerDefs));
      if (tile.dynamicLayers) {
        const dynamic = typeof tile.dynamicLayers === 'string' ? tile.dynamicLayers : JSON.stringify(tile.dynamicLayers);
        built += '&dynamicLayers=' + encodeURIComponent(dynamic);
      }
      return built;
    }

    function findTile(id) {
      const catalog = (lastState && lastState.overlayCatalog) || [];
      for (let i = 0; i < catalog.length; i++) {
        const tiles = catalog[i].tiles || [];
        for (let j = 0; j < tiles.length; j++) {
          if (tiles[j].id === id) return tiles[j];
        }
      }
      return null;
    }

    if (typeof maplibregl !== 'undefined') maplibregl.addProtocol('nomad-overlay', function (params, abortController) {
      const raw = params.url.replace('nomad-overlay://', '');
      const parts = raw.split('/');
      const id = decodeURIComponent(parts[0]);
      const z = Number(parts[1]);
      const x = Number(parts[2]);
      const y = Number(parts[3]);
      const tile = findTile(id);
      if (!tile) return Promise.reject(new Error('unknown overlay'));
      const cached = lastState && Array.isArray(lastState.cachedTileSlugs) && lastState.cachedTileSlugs.indexOf(id) >= 0;
      const live = overlayUrl(tile, z, x, y);
      if (!cached) {
        return fetch(live, { signal: abortController.signal }).then(function (res) { return res.arrayBuffer(); }).then(function (data) { return { data: data }; });
      }
      return new Promise(function (resolve, reject) {
        const waitId = id + '-' + z + '-' + x + '-' + y + '-' + Math.random().toString(36).slice(2, 8);
        tileWait[waitId] = function (dataUrl) {
          if (!dataUrl) {
            fetch(live).then(function (res) { return res.arrayBuffer(); }).then(function (data) { resolve({ data: data }); }).catch(reject);
            return;
          }
          fetch(dataUrl).then(function (res) { return res.arrayBuffer(); }).then(function (data) { resolve({ data: data }); }).catch(reject);
        };
        emit({ type: 'tile', id: waitId, slug: id, z: z, x: x, y: y });
        setTimeout(function () {
          if (!tileWait[waitId]) return;
          delete tileWait[waitId];
          fetch(live).then(function (res) { return res.arrayBuffer(); }).then(function (data) { resolve({ data: data }); }).catch(reject);
        }, 900);
      });
    });

    window.__nomadTile = function (id, dataUrl) {
      const wait = tileWait[id];
      if (!wait) return;
      delete tileWait[id];
      wait(dataUrl || null);
    };

    function rasterLiveUrl(slug, z, x, y) {
      if (slug === 'usgs-topo') return 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/' + z + '/' + y + '/' + x;
      if (slug === 'usgs-imagery') return 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' + z + '/' + y + '/' + x;
      if (slug === 'usgs-hillshade') return 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/' + z + '/' + y + '/' + x;
      if (slug === 'esri-street') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/' + z + '/' + y + '/' + x;
      if (slug === 'esri-imagery') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x;
      if (slug === 'esri-transport') return 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/' + z + '/' + y + '/' + x;
      return 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + x + '/' + y + '.png';
    }

    if (typeof maplibregl !== 'undefined') maplibregl.addProtocol('nomad-raster', function (params, abortController) {
      const raw = String(params.url || '').replace(/^nomad-raster:\/\//, '').replace(/^https?:\/\/nomad-raster\//, '').replace(/\?.*$/, '');
      const parts = raw.replace(/^\/+/, '').split('/');
      const slug = decodeURIComponent(parts[0] || '');
      const z = Number(parts[1]);
      const x = Number(parts[2]);
      const y = Number(parts[3]);
      const live = rasterLiveUrl(slug, z, x, y);
      function fromLive() {
        return fetch(live, { mode: 'cors', credentials: 'omit', signal: abortController.signal }).then(function (res) {
          if (!res.ok) throw new Error('tile ' + res.status);
          return res.arrayBuffer();
        }).then(function (data) { return { data: data }; });
      }
      if (!window.ReactNativeWebView) return fromLive();
      return new Promise(function (resolve, reject) {
        const waitId = 'r-' + slug + '-' + z + '-' + x + '-' + y + '-' + Math.random().toString(36).slice(2, 8);
        const finishLive = function () { fromLive().then(resolve).catch(reject); };
        const timer = setTimeout(function () {
          if (!tileWait[waitId]) return;
          delete tileWait[waitId];
          finishLive();
        }, 8000);
        tileWait[waitId] = function (dataUrl) {
          clearTimeout(timer);
          if (!dataUrl) {
            finishLive();
            return;
          }
          fetch(dataUrl).then(function (res) { return res.arrayBuffer(); }).then(function (data) { resolve({ data: data }); }).catch(finishLive);
        };
        emit({ type: 'raster', id: waitId, slug: slug, z: z, x: x, y: y });
      });
    });

    function nomadRasterTiles(slug) {
      return ['nomad-raster://' + slug + '/{z}/{x}/{y}'];
    }
    function esriTiles(service) {
      return ['https://server.arcgisonline.com/ArcGIS/rest/services/' + service + '/MapServer/tile/{z}/{y}/{x}'];
    }
    function rewriteWebViewTiles(url) {
      if (!window.ReactNativeWebView) return url;
      const text = String(url || '');
      let match = text.match(/USGSTopo\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)/);
      if (match) return 'nomad-raster://usgs-topo/' + match[1] + '/' + match[3] + '/' + match[2];
      match = text.match(/USGSImageryOnly\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)/);
      if (match) return 'nomad-raster://usgs-imagery/' + match[1] + '/' + match[3] + '/' + match[2];
      match = text.match(/USGSShadedReliefOnly\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)/);
      if (match) return 'nomad-raster://usgs-hillshade/' + match[1] + '/' + match[3] + '/' + match[2];
      match = text.match(/elevation-tiles-prod\/terrarium\/(\d+)\/(\d+)\/(\d+)/);
      if (match) return 'nomad-raster://terrarium/' + match[1] + '/' + match[2] + '/' + match[3];
      match = text.match(/\/api\/tiles\/terrarium\/(\d+)\/(\d+)\/(\d+)/);
      if (match) return 'nomad-raster://terrarium/' + match[1] + '/' + match[2] + '/' + match[3];
      return url;
    }

    function whenMapFrameReady(start) {
      const el = document.getElementById('map');
      const began = Date.now();
      let started = false;
      function tick() {
        if (started) return;
        if (typeof maplibregl === 'undefined') {
          if (Date.now() - began > 8000) return;
          setTimeout(tick, 80);
          return;
        }
        if ((el && el.clientWidth >= 8 && el.clientHeight >= 8) || Date.now() - began > 1500) {
          started = true;
          start();
          return;
        }
        setTimeout(tick, 40);
      }
      tick();
    }

    whenMapFrameReady(function () {
    const demTiles = window.ReactNativeWebView ? 'nomad-raster://terrarium/{z}/{x}/{y}' : boot.demTiles;
    const map = new maplibregl.Map({
      container: 'map',
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
      fadeDuration: 0,
      transformRequest: function (url) {
        return { url: rewriteWebViewTiles(url) };
      },
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sky: {
          'sky-color': '#071018',
          'horizon-color': '#1a3d44',
          'fog-color': '#070b08',
          'fog-ground-blend': 0,
          'horizon-fog-blend': 0.4,
          'atmosphere-blend': 0,
        },
        sources: {
          basemap: {
            type: 'raster',
            tiles: esriTiles('World_Imagery'),
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Esri',
          },
          streetsref: {
            type: 'raster',
            tiles: esriTiles('Reference/World_Transportation'),
            tileSize: 256,
            maxzoom: 19,
          },
          terrain: {
            type: 'raster-dem',
            tiles: [demTiles],
            tileSize: 256,
            maxzoom: 15,
            encoding: 'terrarium',
            attribution: 'Mapzen / Amazon Terrain Tiles',
          },
          hillshade: {
            type: 'raster',
            tiles: window.ReactNativeWebView ? nomadRasterTiles('usgs-hillshade') : ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 12,
          },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#070b08' } },
          { id: 'basemap', type: 'raster', source: 'basemap' },
          { id: 'streetsref', type: 'raster', source: 'streetsref', layout: { visibility: 'none' } },
          { id: 'hillshade', type: 'raster', source: 'hillshade', paint: { 'raster-opacity': 0.42 }, layout: { visibility: 'none' } },
          {
            id: 'dem-hillshade',
            type: 'hillshade',
            source: 'terrain',
            layout: { visibility: 'none' },
            paint: {
              'hillshade-shadow-color': '#02151c',
              'hillshade-highlight-color': '#7af6ff',
              'hillshade-accent-color': '#e6a31a',
              'hillshade-exaggeration': 0.92,
              'hillshade-illumination-direction': 315,
              'hillshade-illumination-anchor': 'viewport',
            },
          },
          {
            id: 'dem-rim',
            type: 'hillshade',
            source: 'terrain',
            layout: { visibility: 'none' },
            paint: {
              'hillshade-shadow-color': '#01060a',
              'hillshade-highlight-color': '#94a3b8',
              'hillshade-accent-color': '#67e8f9',
              'hillshade-exaggeration': 0.35,
              'hillshade-illumination-direction': 135,
              'hillshade-illumination-anchor': 'viewport',
            },
          },
        ],
      },
      center: [boot.lng, boot.lat],
      zoom: boot.zoom,
      attributionControl: false,
      maxPitch: 85,
      pitchWithRotate: true,
    });
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');
    const north = document.createElement('div');
    north.className = 'nomad-north';
    north.textContent = 'N';
    north.onclick = function () { emit({ type: 'northup' }); };
    map.getContainer().appendChild(north);
    north.style.position = 'absolute';
    north.style.top = '12px';
    north.style.right = '48px';
    north.style.zIndex = '2';
    window.__huntosMap = map;
    window.__huntosResize = function () { try { map.resize(); } catch (err) {} };
    let fitTries = 0;
    (function pumpFit() {
      fitTries += 1;
      try { map.resize(); } catch (err) {}
      if (fitTries < 40) setTimeout(pumpFit, 90);
    })();
    window.addEventListener('resize', function () { window.__huntosResize(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { window.__huntosResize(); });

    const geoSources = [
      'tracks', 'past', 'return', 'heat', 'score', 'bedding', 'feeding', 'units', 'terrain-pts',
      'wind', 'measure', 'recovery', 'los', 'rings', 'gps-range-marks', 'gps-puck', 'gps-heading', 'ray', 'grid', 'draw', 'areas', 'gps-accuracy',
      'scout', 'vectors', 'slope-heat', 'nera-grid', 'nera-range'
    ];

    function setGeo(id, data) {
      const src = map.getSource(id);
      if (src) src.setData(data || empty);
    }

    function lineFc(lines, props) {
      return {
        type: 'FeatureCollection',
        features: (lines || []).filter(function (line) { return line && line.length > 1; }).map(function (line) {
          return {
            type: 'Feature',
            properties: props || {},
            geometry: { type: 'LineString', coordinates: line.map(function (p) { return [p.longitude, p.longitude ? p.longitude : p.lng, p.latitude]; }).map(function (pair) { return [pair[0], pair[1] || pair[2]]; }) },
          };
        }),
      };
    }

    function pointsToLine(points) {
      return {
        type: 'FeatureCollection',
        features: points && points.length > 1 ? [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: points.map(function (p) { return [p.longitude, p.latitude]; }) },
        }] : [],
      };
    }

    function pointFc(points, extra) {
      return {
        type: 'FeatureCollection',
        features: (points || []).map(function (p) {
          return {
            type: 'Feature',
            properties: Object.assign({}, extra || {}, p),
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
          };
        }),
      };
    }

    function destPoint(lng, lat, bearing, meters) {
      const R = 6371000;
      const br = bearing * Math.PI / 180;
      const lat1 = lat * Math.PI / 180;
      const lon1 = lng * Math.PI / 180;
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(meters / R) + Math.cos(lat1) * Math.sin(meters / R) * Math.cos(br));
      const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(meters / R) * Math.cos(lat1), Math.cos(meters / R) - Math.sin(lat1) * Math.sin(lat2));
      return [lon2 * 180 / Math.PI, lat2 * 180 / Math.PI];
    }

    function headingArrowCoords(lng, lat, heading, lengthM, widthM) {
      const rad = heading * Math.PI / 180;
      const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
      const pts = [
        [0, 1],
        [-0.46, 0.18],
        [-0.16, 0.3],
        [-0.16, -0.12],
        [0.16, -0.12],
        [0.16, 0.3],
        [0.46, 0.18],
        [0, 1],
      ];
      return pts.map(function (pt) {
        const east = (pt[0] * widthM) * Math.cos(rad) + (pt[1] * lengthM) * Math.sin(rad);
        const north = -(pt[0] * widthM) * Math.sin(rad) + (pt[1] * lengthM) * Math.cos(rad);
        return [lng + east / (111320 * cosLat), lat + north / 111320];
      });
    }

    function fpvLookaheadMeters(zoom) {
      const z = typeof zoom === 'number' && !isNaN(zoom) ? zoom : FPV_ZOOM;
      return Math.min(160, Math.max(36, FPV_LOOKAHEAD_M * Math.pow(2, FPV_ZOOM - z)));
    }

    function applyFpvCamera(state, resetView) {
      if (!state || !state.gps) return;
      if (!resetView && userZooming) return;
      const heading = typeof state.gps.heading === 'number' && !isNaN(state.gps.heading) ? state.gps.heading : map.getBearing();
      const zoom = resetView ? FPV_ZOOM : map.getZoom();
      const pitch = resetView ? FPV_PITCH : Math.max(FPV_PITCH - 12, map.getPitch());
      const look = destPoint(state.gps.longitude, state.gps.latitude, heading, fpvLookaheadMeters(zoom));
      fpvProgrammatic = true;
      map.jumpTo({ center: look, zoom: zoom, pitch: pitch, bearing: heading });
      fpvProgrammatic = false;
    }

    function ringCoords(lng, lat, meters, steps) {
      const ring = [];
      for (let i = 0; i <= (steps || 48); i++) ring.push(destPoint(lng, lat, (i * 360) / (steps || 48), meters));
      return ring;
    }

    function formatLengthFeetJs(meters) {
      if (!isFinite(meters)) return '—';
      return Math.round(meters * METERS_TO_FEET) + ' ft';
    }
    function formatHudFeetJs(meters) {
      return String(Math.abs(Math.round(meters * METERS_TO_FEET))).padStart(4, '0');
    }
    function formatHudYardsJs(yards) {
      return String(Math.abs(Math.round(yards))).padStart(4, '0');
    }
    function formatHudDeltaJs(meters) {
      const ft = Math.round(meters * METERS_TO_FEET);
      if (ft > 0) return '+' + String(ft).padStart(3, '0');
      if (ft < 0) return '-' + String(Math.abs(ft)).padStart(3, '0');
      return '+000';
    }
    function formatDeltaFeetJs(meters) {
      const ft = Math.round(meters * METERS_TO_FEET);
      if (ft > 0) return '+' + ft + ' ft';
      if (ft < 0) return ft + ' ft';
      return '0 ft';
    }
    function formatBearingJs(degrees) {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const br = ((degrees % 360) + 360) % 360;
      const index = Math.round(br / 45) % dirs.length;
      return Math.round(br) + '° ' + dirs[index];
    }
    function emitRingIntel(intel) {
      const payload = intel
        ? { type: 'ringintel', kind: intel.kind, deltaFt: intel.deltaFt, bearing: intel.bearing, label: intel.label }
        : { type: 'ringintel', kind: 'none' };
      const key = JSON.stringify(payload);
      if (key === lastRingIntelKey) return;
      lastRingIntelKey = key;
      emit(payload);
    }
    function classifyGpsRingIntelJs(gpsElev, samples) {
      if (gpsElev == null) return null;
      const known = samples.filter(function (sample) { return sample.elevationMeters != null; });
      if (!known.length) return null;
      let highest = known[0];
      let lowest = known[0];
      known.forEach(function (sample) {
        if (sample.elevationMeters > highest.elevationMeters) highest = sample;
        if (sample.elevationMeters < lowest.elevationMeters) lowest = sample;
      });
      const riseFt = Math.round((highest.elevationMeters - gpsElev) * METERS_TO_FEET);
      const dropFt = Math.round((gpsElev - lowest.elevationMeters) * METERS_TO_FEET);
      if (riseFt >= GPS_RING_HIGH_FT) {
        return {
          kind: 'high',
          deltaFt: riseFt,
          bearing: highest.bearing,
          label: 'HIGH ' + formatDeltaFeetJs(highest.elevationMeters - gpsElev) + ' · ' + formatBearingJs(highest.bearing),
        };
      }
      if (dropFt >= GPS_RING_HIGH_FT) {
        return {
          kind: 'low',
          deltaFt: -dropFt,
          bearing: lowest.bearing,
          label: 'LOW ' + formatDeltaFeetJs(lowest.elevationMeters - gpsElev) + ' · ' + formatBearingJs(lowest.bearing),
        };
      }
      return { kind: 'level', deltaFt: 0, bearing: highest.bearing, label: 'LEVEL · sampled DEM' };
    }
    function refreshGpsRangeRings(state, force) {
      const now = Date.now();
      if (!force && now - lastGpsRingMs < 240) return;
      lastGpsRingMs = now;
      const threeD = state && state.cameraMode !== 'flat' && state.online !== false;
      const hasGps = state && state.gps && typeof state.gps.latitude === 'number' && typeof state.gps.longitude === 'number';
      const show = Boolean(threeD && hasGps && state.rangeRings !== false);
      if (!show) {
        setGeo('rings', empty);
        setGeo('gps-range-marks', empty);
        if (map.getLayer('rings')) map.setLayoutProperty('rings', 'visibility', 'none');
        if (map.getLayer('gps-range-spoke')) map.setLayoutProperty('gps-range-spoke', 'visibility', 'none');
        if (map.getLayer('gps-ring-labels')) map.setLayoutProperty('gps-ring-labels', 'visibility', 'none');
        emitRingIntel(null);
        return;
      }
      const lng = state.gps.longitude;
      const lat = state.gps.latitude;
      setGeo('rings', {
        type: 'FeatureCollection',
        features: GPS_RANGE_YARDS.map(function (yards) {
          return { type: 'Feature', properties: { yards: yards }, geometry: { type: 'LineString', coordinates: ringCoords(lng, lat, yards * 0.9144, 64) } };
        }),
      });
      if (map.getLayer('rings')) {
        map.setLayoutProperty('rings', 'visibility', 'visible');
        try {
          map.moveLayer('rings');
          if (map.getLayer('gps-puck')) map.moveLayer('gps-puck');
          if (map.getLayer('gps-ring-labels')) map.moveLayer('gps-ring-labels');
        } catch (err) {}
      }
      let gpsElev = null;
      try { gpsElev = map.queryTerrainElevation([lng, lat]); } catch (err) { gpsElev = null; }
      if (gpsElev == null) {
        setGeo('gps-range-marks', empty);
        if (map.getLayer('gps-range-spoke')) map.setLayoutProperty('gps-range-spoke', 'visibility', 'none');
        if (map.getLayer('gps-ring-labels')) map.setLayoutProperty('gps-ring-labels', 'visibility', 'none');
        emitRingIntel(null);
        return;
      }
      const samples = [];
      GPS_RANGE_YARDS.forEach(function (yards) {
        GPS_RING_BEARINGS.forEach(function (bearing) {
          const pt = destPoint(lng, lat, bearing, yards * 0.9144);
          let elev = null;
          try { elev = map.queryTerrainElevation(pt); } catch (err) { elev = null; }
          samples.push({ yards: yards, bearing: bearing, longitude: pt[0], latitude: pt[1], elevationMeters: elev });
        });
      });
      const heading = typeof state.gps.heading === 'number' && !isNaN(state.gps.heading) ? state.gps.heading : map.getBearing();
      const intel = classifyGpsRingIntelJs(gpsElev, samples);
      const features = [];
      GPS_RANGE_YARDS.forEach(function (yards) {
        const spoke = destPoint(lng, lat, heading, yards * 0.9144);
        features.push({
          type: 'Feature',
          properties: { kind: 'yards', primary: formatHudYardsJs(yards), unit: 'YD', text: yards + ' yd' },
          geometry: { type: 'Point', coordinates: spoke },
        });
      });
      samples.forEach(function (sample) {
        if (sample.elevationMeters == null) return;
        const cardinal = sample.yards === 200 && sample.bearing % 90 === 0;
        const isExtreme = intel && sample.bearing === intel.bearing && (intel.kind === 'high' || intel.kind === 'low');
        if (!cardinal && !isExtreme) return;
        const delta = sample.elevationMeters - gpsElev;
        features.push({
          type: 'Feature',
          properties: {
            kind: isExtreme ? intel.kind : 'elev',
            primary: formatHudFeetJs(sample.elevationMeters),
            unit: isExtreme ? formatHudDeltaJs(delta) : 'FT',
            text: isExtreme ? formatLengthFeetJs(sample.elevationMeters) + ' ' + formatDeltaFeetJs(delta) : formatLengthFeetJs(sample.elevationMeters),
          },
          geometry: { type: 'Point', coordinates: [sample.longitude, sample.latitude] },
        });
      });
      if (intel && (intel.kind === 'high' || intel.kind === 'low')) {
        const far = destPoint(lng, lat, intel.bearing, 400 * 0.9144);
        features.push({
          type: 'Feature',
          properties: { kind: intel.kind },
          geometry: { type: 'LineString', coordinates: [[lng, lat], far] },
        });
      }
      setGeo('gps-range-marks', { type: 'FeatureCollection', features: features });
      if (map.getLayer('gps-range-spoke')) map.setLayoutProperty('gps-range-spoke', 'visibility', 'visible');
      if (map.getLayer('gps-ring-labels')) map.setLayoutProperty('gps-ring-labels', 'visibility', 'visible');
      emitRingIntel(intel);
    }

    function ensureGeoLayers() {
      geoSources.forEach(function (id) {
        if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty });
      });
      function addLine(id, color, width, dash, opacity) {
        if (map.getLayer(id)) return;
        map.addLayer({
          id: id,
          type: 'line',
          source: id === 'past' ? 'past' : id,
          paint: {
            'line-color': color,
            'line-width': width,
            'line-opacity': opacity == null ? 0.9 : opacity,
            'line-dasharray': dash || [1, 0],
          },
        });
      }
      if (!map.getLayer('tracks')) map.addLayer({ id: 'tracks', type: 'line', source: 'tracks', paint: { 'line-color': '#F15A24', 'line-width': 5, 'line-opacity': 0.95 } });
      if (!map.getLayer('past')) map.addLayer({ id: 'past', type: 'line', source: 'past', paint: { 'line-color': '#c2410c', 'line-width': 2.5, 'line-opacity': 0.38 } });
      if (!map.getLayer('return')) map.addLayer({ id: 'return', type: 'line', source: 'return', paint: { 'line-color': '#E8DFD0', 'line-width': 3, 'line-dasharray': [1.4, 1.4] } });
      if (!map.getLayer('heat')) map.addLayer({ id: 'heat', type: 'circle', source: 'heat', paint: { 'circle-radius': 22, 'circle-color': '#f15a24', 'circle-opacity': 0.18, 'circle-stroke-color': '#8b1e12', 'circle-stroke-width': 1 } });
      if (!map.getLayer('score')) map.addLayer({ id: 'score', type: 'circle', source: 'score', paint: { 'circle-radius': 8, 'circle-color': '#c084fc', 'circle-opacity': 0.55, 'circle-stroke-color': '#f5d0fe', 'circle-stroke-width': 2 } });
      if (!map.getLayer('bedding')) map.addLayer({ id: 'bedding', type: 'circle', source: 'bedding', paint: { 'circle-radius': 7, 'circle-color': '#5b8a4c', 'circle-opacity': 0.4 } });
      if (!map.getLayer('feeding')) map.addLayer({ id: 'feeding', type: 'circle', source: 'feeding', paint: { 'circle-radius': 7, 'circle-color': '#e6a31a', 'circle-opacity': 0.4 } });
      if (!map.getLayer('terrain-pts')) map.addLayer({ id: 'terrain-pts', type: 'circle', source: 'terrain-pts', paint: { 'circle-radius': 6, 'circle-color': '#67e8f9', 'circle-opacity': 0.42, 'circle-stroke-color': '#e2e8f0', 'circle-stroke-width': 1.5 } });
      if (!map.getLayer('units-fill')) map.addLayer({ id: 'units-fill', type: 'fill', source: 'units', paint: { 'fill-color': '#F15A24', 'fill-opacity': 0.06 } });
      if (!map.getLayer('units-line')) map.addLayer({ id: 'units-line', type: 'line', source: 'units', paint: { 'line-color': '#E8DFD0', 'line-width': 1.5, 'line-dasharray': [1.2, 1.6] } });
      if (!map.getLayer('wind')) map.addLayer({ id: 'wind', type: 'fill', source: 'wind', paint: { 'fill-color': '#2a9d8f', 'fill-opacity': 0.18 } });
      if (!map.getLayer('measure-line')) map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', paint: { 'line-color': '#E8DFD0', 'line-width': 2, 'line-dasharray': [1.5, 1] } });
      if (!map.getLayer('measure-pts')) map.addLayer({ id: 'measure-pts', type: 'circle', source: 'measure', paint: { 'circle-radius': 4, 'circle-color': '#E8DFD0', 'circle-stroke-color': '#F15A24', 'circle-stroke-width': 1 } });
      if (!map.getLayer('recovery')) map.addLayer({ id: 'recovery', type: 'line', source: 'recovery', paint: { 'line-color': '#8b1e12', 'line-width': 3 } });
      if (!map.getLayer('los')) map.addLayer({ id: 'los', type: 'circle', source: 'los', paint: { 'circle-radius': 6, 'circle-color': ['case', ['get', 'visible'], '#f5d0fe', '#18181b'], 'circle-opacity': 0.65 } });
      if (!map.getLayer('rings')) map.addLayer({ id: 'rings', type: 'line', source: 'rings', paint: { 'line-color': '#E8DFD0', 'line-width': 1.35, 'line-dasharray': [1.2, 1.4], 'line-opacity': 0.72 } });
      if (map.getLayer('gps-puck') && map.getLayer('gps-puck').type !== 'fill') {
        map.removeLayer('gps-puck');
      }
      if (!map.getLayer('gps-puck')) map.addLayer({
        id: 'gps-puck',
        type: 'fill',
        source: 'gps-puck',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#f15a24', 'fill-opacity': 0.92 },
      });
      if (!map.getLayer('gps-puck-core')) map.addLayer({
        id: 'gps-puck-core',
        type: 'line',
        source: 'gps-puck',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#E8DFD0', 'line-width': 1.4, 'line-opacity': 0.95 },
      });
      if (!map.getLayer('gps-heading')) map.addLayer({
        id: 'gps-heading',
        type: 'fill-extrusion',
        source: 'gps-heading',
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#9BE7F2',
          'fill-extrusion-opacity': 0.32,
          'fill-extrusion-height': 22,
          'fill-extrusion-base': 8,
          'fill-extrusion-vertical-gradient': true,
        },
      });
      if (!map.getLayer('gps-heading-line')) map.addLayer({
        id: 'gps-heading-line',
        type: 'line',
        source: 'gps-heading',
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { visibility: 'none' },
        paint: { 'line-color': '#67e8f9', 'line-width': 1.6, 'line-opacity': 0.55 },
      });
      if (map.getLayer('gps-heading')) {
        map.setFilter('gps-heading', ['==', ['geometry-type'], 'Polygon']);
      }
      if (!map.getLayer('gps-range-spoke')) map.addLayer({
        id: 'gps-range-spoke',
        type: 'line',
        source: 'gps-range-marks',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'kind'], ['literal', ['high', 'low']]]],
        layout: { visibility: 'none' },
        paint: { 'line-color': ['match', ['get', 'kind'], 'low', '#e6a31a', '#67e8f9'], 'line-width': 1.05, 'line-opacity': 0.55, 'line-dasharray': [0.4, 1.4] },
      });
      (map.getStyle().layers || []).forEach(function (layer) {
        if (layer.id.indexOf('gps-ring-chip') === 0 || (layer.type === 'circle' && layer.source === 'gps-range-marks')) {
          map.removeLayer(layer.id);
        }
      });
      if (!map.getLayer('gps-ring-labels')) {
        map.addLayer({
          id: 'gps-ring-labels',
          type: 'symbol',
          source: 'gps-range-marks',
          filter: ['has', 'primary'],
          layout: {
            visibility: 'none',
            'text-field': ['concat', ['get', 'primary'], '\n', ['get', 'unit']],
            'text-size': 11,
            'text-font': ['Open Sans Regular'],
            'text-letter-spacing': 0.06,
            'text-line-height': 1.05,
            'text-anchor': 'center',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-padding': 0,
          },
          paint: {
            'text-color': ['match', ['get', 'kind'], 'high', '#c8f4fb', 'low', '#e6c98a', 'yards', '#8ec9d4', '#d4ccc0'],
            'text-opacity': ['match', ['get', 'kind'], 'high', 0.92, 'low', 0.86, 'yards', 0.7, 0.72],
            'text-halo-color': 'rgba(0, 0, 0, 0)',
            'text-halo-width': 0,
            'text-halo-blur': 0,
          },
        });
      } else {
        map.setLayoutProperty('gps-ring-labels', 'text-field', ['concat', ['get', 'primary'], '\n', ['get', 'unit']]);
        map.setPaintProperty('gps-ring-labels', 'text-halo-width', 0);
        map.setPaintProperty('gps-ring-labels', 'text-halo-blur', 0);
        map.setPaintProperty('gps-ring-labels', 'text-halo-color', 'rgba(0, 0, 0, 0)');
      }
      if (!map.getLayer('ray')) map.addLayer({ id: 'ray', type: 'line', source: 'ray', paint: { 'line-color': '#F15A24', 'line-width': 2.5 } });
      if (!map.getLayer('grid')) map.addLayer({ id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#E8DFD0', 'line-width': 1, 'line-opacity': 0.18 } });
      if (!map.getLayer('nera-grid')) map.addLayer({
        id: 'nera-grid',
        type: 'line',
        source: 'nera-grid',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#22d3ee', 'line-width': 0.55, 'line-opacity': 0.28 },
      });
      if (!map.getLayer('nera-range')) map.addLayer({
        id: 'nera-range',
        type: 'line',
        source: 'nera-range',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#67e8f9', 'line-width': 1.15, 'line-opacity': 0.72, 'line-dasharray': [1.4, 1.1] },
      });
      if (!map.getLayer('draw')) map.addLayer({ id: 'draw', type: 'line', source: 'draw', paint: { 'line-color': '#E8DFD0', 'line-width': 2, 'line-dasharray': [1.5, 1.5] } });
      if (!map.getLayer('areas-fill')) map.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': '#F15A24', 'fill-opacity': 0.1 } });
      if (!map.getLayer('areas-line')) map.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#F15A24', 'line-width': 2 } });
      if (!map.getLayer('gps-accuracy-fill')) map.addLayer({ id: 'gps-accuracy-fill', type: 'fill', source: 'gps-accuracy', paint: { 'fill-color': '#F15A24', 'fill-opacity': 0.12 } });
      if (!map.getLayer('scout-fill')) map.addLayer({ id: 'scout-fill', type: 'fill', source: 'scout', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 } });
      if (!map.getLayer('nera-relief')) {
        try {
          map.addLayer({
            id: 'nera-relief',
            type: 'color-relief',
            source: 'terrain',
            layout: { visibility: 'none' },
            paint: {
              'color-relief-color': [
                'interpolate', ['linear'], ['elevation'],
                0, '#020617', 40, '#082f49', 120, '#0e4a5c', 280, '#134e4a', 600, '#1e3a2f', 1200, '#422006'
              ],
              'color-relief-opacity': 0.58,
            },
          });
        } catch (err) {}
      }
      if (!map.getLayer('nera-mesh')) {
        try {
          map.addLayer({
            id: 'nera-mesh',
            type: 'color-relief',
            source: 'terrain',
            layout: { visibility: 'none' },
            paint: {
              'color-relief-color': [
                'interpolate', ['linear'], ['elevation'],
                0, '#01040c', 15, '#082f49', 40, '#0e7490', 80, '#22d3ee', 140, '#2dd4bf',
                220, '#84cc16', 400, '#f59e0b', 800, '#f97316', 1400, '#fb7185', 2200, '#fff7ed'
              ],
              'color-relief-opacity': 0.62,
            },
          });
        } catch (err) {}
      }
      if (!map.getLayer('vectors-glow')) map.addLayer({ id: 'vectors-glow', type: 'line', source: 'vectors', paint: { 'line-color': '#67e8f9', 'line-width': 3.2, 'line-opacity': 0.22, 'line-blur': 1.2 } });
      if (!map.getLayer('vectors-fill')) map.addLayer({ id: 'vectors-fill', type: 'fill', source: 'vectors', paint: { 'fill-color': '#67e8f9', 'fill-opacity': 0.08 } });
      if (!map.getLayer('vectors-line')) map.addLayer({ id: 'vectors-line', type: 'line', source: 'vectors', paint: { 'line-color': '#7af6ff', 'line-width': 1.1 } });
      if (!map.getLayer('slope-heat')) map.addLayer({
        id: 'slope-heat',
        type: 'heatmap',
        source: 'slope-heat',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'slope'], 0, 0, 8, 0.2, 22, 0.75, 40, 1],
          'heatmap-intensity': 0.9,
          'heatmap-radius': 32,
          'heatmap-opacity': 0.7,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(8,47,73,0)', 0.2, 'rgba(8,47,73,0.28)', 0.45, 'rgba(14,116,144,0.45)', 0.72, 'rgba(34,211,238,0.55)', 1, 'rgba(245,158,11,0.72)'
          ],
        },
      });
    }

    function basemapTiles(id) {
      if (id === 'streets') return esriTiles('World_Street_Map');
      if (id === 'naip' || id === 'satellite') return window.ReactNativeWebView ? nomadRasterTiles('usgs-imagery') : esriTiles('World_Imagery');
      if (id === 'relief') return window.ReactNativeWebView ? nomadRasterTiles('usgs-hillshade') : esriTiles('World_Imagery');
      if (id === 'hybrid') return esriTiles('World_Imagery');
      return window.ReactNativeWebView ? nomadRasterTiles('usgs-topo') : ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'];
    }

    function applyBasemap(id) {
      const next = id || 'hybrid';
      if (currentBasemapId === next && map.getSource('basemap')) {
        map.setLayoutProperty('streetsref', 'visibility', next === 'hybrid' ? 'visible' : 'none');
        return;
      }
      const src = map.getSource('basemap');
      if (src && src.setTiles) src.setTiles(basemapTiles(next));
      map.setLayoutProperty('streetsref', 'visibility', next === 'hybrid' ? 'visible' : 'none');
      currentBasemapId = next;
    }

    function ensureOverlayRaster(tile, opacity) {
      const sid = 'ov-' + tile.id;
      if (!map.getSource(sid)) {
        map.addSource(sid, { type: 'raster', tiles: ['nomad-overlay://' + encodeURIComponent(tile.id) + '/{z}/{x}/{y}'], tileSize: 256, maxzoom: 16 });
        map.addLayer({
          id: sid,
          type: 'raster',
          source: sid,
          paint: { 'raster-opacity': typeof opacity === 'number' ? opacity : tile.opacity || 0.55 },
          layout: { visibility: 'none' },
        });
      }
      overlayIndex[tile.id] = sid;
    }

    function neraGridSpacingMeters(zoom) {
      if (zoom >= 16) return 50;
      if (zoom >= 14) return 100;
      if (zoom >= 12) return 250;
      return 500;
    }

    function neraOrbitPitch(zoom) {
      const t = Math.min(1, Math.max(0, (zoom - 11) / 6));
      return 58 + t * 24;
    }

    function applyNeraLimits(nera) {
      if (nera) {
        map.setMaxZoom(18.5);
        if (terrainReady && map.getPitch() >= 38) map.setMinPitch(38);
        return;
      }
      map.setMaxZoom(22);
      map.setMinPitch(0);
    }

    function applyNeraWalkIn(nera, mode) {
      applyNeraLimits(nera);
      if (nera && mode === 'orbit') {
        const pitch = neraOrbitPitch(map.getZoom());
        if (Math.abs(map.getPitch() - pitch) > 3) map.easeTo({ pitch: pitch, duration: 180 });
      }
    }

    function refreshNeraWireGrid(state, force) {
      const now = Date.now();
      if (!force && now - lastNeraGridMs < 240) return;
      lastNeraGridMs = now;
      const threeD = state && state.cameraMode !== 'flat' && state.online !== false;
      const wire = Boolean(state && threeD && ((state.neraMode && state.neraStyle === 'wire') || state.wireframe));
      if (!wire) {
        setGeo('nera-grid', empty);
        setGeo('nera-range', empty);
        return;
      }
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const dense = state.wireframe === true;
      const spacing = dense ? Math.max(25, neraGridSpacingMeters(zoom) / 2) : neraGridSpacingMeters(zoom);
      const midLat = (bounds.getSouth() + bounds.getNorth()) / 2;
      const dLat = spacing / 111320;
      const dLng = spacing / (111320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
      const feats = [];
      let lngCount = 0;
      for (let lng = bounds.getWest(); lng <= bounds.getEast() && lngCount < 36; lng += dLng, lngCount += 1) {
        feats.push({ type: 'Feature', properties: { kind: 'grid' }, geometry: { type: 'LineString', coordinates: [[lng, bounds.getSouth()], [lng, bounds.getNorth()]] } });
      }
      let latCount = 0;
      for (let lat = bounds.getSouth(); lat <= bounds.getNorth() && latCount < 36; lat += dLat, latCount += 1) {
        feats.push({ type: 'Feature', properties: { kind: 'grid' }, geometry: { type: 'LineString', coordinates: [[bounds.getWest(), lat], [bounds.getEast(), lat]] } });
      }
      setGeo('nera-grid', { type: 'FeatureCollection', features: feats });
      if (state.gps && typeof state.gps.latitude === 'number' && typeof state.gps.longitude === 'number') {
        setGeo('nera-range', {
          type: 'FeatureCollection',
          features: [91.44, 182.88, 365.76].map(function (meters) {
            return { type: 'Feature', properties: { kind: 'range' }, geometry: { type: 'LineString', coordinates: ringCoords(state.gps.longitude, state.gps.latitude, meters, 64) } };
          }),
        });
      } else setGeo('nera-range', empty);
    }

    function applyElevationSkin(threeD, state) {
      const basemapId = state.peekBasemap || state.basemap || currentBasemapId || 'hybrid';
      const sat = basemapId === 'satellite' || basemapId === 'hybrid' || basemapId === 'naip';
      const dark = state.mapTheme !== 'light';
      const terrainLive = Boolean(threeD && terrainMeshReady);
      const nera = Boolean(state.neraMode && terrainLive);
      const mesh = Boolean(state.wireframe && terrainLive);
      const neraWire = Boolean(nera && state.neraStyle === 'wire');
      const wire = neraWire || mesh;
      const glass = Boolean(nera && state.neraStyle !== 'wire' && !mesh);
      const intel = Boolean(terrainLive && dark && !nera && !mesh);
      const elevColor = ['interpolate', ['linear'], ['coalesce', ['get', 'ele'], 0], 0, '#22d3ee', 80, '#67e8f9', 180, '#84cc16', 360, '#f59e0b', 720, '#fb7185'];
      const mapEl = map.getContainer();
      if (terrainLive) mapEl.classList.add('is-elevation');
      else mapEl.classList.remove('is-elevation');
      if (terrainLive && !dark && !nera && !mesh) mapEl.classList.add('is-elevation-light');
      else mapEl.classList.remove('is-elevation-light');
      if (nera) mapEl.classList.add('is-nera');
      else mapEl.classList.remove('is-nera');
      if (neraWire) mapEl.classList.add('is-nera-wire');
      else mapEl.classList.remove('is-nera-wire');
      if (mesh) mapEl.classList.add('is-wireframe-mesh');
      else mapEl.classList.remove('is-wireframe-mesh');
      if (map.getLayer('background')) {
        map.setPaintProperty('background', 'background-color', terrainLive ? (mesh || nera ? '#000104' : dark ? '#02080c' : '#d7e4dc') : '#070b08');
      }
      if (map.getLayer('basemap')) {
        map.setPaintProperty('basemap', 'raster-opacity', terrainLive ? (mesh ? (sat ? 0.16 : 0.08) : wire ? (sat ? 0.46 : 0.38) : nera ? (sat ? 0.52 : 0.4) : sat ? (dark ? 0.22 : 0.42) : dark ? 0.06 : 0.22) : 1);
        map.setPaintProperty('basemap', 'raster-saturation', threeD ? (mesh ? -0.55 : wire ? -0.35 : nera ? -0.18 : sat ? -0.2 : dark ? -0.55 : -0.2) : 0);
        map.setPaintProperty('basemap', 'raster-contrast', threeD ? (mesh ? 0.28 : wire ? 0.16 : nera ? 0.28 : dark ? 0.22 : 0.08) : 0);
        try {
          map.setPaintProperty('basemap', 'raster-brightness-min', terrainLive && (mesh || nera) ? (mesh ? 0.02 : wire ? 0.05 : 0.06) : 0);
          map.setPaintProperty('basemap', 'raster-brightness-max', terrainLive && (mesh || nera) ? (mesh ? 0.78 : wire ? 0.9 : 0.92) : 1);
        } catch (err) {}
      }
      if (map.getLayer('streetsref')) {
        map.setLayoutProperty('streetsref', 'visibility', glass ? 'visible' : (terrainLive ? 'none' : (basemapId === 'hybrid' ? 'visible' : 'none')));
        if (glass) map.setPaintProperty('streetsref', 'raster-opacity', 0.32);
      }
      if (map.getLayer('hillshade')) {
        map.setLayoutProperty('hillshade', 'visibility', terrainLive || state.hillshade === true ? 'visible' : 'none');
        map.setPaintProperty('hillshade', 'raster-opacity', terrainLive ? (wire ? 0.55 : nera ? 0.42 : dark ? 0.92 : 0.7) : (typeof state.hillshadeOpacity === 'number' ? state.hillshadeOpacity : 0.42));
        map.setPaintProperty('hillshade', 'raster-saturation', threeD ? (nera ? -0.22 : dark ? -0.18 : -0.05) : 0);
        map.setPaintProperty('hillshade', 'raster-contrast', threeD ? (nera ? 0.22 : dark ? 0.28 : 0.12) : 0);
      }
      if (map.getLayer('dem-hillshade')) {
        map.setLayoutProperty('dem-hillshade', 'visibility', threeD ? 'visible' : 'none');
        map.setPaintProperty('dem-hillshade', 'hillshade-exaggeration', terrainLive ? (nera || mesh ? 0.88 : dark ? 0.92 : 0.62) : 0.5);
        map.setPaintProperty('dem-hillshade', 'hillshade-highlight-color', nera || mesh ? '#e0fbff' : dark ? '#7af6ff' : '#f8fafc');
        map.setPaintProperty('dem-hillshade', 'hillshade-shadow-color', nera || mesh ? '#020617' : dark ? '#02151c' : '#334155');
        map.setPaintProperty('dem-hillshade', 'hillshade-accent-color', nera || mesh ? '#22d3ee' : '#e6a31a');
      }
      if (map.getLayer('dem-rim')) {
        map.setLayoutProperty('dem-rim', 'visibility', terrainLive ? 'visible' : 'none');
        if (nera || mesh) {
          map.setPaintProperty('dem-rim', 'hillshade-highlight-color', '#7af6ff');
          map.setPaintProperty('dem-rim', 'hillshade-accent-color', '#22d3ee');
          map.setPaintProperty('dem-rim', 'hillshade-exaggeration', mesh ? 0.62 : 0.48);
        }
      }
      if (map.getLayer('nera-relief')) {
        map.setLayoutProperty('nera-relief', 'visibility', intel ? 'visible' : 'none');
      }
      if (map.getLayer('nera-mesh')) {
        let reliefOn = false;
        if (nera || mesh) {
          try {
            const elev = map.queryTerrainElevation(map.getCenter());
            reliefOn = typeof elev === 'number' && isFinite(elev);
          } catch (err) {}
        }
        map.setLayoutProperty('nera-mesh', 'visibility', reliefOn ? 'visible' : 'none');
        if (reliefOn) {
          try { map.setPaintProperty('nera-mesh', 'color-relief-opacity', mesh ? 0.28 : wire ? 0.42 : 0.62); } catch (err) {}
        }
      }
      if (map.getLayer('slope-heat')) {
        map.setLayoutProperty('slope-heat', 'visibility', intel ? 'visible' : 'none');
      }
      const contourId = overlayIndex['usgs-contours'];
      if (contourId && map.getLayer(contourId)) {
        map.setLayoutProperty(contourId, 'visibility', glass || (terrainLive && !nera && !mesh) ? 'visible' : 'none');
        map.setPaintProperty(contourId, 'raster-opacity', glass ? 0.78 : 0.55);
      }
      if (map.getLayer('nera-wrap-glow')) map.setLayoutProperty('nera-wrap-glow', 'visibility', glass ? 'visible' : 'none');
      if (map.getLayer('nera-wrap-minor')) map.setLayoutProperty('nera-wrap-minor', 'visibility', glass ? 'visible' : 'none');
      if (map.getLayer('nera-wrap-major')) map.setLayoutProperty('nera-wrap-major', 'visibility', glass ? 'visible' : 'none');
      if (map.getLayer('nera-rings-glow')) map.setLayoutProperty('nera-rings-glow', 'visibility', wire ? 'visible' : 'none');
      if (map.getLayer('nera-rings-minor')) {
        map.setLayoutProperty('nera-rings-minor', 'visibility', wire ? 'visible' : 'none');
        if (wire) {
          try { map.setPaintProperty('nera-rings-minor', 'line-color', mesh ? elevColor : '#22d3ee'); } catch (err) {}
          map.setPaintProperty('nera-rings-minor', 'line-opacity', mesh ? 0.88 : 0.78);
          map.setPaintProperty('nera-rings-minor', 'line-width', mesh ? 0.85 : 0.7);
        }
      }
      if (map.getLayer('nera-rings-major')) {
        map.setLayoutProperty('nera-rings-major', 'visibility', wire ? 'visible' : 'none');
        if (wire) {
          try { map.setPaintProperty('nera-rings-major', 'line-color', mesh ? elevColor : '#e0fbff'); } catch (err) {}
          map.setPaintProperty('nera-rings-major', 'line-opacity', mesh ? 0.98 : 0.96);
          map.setPaintProperty('nera-rings-major', 'line-width', mesh ? 1.7 : 1.45);
        }
      }
      if (map.getLayer('nera-grid')) {
        map.setLayoutProperty('nera-grid', 'visibility', wire ? 'visible' : 'none');
        if (wire) {
          map.setPaintProperty('nera-grid', 'line-opacity', mesh ? 0.42 : 0.28);
          map.setPaintProperty('nera-grid', 'line-width', mesh ? 0.7 : 0.55);
        }
      }
      if (map.getLayer('nera-range')) map.setLayoutProperty('nera-range', 'visibility', wire ? 'visible' : 'none');
      if (nera || mesh) {
        ['usgs-3dep-lidar', 'nera-mesh', 'dem-hillshade', 'dem-rim', 'nera-wrap-glow', 'nera-wrap-minor', 'nera-wrap-major', 'nera-rings-glow', 'nera-rings-minor', 'nera-rings-major', 'nera-grid', 'nera-range'].forEach(function (id) {
          const layerId = id === 'usgs-3dep-lidar' ? overlayIndex['usgs-3dep-lidar'] : id;
          if (layerId && map.getLayer(layerId)) {
            try { map.moveLayer(layerId); } catch (err) {}
          }
        });
      }
      try {
        if (!terrainLive) {
          map.setSky({
            'sky-color': '#071018',
            'horizon-color': '#1a3d44',
            'fog-color': '#070b08',
            'fog-ground-blend': 0,
            'horizon-fog-blend': 0.4,
            'atmosphere-blend': 0,
          });
        } else if (nera || mesh) {
          map.setSky({
            'sky-color': '#000510',
            'horizon-color': '#0a5a6e',
            'fog-color': '#031018',
            'fog-ground-blend': 0.08,
            'horizon-fog-blend': 0.55,
            'atmosphere-blend': 0.22,
          });
        } else if (dark) {
          map.setSky({
            'sky-color': '#031018',
            'horizon-color': '#0e4a52',
            'fog-color': '#02080c',
            'fog-ground-blend': 0.18,
            'horizon-fog-blend': 0.9,
            'atmosphere-blend': 0.55,
          });
        } else {
          map.setSky({
            'sky-color': '#9ec8d6',
            'horizon-color': '#d7e8ee',
            'fog-color': '#c5d4c8',
            'fog-ground-blend': 0.22,
            'horizon-fog-blend': 0.72,
            'atmosphere-blend': 0.35,
          });
        }
      } catch (err) {}
    }

    function setupNeraContours() {
      import('https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.0/+esm').then(function (mod) {
        const mlcontour = mod.default || mod;
        if (!mlcontour || !mlcontour.DemSource) return;
        const dem = new mlcontour.DemSource({
          url: boot.demTiles,
          encoding: 'terrarium',
          maxzoom: 15,
          worker: true,
        });
        dem.setupMaplibre(maplibregl);
        const neraUrl = dem.contourProtocolUrl({
          overzoom: 1,
          thresholds: { 11: [40, 200], 12: [20, 100], 13: [10, 50], 14: [5, 25], 15: [2.5, 10] },
          elevationKey: 'ele',
          levelKey: 'level',
          contourLayer: 'contours',
        });
        if (!map.getSource('nera-contours')) {
          map.addSource('nera-contours', { type: 'vector', tiles: [neraUrl], maxzoom: 16 });
        }
        if (!map.getLayer('nera-wrap-glow')) {
          map.addLayer({
            id: 'nera-wrap-glow',
            type: 'line',
            source: 'nera-contours',
            'source-layer': 'contours',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#22d3ee', 'line-width': 4.4, 'line-opacity': 0.38, 'line-blur': 2.4 },
          });
          map.addLayer({
            id: 'nera-wrap-minor',
            type: 'line',
            source: 'nera-contours',
            'source-layer': 'contours',
            filter: ['==', ['get', 'level'], 0],
            layout: { visibility: 'none' },
            paint: { 'line-color': '#7af6ff', 'line-width': 0.85, 'line-opacity': 0.82, 'line-blur': 0.25 },
          });
          map.addLayer({
            id: 'nera-wrap-major',
            type: 'line',
            source: 'nera-contours',
            'source-layer': 'contours',
            filter: ['>=', ['get', 'level'], 1],
            layout: { visibility: 'none' },
            paint: { 'line-color': '#f8fafc', 'line-width': 1.7, 'line-opacity': 0.96, 'line-blur': 0.15 },
          });
        }
        if (lastState) applyElevationSkin(lastState.cameraMode !== 'flat' && lastState.online !== false, lastState);
      }).catch(function () {});
    }

    function setupNeraRings() {
      import('https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.0/+esm').then(function (mod) {
        const mlcontour = mod.default || mod;
        if (!mlcontour || !mlcontour.DemSource) return;
        const dem = new mlcontour.DemSource({
          url: boot.demTiles,
          encoding: 'terrarium',
          maxzoom: 15,
          worker: true,
        });
        dem.setupMaplibre(maplibregl);
        const ringUrl = dem.contourProtocolUrl({
          overzoom: 2,
          thresholds: { 11: [20, 100], 12: [10, 50], 13: [5, 25], 14: [2.5, 10], 15: [1, 5] },
          elevationKey: 'ele',
          levelKey: 'level',
          contourLayer: 'contours',
        });
        if (!map.getSource('nera-rings')) {
          map.addSource('nera-rings', { type: 'vector', tiles: [ringUrl], maxzoom: 16 });
        }
        if (!map.getLayer('nera-rings-glow')) {
          map.addLayer({
            id: 'nera-rings-glow',
            type: 'line',
            source: 'nera-rings',
            'source-layer': 'contours',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#22d3ee', 'line-width': 3.4, 'line-opacity': 0.4, 'line-blur': 2.2 },
          });
          map.addLayer({
            id: 'nera-rings-minor',
            type: 'line',
            source: 'nera-rings',
            'source-layer': 'contours',
            filter: ['==', ['get', 'level'], 0],
            layout: { visibility: 'none' },
            paint: { 'line-color': '#22d3ee', 'line-width': 0.7, 'line-opacity': 0.78, 'line-blur': 0.2 },
          });
          map.addLayer({
            id: 'nera-rings-major',
            type: 'line',
            source: 'nera-rings',
            'source-layer': 'contours',
            filter: ['>=', ['get', 'level'], 1],
            layout: { visibility: 'none' },
            paint: { 'line-color': '#e0fbff', 'line-width': 1.45, 'line-opacity': 0.96, 'line-blur': 0.12 },
          });
        }
        if (lastState) applyElevationSkin(lastState.cameraMode !== 'flat' && lastState.online !== false, lastState);
      }).catch(function () {});
    }

    function applyCamera(state) {
      const mode = state.cameraMode || 'flat';
      const online = state.online !== false;
      const exaggeration = typeof state.terrainExaggeration === 'number' ? state.terrainExaggeration : 3.2;
      const threeD = mode !== 'flat' && online;
      const nera = Boolean(state.neraMode && threeD && terrainMeshReady);
      applyNeraLimits(nera);
      if (threeD) {
        map.dragRotate.enable();
        map.touchPitch.enable();
        if (terrainMeshReady) {
          try {
            map.setTerrain({ source: 'terrain', exaggeration: exaggeration });
          } catch (err) {}
        }
        if (!terrainIdleHooked) {
          terrainIdleHooked = true;
          map.once('idle', function () {
            terrainIdleHooked = false;
            terrainReady = true;
            if (!lastState) return;
            const live = lastState.cameraMode !== 'flat' && lastState.online !== false;
            const neraOn = Boolean(lastState.neraMode && live && terrainMeshReady);
            applyNeraLimits(neraOn);
            applyElevationSkin(live, lastState);
            if (terrainMeshReady && lastState.cameraMode === 'orbit' && map.getPitch() < 40) {
              map.easeTo({ pitch: neraOn ? neraOrbitPitch(map.getZoom()) : 70, duration: 560 });
            }
            if (!terrainMeshReady || !map.getSource('terrain')) return;
            try {
              map.setTerrain({
                source: 'terrain',
                exaggeration: typeof lastState.terrainExaggeration === 'number' ? lastState.terrainExaggeration : 3.2,
              });
            } catch (err) {}
          });
        }
        if (terrainMeshReady && mode === 'orbit' && map.getPitch() < 40 && terrainReady) {
          map.easeTo({ pitch: nera ? neraOrbitPitch(map.getZoom()) : 70, duration: 560 });
        }
      } else {
        map.setTerrain(null);
        map.dragRotate.disable();
        map.touchPitch.disable();
        if (map.getPitch() !== 0) map.easeTo({ pitch: 0, duration: 360 });
      }
      applyElevationSkin(threeD, state);
      refreshNeraWireGrid(state, true);
      refreshGpsRangeRings(state, true);
      if (mode === 'fpv' && state.gps && state.fpvHeadingLock !== false) {
        const entering = !lastFpvCamera;
        lastFpvCamera = true;
        applyFpvCamera(state, entering);
      } else {
        lastFpvCamera = false;
      }
    }

    function clearMarkers(list) {
      while (list.length) {
        const marker = list.pop();
        marker.remove();
      }
    }

    function markColor(type) {
      if (type === 'truck') return '#8a9bb0';
      if (type === 'harvest') return '#8b1e12';
      if (type === 'stand') return '#c2410c';
      if (type === 'blind') return '#7c5c3e';
      if (type === 'water') return '#2a9d8f';
      if (type === 'trail_camera') return '#7c3aed';
      if (type === 'scrape' || type === 'rub' || type === 'sighting' || type === 'scat' || type === 'track') return '#e6a31a';
      return '#f15a24';
    }

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, function (ch) {
        if (ch === '&') return '&amp;';
        if (ch === '<') return '&lt;';
        if (ch === '>') return '&gt;';
        if (ch === '"') return '&quot;';
        return '&#39;';
      });
    }

    function waypointPopupHtml(point) {
      const photos = Array.isArray(point.photos) && point.photos.length ? point.photos.slice(0, 6) : (point.photo ? [point.photo] : []);
      const strip = photos.length ? '<div class="pin-pop-photos">' + photos.map(function (url) { return '<img src=' + JSON.stringify(String(url)) + ' alt="" />'; }).join('') + '</div>' : '';
      const notes = String(point.notes || '').trim();
      const noteHtml = notes ? '<p class="pin-pop-notes">' + escapeHtml(notes) + '</p>' : '<p class="pin-pop-notes is-empty">No description yet.</p>';
      return '<div class="pin-pop" data-id="' + escapeHtml(point.id) + '">' + strip +
        '<strong class="pin-pop-title">' + escapeHtml(point.name) + '</strong>' +
        '<p class="pin-pop-meta">' + escapeHtml(point.typeLabel || point.type) + '</p>' + noteHtml +
        '<div class="pin-pop-actions"><button type="button" data-act="go">Go</button><button type="button" data-act="photo">Photo</button><button type="button" data-act="edit">Edit</button><button type="button" data-act="close">Close</button></div></div>';
    }

    function memoryPopupHtml(memory) {
      const stamp = memory.takenAt ? new Date(memory.takenAt).toLocaleString() : '';
      const place = memory.placeLabel || (Number.isFinite(memory.latitude) ? memory.latitude.toFixed(5) + ', ' + memory.longitude.toFixed(5) : '');
      const caption = String(memory.caption || '').trim();
      return '<div class="holo" data-id="' + escapeHtml(memory.id) + '">' +
        '<img class="holo-hero" src=' + JSON.stringify(String(memory.uri)) + ' alt="" />' +
        '<div class="holo-copy"><strong class="holo-title">Memory</strong>' +
        '<p class="holo-meta">' + escapeHtml(stamp) + (place ? ' · ' + escapeHtml(place) : '') + '</p>' +
        (caption ? '<p class="holo-note">' + escapeHtml(caption) + '</p>' : '') +
        '</div><div class="holo-actions"><button type="button" data-act="go">Fly here</button><button type="button" data-act="close">Close</button></div></div>';
    }

    function applyOverlayVectors(vectors, flags) {
      lastVectors = vectors || lastVectors || {};
      const features = [];
      Object.keys(lastVectors).forEach(function (id) {
        if (!flags[id]) return;
        const fc = lastVectors[id];
        const list = fc && fc.features ? fc.features : [];
        list.forEach(function (feat) { features.push(feat); });
      });
      setGeo('vectors', { type: 'FeatureCollection', features: features });
    }

    function applyLayerVisibility(state) {
      if (!state) return;
      lastState = Object.assign({}, lastState || {}, state);
      applyBasemap(state.peekBasemap || state.basemap || currentBasemapId || 'hybrid');
      const catalog = state.overlayCatalog || (lastState && lastState.overlayCatalog) || [];
      const flags = state.overlayFlags || (lastState && lastState.overlayFlags) || {};
      catalog.forEach(function (entry) {
        (entry.tiles || []).forEach(function (tile) {
          const opacity = entry.id === 'publicLand' && typeof state.publicLandOpacity === 'number' ? state.publicLandOpacity : tile.opacity;
          ensureOverlayRaster(tile, opacity);
          const sid = overlayIndex[tile.id];
          const threeD = state.cameraMode === 'orbit' || state.cameraMode === 'fpv';
          const wire = (state.neraMode === true && state.neraStyle === 'wire') || state.wireframe === true;
          const on = tile.id === 'usgs-contours'
            ? (threeD && !wire)
            : flags[entry.id] === true;
          if (sid && map.getLayer(sid)) {
            map.setLayoutProperty(sid, 'visibility', on ? 'visible' : 'none');
            if (typeof opacity === 'number') map.setPaintProperty(sid, 'raster-opacity', opacity);
          }
        });
      });
      applyOverlayVectors(lastVectors, flags);
      const threeDHill = state.cameraMode === 'orbit' || state.cameraMode === 'fpv';
      if (map.getLayer('hillshade') && !threeDHill) {
        map.setLayoutProperty('hillshade', 'visibility', state.hillshade === true ? 'visible' : 'none');
        if (typeof state.hillshadeOpacity === 'number') map.setPaintProperty('hillshade', 'raster-opacity', state.hillshadeOpacity);
      }
      applyCamera(lastState);
    }

    function applyState(state) {
      if (!state) return;
      lastState = state;
      if (!window.__nomadMapLive && state.gps && typeof state.gps.latitude === 'number' && typeof state.gps.longitude === 'number') {
        window.__nomadPaintLand(state.gps.latitude, state.gps.longitude, map.getZoom());
      }
      ensureGeoLayers();
      applyLayerVisibility(state);

      if (state.radar && state.radar.visible && state.radar.url) {
        if (lastRadarUrl !== state.radar.url) {
          if (map.getLayer('radar')) map.removeLayer('radar');
          if (map.getSource('radar-src') && map.getSource('radar-src').setTiles) {
            map.getSource('radar-src').setTiles([state.radar.url]);
          } else if (!map.getSource('radar-src')) {
            map.addSource('radar-src', { type: 'raster', tiles: [state.radar.url], tileSize: 256, maxzoom: 18 });
          }
          if (!map.getLayer('radar')) map.addLayer({ id: 'radar', type: 'raster', source: 'radar-src', paint: { 'raster-opacity': typeof state.radarOpacity === 'number' ? state.radarOpacity : 0.58 } }, 'tracks');
          lastRadarUrl = state.radar.url;
        }
        if (map.getLayer('radar')) map.setLayoutProperty('radar', 'visibility', 'visible');
      } else if (map.getLayer('radar')) {
        map.setLayoutProperty('radar', 'visibility', 'none');
      }

      clearMarkers(waypointMarkers);
      if (!state.selectedWaypointId && !state.selectedMemoryId && popup) {
        popup.remove();
        lastSelectedEase = null;
      }
      (state.waypoints || []).forEach(function (point) {
        const isKill = point.type === 'harvest';
        if (isKill && state.showKills === false) return;
        if (!isKill && state.showWaypoints === false) return;
        const selected = point.id === state.selectedWaypointId;
        const el = document.createElement('div');
        el.className = 'nomad-hit';
        if (point.photo) {
          el.innerHTML = '<div class="photo-pin' + (selected ? ' pin-selected' : '') + '" style="background-image:url(' + JSON.stringify(point.photo) + ')"><span class="pip" style="background:' + markColor(point.type) + '"></span></div>';
        } else {
          el.innerHTML = '<div class="nomad-mark' + (selected ? ' is-on' : '') + '"><div class="nomad-drop" style="background:' + markColor(point.type) + '"></div><div class="nomad-mark-label">' + String(point.name || '').slice(0, 18).replace(/[<>]/g, '') + '</div></div>';
        }
        const marker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: selected })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map);
        el.addEventListener('click', function (event) {
          event.stopPropagation();
          emit({ type: 'waypoint', id: point.id });
        });
        if (selected) {
          marker.on('dragend', function () {
            const ll = marker.getLngLat();
            emit({ type: 'waypointmove', id: point.id, latitude: ll.lat, longitude: ll.lng });
          });
          if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 18, className: 'pin-pop-wrap', maxWidth: '260px' });
          popup.options.className = 'pin-pop-wrap';
          popup.setLngLat([point.longitude, point.latitude]).setHTML(waypointPopupHtml(point)).addTo(map);
          const root = popup.getElement();
          if (root) {
            root.querySelectorAll('[data-act]').forEach(function (btn) {
              btn.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                const act = btn.getAttribute('data-act');
                if (act === 'go') emit({ type: 'waypointgo', id: point.id });
                else if (act === 'photo') emit({ type: 'waypointphoto', id: point.id, source: 'library' });
                else if (act === 'edit') emit({ type: 'waypointedit', id: point.id });
                else if (act === 'close') {
                  popup.remove();
                  emit({ type: 'waypointclose', id: point.id });
                }
              });
            });
          }
          if (state.cameraMode !== 'fpv' && lastSelectedEase !== point.id) {
            lastSelectedEase = point.id;
            map.easeTo({
              center: [point.longitude, point.latitude],
              duration: 640,
              pitch: map.getPitch(),
            });
          }
        }
        waypointMarkers.push(marker);
      });

      clearMarkers(memoryMarkers);
      if (state.showMemories) {
        (state.memories || []).forEach(function (memory) {
          if (!Number.isFinite(memory.latitude) || !Number.isFinite(memory.longitude) || !memory.uri) return;
          const selected = memory.id === state.selectedMemoryId;
          const el = document.createElement('div');
          el.className = 'nomad-hit';
          el.innerHTML = '<div class="memory-pin' + (selected ? ' is-on' : '') + '" style="background-image:url(' + JSON.stringify(memory.uri) + ')"></div>';
          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([memory.longitude, memory.latitude])
            .addTo(map);
          el.addEventListener('click', function (event) {
            event.stopPropagation();
            emit({ type: 'memory', id: memory.id });
          });
          if (selected) {
            if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 22, className: 'hologram-pop', maxWidth: '240px' });
            popup.options.className = 'hologram-pop';
            popup.setLngLat([memory.longitude, memory.latitude]).setHTML(memoryPopupHtml(memory)).addTo(map);
            const root = popup.getElement();
            if (root) {
              root.querySelectorAll('[data-act]').forEach(function (btn) {
                btn.addEventListener('click', function (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  const act = btn.getAttribute('data-act');
                  if (act === 'go') emit({ type: 'memorygo', id: memory.id });
                  else if (act === 'close') {
                    popup.remove();
                    emit({ type: 'memoryclose', id: memory.id });
                  }
                });
              });
            }
            if (state.cameraMode !== 'fpv' && lastSelectedEase !== 'memory:' + memory.id) {
              lastSelectedEase = 'memory:' + memory.id;
              map.easeTo({
                center: [memory.longitude, memory.latitude],
                duration: 640,
                pitch: map.getPitch(),
              });
            }
          }
          memoryMarkers.push(marker);
        });
      }

      clearMarkers(planMarkers);
      (state.plannedHunts || []).forEach(function (plan) {
        const el = document.createElement('div');
        el.innerHTML = '<div class="plan-pin"></div>';
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([plan.longitude, plan.latitude]).addTo(map);
        el.addEventListener('click', function (event) {
          event.stopPropagation();
          emit({ type: 'plan', id: plan.id });
        });
        planMarkers.push(marker);
      });

      setGeo('past', state.showTracks === false ? empty : {
        type: 'FeatureCollection',
        features: (state.pastTracks || []).filter(function (line) { return line && line.length > 1; }).map(function (line) {
          return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map(function (p) { return [p.longitude, p.latitude]; }) } };
        }),
      });
      setGeo('tracks', state.showTracks === false ? empty : pointsToLine(state.track));
      setGeo('return', pointsToLine(state.returnLine));
      setGeo('heat', state.showKillHeat ? pointFc(state.killHeat) : empty);
      setGeo('score', state.showHuntScore ? pointFc(state.scoreOverlay) : empty);
      setGeo('bedding', state.showBedding ? pointFc(state.scoreOverlay) : empty);
      setGeo('feeding', state.showFeeding ? pointFc(state.scoreOverlay) : empty);
      setGeo('terrain-pts', state.showTerrainFeatures ? pointFc(state.terrainOverlay) : empty);
      setGeo('slope-heat', {
        type: 'FeatureCollection',
        features: (state.slopeHeat || []).filter(function (p) { return typeof p.slopeDegrees === 'number' && p.slopeDegrees > 0; }).map(function (p) {
          return { type: 'Feature', properties: { slope: p.slopeDegrees }, geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] } };
        }),
      });
      setGeo('units', state.showHuntUnits && state.unitOverlay ? {
        type: 'FeatureCollection',
        features: (state.unitOverlay || []).map(function (ring) {
          return {
            type: 'Feature',
            properties: { label: ring.label || 'Hunting unit' },
            geometry: { type: 'Polygon', coordinates: [(ring.points || []).map(function (p) { return [p.longitude, p.latitude]; })] },
          };
        }).filter(function (f) { return f.geometry.coordinates[0].length >= 3; }),
      } : empty);
      setGeo('wind', state.windCone && state.windCone.length > 2 ? {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [state.windCone.map(function (p) { return [p.longitude, p.latitude]; })] } }],
      } : empty);
      setGeo('measure', pointFc(state.measure));
      if (state.measure && state.measure.length >= 2) {
        setGeo('measure', {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: { type: state.measureClosed ? 'Polygon' : 'LineString', coordinates: state.measureClosed
              ? [state.measure.map(function (p) { return [p.longitude, p.latitude]; })]
              : state.measure.map(function (p) { return [p.longitude, p.latitude]; }) },
          }].concat((state.measure || []).map(function (p) {
            return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] } };
          })),
        });
      }
      setGeo('recovery', pointsToLine(state.recoveryTrack));
      setGeo('los', state.showLos ? {
        type: 'FeatureCollection',
        features: (state.losOverlay || []).map(function (cell) {
          return { type: 'Feature', properties: { visible: !!cell.visible }, geometry: { type: 'Point', coordinates: [cell.longitude, cell.latitude] } };
        }),
      } : empty);

      const scoutFeatures = [];
      if (state.showScoutAreas !== false) {
        (state.scoutAreas || []).forEach(function (area) {
          const color = ({ rust: '#F15A24', gold: '#e6a31a', teal: '#2a9d8f', violet: '#7c3aed' })[area.color] || '#F15A24';
          (area.points || []).forEach(function (point) {
            scoutFeatures.push({
              type: 'Feature',
              properties: { id: area.id, color: color },
              geometry: { type: 'Polygon', coordinates: [ringCoords(point.longitude, point.latitude, area.radiusMeters || 183, 48)] },
            });
          });
        });
      }
      setGeo('scout', { type: 'FeatureCollection', features: scoutFeatures });

      const areaFeatures = (state.huntAreas || []).map(function (area) {
        if (area.ring && area.ring.length >= 3) {
          return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [area.ring.map(function (p) { return [p.longitude, p.latitude]; })] } };
        }
        return {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[[area.west, area.south], [area.east, area.south], [area.east, area.north], [area.west, area.north], [area.west, area.south]]] },
        };
      });
      setGeo('areas', { type: 'FeatureCollection', features: areaFeatures });
      setGeo('draw', pointsToLine(state.drawRing));

      if (state.gps) {
        const heading = typeof state.gps.heading === 'number' && !isNaN(state.gps.heading) ? state.gps.heading : 0;
        const poor = typeof state.gps.accuracy === 'number' && state.gps.accuracy > 45;
        let cls = state.gps.source && state.gps.source !== 'gps' ? 'gps-wrap is-operator' : 'gps-wrap';
        if (poor) cls += ' is-poor';
        const html = '<div class="' + cls + '" style="transform:rotate(' + heading + 'deg)"><div class="gps-pulse"></div>' +
          (typeof state.gps.heading === 'number' ? '<div class="gps-needle"></div>' : '') + '<div class="gps-puck"></div></div>';
        if (!gpsMarker) {
          const el = document.createElement('div');
          el.innerHTML = html;
          gpsMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([state.gps.longitude, state.gps.latitude]).addTo(map);
        } else {
          gpsMarker.setLngLat([state.gps.longitude, state.gps.latitude]);
          gpsMarker.getElement().innerHTML = html;
        }
        const threeD = state.cameraMode === 'orbit' || state.cameraMode === 'fpv';
        gpsMarker.getElement().style.display = threeD ? 'none' : '';
        setGeo('gps-puck', {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ringCoords(state.gps.longitude, state.gps.latitude, 7, 32)] } }],
        });
        if (map.getLayer('gps-puck')) {
          map.setLayoutProperty('gps-puck', 'visibility', threeD ? 'visible' : 'none');
          try { map.moveLayer('gps-puck'); } catch (err) {}
        }
        if (map.getLayer('gps-puck-core')) {
          map.setLayoutProperty('gps-puck-core', 'visibility', threeD ? 'visible' : 'none');
          try { map.moveLayer('gps-puck-core'); } catch (err) {}
        }
        const fpv = state.cameraMode === 'fpv';
        const face = typeof state.gps.heading === 'number' && !isNaN(state.gps.heading) ? state.gps.heading : map.getBearing();
        if (fpv) {
          setGeo('gps-heading', {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [headingArrowCoords(state.gps.longitude, state.gps.latitude, face, 16, 8)] },
              },
            ],
          });
          if (map.getLayer('gps-heading')) {
            map.setLayoutProperty('gps-heading', 'visibility', 'visible');
            try { map.moveLayer('gps-heading'); } catch (err) {}
          }
          if (map.getLayer('gps-heading-line')) {
            map.setLayoutProperty('gps-heading-line', 'visibility', 'visible');
            try { map.moveLayer('gps-heading-line'); } catch (err) {}
          }
        } else {
          setGeo('gps-heading', empty);
          if (map.getLayer('gps-heading')) map.setLayoutProperty('gps-heading', 'visibility', 'none');
          if (map.getLayer('gps-heading-line')) map.setLayoutProperty('gps-heading-line', 'visibility', 'none');
        }
        const acc = typeof state.gps.accuracy === 'number' ? state.gps.accuracy : 0;
        setGeo('gps-accuracy', !threeD && acc > 8 ? {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ringCoords(state.gps.longitude, state.gps.latitude, acc, 48)] } }],
        } : empty);
        if (state.compassRay === true && typeof state.gps.heading === 'number') {
          const end = destPoint(state.gps.longitude, state.gps.latitude, state.gps.heading, 700);
          setGeo('ray', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[state.gps.longitude, state.gps.latitude], end] } }] });
        } else setGeo('ray', empty);
        if (state.headingUp === true && state.cameraMode !== 'fpv' && typeof state.gps.heading === 'number') {
          map.rotateTo(state.gps.heading, { duration: 0 });
        }
      } else {
        if (gpsMarker) { gpsMarker.remove(); gpsMarker = null; }
        setGeo('gps-accuracy', empty);
        setGeo('gps-puck', empty);
        setGeo('gps-heading', empty);
        setGeo('ray', empty);
        if (map.getLayer('gps-puck')) map.setLayoutProperty('gps-puck', 'visibility', 'none');
        if (map.getLayer('gps-puck-core')) map.setLayoutProperty('gps-puck-core', 'visibility', 'none');
        if (map.getLayer('gps-heading')) map.setLayoutProperty('gps-heading', 'visibility', 'none');
        if (map.getLayer('gps-heading-line')) map.setLayoutProperty('gps-heading-line', 'visibility', 'none');
      }

      if (state.showGrid === true) {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        const step = zoom >= 15 ? 0.0025 : zoom >= 13 ? 0.01 : zoom >= 11 ? 0.05 : 0.2;
        const south = Math.floor(bounds.getSouth() / step) * step;
        const west = Math.floor(bounds.getWest() / step) * step;
        const feats = [];
        for (let lat = south; lat <= bounds.getNorth(); lat += step) {
          feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[bounds.getWest(), lat], [bounds.getEast(), lat]] } });
        }
        for (let lng = west; lng <= bounds.getEast(); lng += step) {
          feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng, bounds.getSouth()], [lng, bounds.getNorth()]] } });
        }
        setGeo('grid', { type: 'FeatureCollection', features: feats });
      } else setGeo('grid', empty);

      if (state.followGps && state.gps && state.cameraMode !== 'fpv') {
        map.easeTo({
          center: [state.gps.longitude, state.gps.latitude],
          pitch: state.cameraMode === 'orbit' ? (state.neraMode ? neraOrbitPitch(map.getZoom()) : 70) : map.getPitch(),
          duration: 380,
        });
      }

      if (state.flyRequestId && state.flyRequestId !== lastFlyId && state.flyTo && !userZooming && state.cameraMode !== 'fpv') {
        lastFlyId = state.flyRequestId;
        const flyZoom = state.flyTo.zoom || map.getZoom();
        map.flyTo({
          center: [state.flyTo.longitude, state.flyTo.latitude],
          zoom: flyZoom,
          pitch: state.cameraMode === 'orbit' ? (state.neraMode ? neraOrbitPitch(flyZoom) : 70) : map.getPitch(),
          duration: 600,
        });
      }
      applyCamera(state);
    }

    window.__huntosApply = applyState;
    window.__huntosLayers = applyLayerVisibility;
    window.__huntosVectors = function (vectors) {
      lastVectors = vectors || {};
      applyOverlayVectors(lastVectors, lastState ? lastState.overlayFlags || {} : {});
    };
    if (lastState) applyState(lastState);
    function promoteMapIfPainted() {
      if (window.__nomadMapLive) return;
      const canvas = map.getCanvas();
      if (!canvas || canvas.width < 8 || canvas.height < 8) return;
      let bright = false;
      try {
        const gl = map.painter && map.painter.context && map.painter.context.gl;
        if (gl) {
          const pixel = new Uint8Array(4);
          gl.readPixels(Math.max(0, Math.floor(canvas.width / 2)), Math.max(0, Math.floor(canvas.height / 2)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          bright = pixel[0] + pixel[1] + pixel[2] >= 8;
        }
      } catch (err) {}
      if (!window.__nomadRevealed) {
        window.__nomadRevealed = true;
        emit({ type: 'painted' });
      }
      if (!bright) return;
      window.__nomadMapLive = true;
      map.getContainer().classList.add('is-live');
      const land = document.getElementById('land');
      if (land) land.style.display = 'none';
    }
    map.on('idle', promoteMapIfPainted);
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (err) { return; }
      }
      if (data && data.type === 'tile-result' && data.id) {
        window.__nomadTile(data.id, data.dataUrl || null);
        return;
      }
      if (data && data.type === 'vectors') {
        window.__huntosVectors(data.vectors || {});
        return;
      }
      if (data && data.type === 'layers') {
        window.__huntosLayers(data);
        return;
      }
      if (data && data.basemap) applyState(data);
    });

    map.on('load', function () {
      ensureGeoLayers();
      applyBasemap('hybrid');
      setupNeraContours();
      setupNeraRings();
      emit({ type: 'ready' });
    });
    map.on('data', function (event) {
      if (terrainMeshReady) return;
      if (!event || event.sourceId !== 'terrain' || event.dataType !== 'source' || !event.tile) return;
      terrainMeshReady = true;
      if (lastState) applyCamera(lastState);
    });
    map.on('click', function (event) {
      if (didLongPress) { didLongPress = false; return; }
      const scoutHits = map.getLayer('scout-fill') ? map.queryRenderedFeatures(event.point, { layers: ['scout-fill'] }) : [];
      if (scoutHits[0] && scoutHits[0].properties && scoutHits[0].properties.id) {
        emit({ type: 'radius', id: scoutHits[0].properties.id });
        return;
      }
      emit({ type: 'tap', longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    });
    map.on('contextmenu', function (event) {
      didLongPress = true;
      emit({ type: 'longpress', longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    });
    map.on('mousedown', function (event) {
      pressTimer = setTimeout(function () {
        didLongPress = true;
        emit({ type: 'longpress', longitude: event.lngLat.lng, latitude: event.lngLat.lat });
      }, 550);
    });
    map.on('mouseup', function () { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
    map.on('dragstart', function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      const mode = lastState && lastState.cameraMode;
      if (mode === 'fpv') emit({ type: 'fpvunlock' });
      else emit({ type: 'unfollow' });
    });
    map.on('zoomstart', function () {
      if (fpvProgrammatic) return;
      userZooming = true;
      if (lastState && lastState.cameraMode === 'fpv') emit({ type: 'fpvunlock' });
    });
    map.on('zoomend', function () {
      userZooming = true;
      setTimeout(function () { userZooming = false; }, 900);
      if (!lastState) return;
      const nera = Boolean(lastState.neraMode && lastState.cameraMode !== 'flat' && lastState.online !== false);
      applyNeraLimits(nera);
      refreshNeraWireGrid(lastState, true);
      refreshGpsRangeRings(lastState, true);
    });
    map.on('moveend', function () {
      const bounds = map.getBounds();
      emit({ type: 'bounds', west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() });
      if (lastState) {
        refreshNeraWireGrid(lastState);
        refreshGpsRangeRings(lastState);
      }
    });
    });
  </script>
</body>
</html>`;
}
