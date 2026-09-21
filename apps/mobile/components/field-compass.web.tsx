import { CompassFace } from '@/components/compass-face';
import { useFieldStore } from '@/src/store';
import { useFieldLocation } from '@/src/use-field-location';

export function FieldCompass() {
  useFieldLocation();
  const gpsHeading = useFieldStore((state) => state.gps.heading);
  const heading = typeof gpsHeading === 'number' && Number.isFinite(gpsHeading) ? gpsHeading : null;
  const source =
    heading != null
      ? 'GPS course on web · move to update. Use the phone app for a magnetic compass.'
      : 'No GPS course yet. On a phone, the compass uses the magnetometer offline.';

  return <CompassFace heading={heading} source={source} />;
}
