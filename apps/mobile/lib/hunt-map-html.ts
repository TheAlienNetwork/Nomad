import { huntArea, waypoints, type Waypoint } from '@/constants/sample-data';

type HuntMapHtmlOptions = {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  points?: Waypoint[];
};

export function buildHuntMapHtml({
  center = huntArea,
  zoom = 11,
  points = waypoints,
}: HuntMapHtmlOptions = {}): string {
  const payload = JSON.stringify({
    lat: center.latitude,
    lng: center.longitude,
    zoom,
    points: points.map((point) => ({
      name: point.name,
      detail: point.detail,
      lat: point.latitude,
      lng: point.longitude,
    })),
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #050505; }
    .leaflet-control-layers, .legend, .leaflet-popup-content-wrapper, .leaflet-popup-tip {
      background: #121212;
      color: #f5f5f5;
      border: 1px solid #2a2a2a;
      box-shadow: none;
    }
    .leaflet-control-layers { border-radius: 10px; }
    .leaflet-control-layers-expanded { padding: 10px 12px; }
    .leaflet-control-layers-base label,
    .leaflet-control-layers-overlays label { color: #f5f5f5; }
    .legend {
      position: absolute;
      left: 10px;
      bottom: 16px;
      z-index: 500;
      border-radius: 10px;
      padding: 10px 12px;
      font: 12px/1.4 system-ui, sans-serif;
    }
    .legend strong { display: block; margin-bottom: 6px; color: #f15a24; letter-spacing: 0.4px; }
    .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
    .nomad-pin {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #f15a24;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px rgba(241,90,36,0.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <strong>PUBLIC HUNTING LAND</strong>
    Open / restricted PAD-US access<br />
    <span class="swatch" style="background:#2e7d32"></span>Forest / wildlife<br />
    <span class="swatch" style="background:#f4c430"></span>BLM / multiple use<br />
    <span class="swatch" style="background:#f15a24"></span>Waypoints
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/esri-leaflet@3.0.14/dist/esri-leaflet.js"></script>
  <script>
    const data = ${payload};
    const map = L.map('map', { zoomControl: true }).setView([data.lat, data.lng], data.zoom);

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri World Imagery' }
    );
    const topo = L.tileLayer(
      'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16, attribution: 'USGS The National Map' }
    );

    const publicLand = L.esri.dynamicMapLayer({
      url: 'https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US/MapServer',
      layers: [0],
      opacity: 0.58,
      layerDefs: { 0: "Pub_Access IN ('OA','RA')" },
    });

    satellite.addTo(map);
    publicLand.addTo(map);

    L.control.layers(
      { Satellite: satellite, Topo: topo },
      { 'Public hunting land': publicLand },
      { collapsed: false, position: 'topright' }
    ).addTo(map);

    const pin = L.divIcon({ className: '', html: '<div class="nomad-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    data.points.forEach(function (point) {
      L.marker([point.lat, point.lng], { icon: pin })
        .addTo(map)
        .bindPopup('<strong>' + point.name + '</strong><br/>' + point.detail);
    });
  </script>
</body>
</html>`;
}
