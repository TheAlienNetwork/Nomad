export type HuntLog = {
  id: string;
  title: string;
  area: string;
  date: string;
  notes: string;
};

export type Waypoint = {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
};

export type GearItem = {
  id: string;
  name: string;
  packed: boolean;
};

export const recentHunts: HuntLog[] = [
  {
    id: '1',
    title: 'Dawn sit',
    area: 'North ridge',
    date: 'Aug 23',
    notes: 'Light west wind. Two does at 70 yards, no legal buck.',
  },
  {
    id: '2',
    title: 'Evening still-hunt',
    area: 'Creek bottom',
    date: 'Aug 16',
    notes: 'Fresh rubs on the east trail. Moved stand 40 yards.',
  },
];

export const huntArea = {
  name: 'Allegheny National Forest',
  latitude: 41.68,
  longitude: -79.15,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

export const waypoints: Waypoint[] = [
  {
    id: '1',
    name: 'Truck',
    detail: 'Forest road pull-off',
    latitude: 41.6712,
    longitude: -79.1684,
  },
  {
    id: '2',
    name: 'North stand',
    detail: 'Oak ridge, facing west',
    latitude: 41.6924,
    longitude: -79.1418,
  },
  {
    id: '3',
    name: 'Water',
    detail: 'Creek crossing below the saddle',
    latitude: 41.6648,
    longitude: -79.1326,
  },
];

export const packList: GearItem[] = [
  { id: '1', name: 'License / tags', packed: true },
  { id: '2', name: 'Binoculars', packed: true },
  { id: '3', name: 'Rangefinder', packed: false },
  { id: '4', name: 'Headlamp', packed: true },
  { id: '5', name: 'First aid', packed: true },
  { id: '6', name: 'Knife / game bags', packed: false },
];
