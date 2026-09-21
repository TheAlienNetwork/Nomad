import { Magnetometer } from 'expo-sensors';
import { useEffect, useState } from 'react';

import { CompassFace } from '@/components/compass-face';
import { useFieldStore } from '@/src/store';
import { useFieldLocation } from '@/src/use-field-location';

function headingFromMagnetometer(x: number, y: number): number {
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function FieldCompass() {
  useFieldLocation();
  const gpsHeading = useFieldStore((state) => state.gps.heading);
  const [magnetic, setMagnetic] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let mounted = true;
    let sub: { remove: () => void } | undefined;
    void Magnetometer.isAvailableAsync().then((ok) => {
      if (!mounted) return;
      if (!ok) {
        setAvailable(false);
        return;
      }
      Magnetometer.setUpdateInterval(80);
      sub = Magnetometer.addListener((data) => {
        setMagnetic(headingFromMagnetometer(data.x, data.y));
      });
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  const heading =
    magnetic != null && Number.isFinite(magnetic)
      ? magnetic
      : typeof gpsHeading === 'number' && Number.isFinite(gpsHeading)
        ? gpsHeading
        : null;
  const source =
    magnetic != null
      ? 'Magnetic north · works offline'
      : heading != null
        ? 'GPS course · move to update'
        : available
          ? 'Hold the phone flat and away from metal.'
          : 'Magnetometer unavailable. Walk for GPS course.';

  return <CompassFace heading={heading} source={source} />;
}
