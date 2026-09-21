import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { useEffect } from 'react';

import { useFieldStore } from './store';

type WatchHandle = {
  remove: () => void;
};

function applyFix(
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    altitude: number | null;
  },
  recordedAt: string,
): void {
  useFieldStore.getState().appendGps({
    longitude: coords.longitude,
    latitude: coords.latitude,
    recordedAt,
    accuracyM: coords.accuracy,
    heading: coords.heading,
    altitudeM: coords.altitude,
    source: 'gps',
  });
}

function safeRemove(handle?: WatchHandle): void {
  if (!handle) return;
  try {
    handle.remove();
  } catch {
    // expo-location on web throws: LocationEventEmitter.removeSubscription is not a function
  }
}

async function startNativeWatch(
  onError: (message: string) => void,
  fpv: boolean,
): Promise<WatchHandle | undefined> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    onError('NO FIX');
    return undefined;
  }
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  applyFix(
    {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      accuracy: current.coords.accuracy,
      heading: current.coords.heading,
      altitude: current.coords.altitude,
    },
    new Date().toISOString(),
  );
  const store = useFieldStore.getState();
  if (!store.firstFixFlown) {
    if (store.cameraMode !== 'fpv') {
      store.requestFlyTo(current.coords.latitude, current.coords.longitude, 15);
    }
    store.markFirstFixFlown();
  }
  void store.refreshWeather(current.coords.latitude, current.coords.longitude);
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: fpv ? 1000 : 4000,
      distanceInterval: fpv ? 2 : 8,
    },
    (update) => {
      applyFix(
        {
          latitude: update.coords.latitude,
          longitude: update.coords.longitude,
          accuracy: update.coords.accuracy,
          heading: update.coords.heading,
          altitude: update.coords.altitude,
        },
        new Date(update.timestamp).toISOString(),
      );
    },
  );
  return {
    remove: () => {
      try {
        subscription.remove();
      } catch {
        // Same EventEmitter mismatch on some Expo web builds.
      }
    },
  };
}

function startBrowserWatch(onError: (message: string) => void, fpv: boolean): WatchHandle | undefined {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('NO FIX');
    return undefined;
  }
  const geo = navigator.geolocation;
  geo.getCurrentPosition(
    (current) => {
      applyFix(
        {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          accuracy: current.coords.accuracy,
          heading: current.coords.heading,
          altitude: current.coords.altitude,
        },
        new Date(current.timestamp).toISOString(),
      );
      const store = useFieldStore.getState();
      if (!store.firstFixFlown) {
        if (store.cameraMode !== 'fpv') {
          store.requestFlyTo(current.coords.latitude, current.coords.longitude, 15);
        }
        store.markFirstFixFlown();
      }
      void store.refreshWeather(current.coords.latitude, current.coords.longitude);
    },
    () => onError('NO FIX'),
    { enableHighAccuracy: true, maximumAge: fpv ? 1000 : 4000, timeout: 12_000 },
  );
  const watchId = geo.watchPosition(
    (update) => {
      applyFix(
        {
          latitude: update.coords.latitude,
          longitude: update.coords.longitude,
          accuracy: update.coords.accuracy,
          heading: update.coords.heading,
          altitude: update.coords.altitude,
        },
        new Date(update.timestamp).toISOString(),
      );
    },
    () => onError('NO FIX'),
    { enableHighAccuracy: true, maximumAge: fpv ? 1000 : 4000, timeout: 12_000 },
  );
  return {
    remove: () => geo.clearWatch(watchId),
  };
}

export function useFieldLocation(): void {
  const setGpsError = useFieldStore((state) => state.setGpsError);
  const fpvWatch = useFieldStore((state) => state.cameraMode === 'fpv');

  useEffect(() => {
    let handle: WatchHandle | undefined;
    let cancelled = false;

    const start = async () => {
      try {
        handle =
          Platform.OS === 'web'
            ? startBrowserWatch(setGpsError, fpvWatch)
            : await startNativeWatch(setGpsError, fpvWatch);
        if (cancelled) safeRemove(handle);
      } catch {
        if (!cancelled) setGpsError('NO FIX');
      }
    };

    void start();
    return () => {
      cancelled = true;
      safeRemove(handle);
    };
  }, [setGpsError, fpvWatch]);
}

export async function locateOnce(): Promise<void> {
  const store = useFieldStore.getState();
  if (store.followGps) {
    store.setFollowGps(false);
    return;
  }

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      store.setGpsError('NO FIX');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (current) => {
        store.locate({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          accuracy: current.coords.accuracy,
          heading: current.coords.heading,
        });
      },
      () => store.setGpsError('NO FIX'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 },
    );
    return;
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    store.setGpsError('NO FIX');
    return;
  }
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  store.locate({
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
    accuracy: current.coords.accuracy,
    heading: current.coords.heading,
  });
}
