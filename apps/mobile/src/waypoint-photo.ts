import { capturePhotoUri, pickPhotoUri, prepareWaypointPhoto } from '@/src/pick-photo';
import { useFieldStore } from '@/src/store';

export async function attachPickedWaypointPhoto(id: string, fromCamera: boolean): Promise<void> {
  try {
    const uri = fromCamera ? await capturePhotoUri() : await pickPhotoUri();
    if (!uri) return;
    const prepared = await prepareWaypointPhoto(uri);
    const store = useFieldStore.getState();
    store.attachWaypointPhoto(id, prepared);
    const mark = store.waypoints.find((item) => item.id === id);
    if (mark?.type === 'trail_camera') {
      store.checkInCamera(id, prepared);
    }
  } catch (error) {
    useFieldStore.setState({
      scoutMessage: error instanceof Error ? error.message : 'Photo failed.',
    });
  }
}

export async function prepareDraftWaypointPhoto(fromCamera: boolean): Promise<string | null> {
  const uri = fromCamera ? await capturePhotoUri() : await pickPhotoUri();
  if (!uri) return null;
  return prepareWaypointPhoto(uri);
}
