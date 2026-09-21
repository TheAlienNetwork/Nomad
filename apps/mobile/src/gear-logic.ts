import { SPECIES_LABELS, type SpeciesId, type WeatherSnapshot } from '@huntos/core';

import {
  GEAR_SUGGESTIONS,
  type GearSuggestion,
} from '@/src/gear-suggestions';

export type SitConditionId = 'cold' | 'wet' | 'wind' | 'dark' | 'species';

export type SitCondition = {
  id: SitConditionId;
  label: string;
};

export type SitSuggestion = GearSuggestion & {
  reason: string;
};

export type SitBriefing = {
  ready: number;
  packedEssentials: number;
  essentialTotal: number;
  packed: number;
  total: number;
  conditions: SitCondition[];
  suggestions: SitSuggestion[];
};

function hourNow(): number {
  return new Date().getHours();
}

function ownedSet(names: string[]): Set<string> {
  return new Set(names.map((name) => name.trim().toLowerCase()));
}

export function sitConditions(input: {
  weather?: WeatherSnapshot;
  species?: SpeciesId;
  hour?: number;
}): SitCondition[] {
  const hour = input.hour ?? hourNow();
  const weather = input.weather;
  const conditions: SitCondition[] = [];
  if (weather?.temperatureC != null && weather.temperatureC < 4) {
    conditions.push({ id: 'cold', label: 'Cold' });
  }
  const wet =
    (weather?.precipitationMm != null && weather.precipitationMm > 0.2) ||
    (weather?.humidityPct != null && weather.humidityPct >= 88);
  if (wet) conditions.push({ id: 'wet', label: 'Wet' });
  if (weather?.windGustMps != null && weather.windGustMps >= 8) {
    conditions.push({ id: 'wind', label: 'Wind' });
  }
  if (hour < 7 || hour >= 18) conditions.push({ id: 'dark', label: 'Low light' });
  if (input.species) {
    conditions.push({ id: 'species', label: SPECIES_LABELS[input.species] });
  }
  return conditions;
}

function reasonFor(name: string, conditions: SitCondition[]): string | null {
  const ids = new Set(conditions.map((item) => item.id));
  switch (name) {
    case 'Rain shell':
      return ids.has('wet') ? 'Precip in the forecast' : null;
    case 'Hand warmers':
    case 'Gloves':
    case 'Insulated layer':
      return ids.has('cold') ? 'Temperature is dropping' : null;
    case 'Wind shirt':
      return ids.has('wind') ? 'Gusts on the stand' : null;
    case 'Headlamp':
      return ids.has('dark') ? 'Dawn or last light' : 'Always in the core sit';
    case 'Knife / game bags':
    case 'Nitrile gloves':
    case 'Drag rope':
      return ids.has('species') ? 'Harvest kit for this sit' : null;
    case 'Blaze orange':
      return 'Legal and visible';
    case 'License / tags':
      return 'Required before you leave';
    default:
      return null;
  }
}

export function sitBriefing(input: {
  gear: Array<{ name: string; packed: boolean; essential?: boolean }>;
  weather?: WeatherSnapshot;
  species?: SpeciesId;
  hour?: number;
}): SitBriefing {
  const conditions = sitConditions(input);
  const essentialItems = input.gear.filter((item) => item.essential);
  const scored = essentialItems.length > 0 ? essentialItems : input.gear;
  const packedEssentials = scored.filter((item) => item.packed).length;
  const essentialTotal = scored.length;
  const ready = essentialTotal === 0 ? 0 : packedEssentials / essentialTotal;
  const have = ownedSet(input.gear.map((item) => item.name));
  const suggestions: SitSuggestion[] = [];
  for (const item of GEAR_SUGGESTIONS) {
    if (have.has(item.name.toLowerCase())) continue;
    const reason = reasonFor(item.name, conditions);
    if (!reason && !item.essential) continue;
    if (!reason && item.essential && input.gear.length > 0) continue;
    suggestions.push({
      ...item,
      reason: reason ?? 'Missing from the sit list',
    });
  }
  return {
    ready,
    packedEssentials,
    essentialTotal,
    packed: input.gear.filter((item) => item.packed).length,
    total: input.gear.length,
    conditions,
    suggestions: suggestions.slice(0, 8),
  };
}
