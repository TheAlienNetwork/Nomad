export type GearGroup = 'Essentials' | 'Optics' | 'Safety' | 'Harvest' | 'Weather' | 'Custom';

export type GearSuggestion = {
  name: string;
  group: Exclude<GearGroup, 'Custom'>;
  essential?: boolean;
};

export const GEAR_SUGGESTIONS: GearSuggestion[] = [
  { name: 'License / tags', group: 'Essentials', essential: true },
  { name: 'Headlamp', group: 'Essentials', essential: true },
  { name: 'Compass / GPS', group: 'Essentials', essential: true },
  { name: 'Water', group: 'Essentials', essential: true },
  { name: 'Binoculars', group: 'Optics', essential: true },
  { name: 'Rangefinder', group: 'Optics' },
  { name: 'First aid', group: 'Safety', essential: true },
  { name: 'Blaze orange', group: 'Safety', essential: true },
  { name: 'Emergency whistle', group: 'Safety' },
  { name: 'Knife / game bags', group: 'Harvest' },
  { name: 'Nitrile gloves', group: 'Harvest' },
  { name: 'Drag rope', group: 'Harvest' },
  { name: 'Rain shell', group: 'Weather' },
  { name: 'Hand warmers', group: 'Weather' },
  { name: 'Gloves', group: 'Weather' },
  { name: 'Insulated layer', group: 'Weather' },
  { name: 'Wind shirt', group: 'Weather' },
  { name: 'Spare batteries', group: 'Essentials' },
];

export const GEAR_GROUPS: GearGroup[] = [
  'Essentials',
  'Optics',
  'Safety',
  'Harvest',
  'Weather',
  'Custom',
];

export function unusedSuggestions(
  owned: string[],
  query: string,
  limit = 3,
): GearSuggestion[] {
  const have = new Set(owned.map((name) => name.trim().toLowerCase()));
  const needle = query.trim().toLowerCase();
  return GEAR_SUGGESTIONS.filter((item) => {
    if (have.has(item.name.toLowerCase())) return false;
    if (!needle) return true;
    return item.name.toLowerCase().includes(needle) || item.group.toLowerCase().includes(needle);
  }).slice(0, limit);
}

export function suggestionForName(name: string): GearSuggestion | undefined {
  const needle = name.trim().toLowerCase();
  return GEAR_SUGGESTIONS.find((item) => item.name.toLowerCase() === needle);
}

export function groupForGearName(name: string): GearGroup {
  return suggestionForName(name)?.group ?? 'Custom';
}

export function isEssentialGearName(name: string): boolean {
  return suggestionForName(name)?.essential === true;
}

export function asGearGroup(value: unknown): GearGroup {
  switch (value) {
    case 'Essentials':
    case 'Optics':
    case 'Safety':
    case 'Harvest':
    case 'Weather':
    case 'Custom':
      return value;
    default:
      return 'Custom';
  }
}
