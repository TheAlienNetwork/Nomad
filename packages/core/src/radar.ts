export type RadarFrame = {
  time: number;
  path: string;
};

export type RadarCatalog = {
  host: string;
  frames: RadarFrame[];
  nowcastStartIndex: number;
  attribution: string;
};

export const RAINVIEWER_MAPS_URL =
  "https://api.rainviewer.com/public/weather-maps.json";

export const RADAR_DISCLAIMER =
  "Radar is observed reflectivity from RainViewer composites, not a site forecast. Frames lag several minutes. Nowcast is a short look-ahead, not a day forecast.";

type RainViewerPayload = {
  host?: string;
  radar?: {
    past?: Array<{ time?: number; path?: string }>;
    nowcast?: Array<{ time?: number; path?: string }>;
  };
};

function asFrame(row: { time?: number; path?: string } | undefined): RadarFrame | null {
  if (!row || typeof row.time !== "number" || typeof row.path !== "string" || !row.path) {
    return null;
  }
  return { time: row.time, path: row.path };
}

export function parseRainViewerMaps(payload: unknown): RadarCatalog | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as RainViewerPayload;
  const host = typeof data.host === "string" ? data.host.replace(/\/$/, "") : "";
  if (!host) return null;
  const past = (data.radar?.past ?? [])
    .map(asFrame)
    .filter((frame): frame is RadarFrame => frame != null);
  const nowcast = (data.radar?.nowcast ?? [])
    .map(asFrame)
    .filter((frame): frame is RadarFrame => frame != null);
  const frames = [...past, ...nowcast];
  if (frames.length === 0) return null;
  return {
    host,
    frames,
    nowcastStartIndex: past.length,
    attribution: "Radar by RainViewer.com",
  };
}

export function radarTileTemplate(host: string, path: string): string {
  return `${host.replace(/\/$/, "")}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}
