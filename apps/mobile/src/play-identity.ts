/** Play Internal Testing identity. Do not change the package after first upload. */
export const PLAY_PACKAGE = 'com.nomad.field';
export const PLAY_APP_NAME = 'Nomad';
export const PLAY_VERSION = '1.0.20';
export const PLAY_VERSION_CODE = 21;
export const PLAY_TRACK = 'internal' as const;

export const PLAY_DATA_SAFETY = {
  location: 'Precise location — show the hunter on the map and record tracks. Collected on device; synced to the signed-in account when cloud save is configured.',
  photos: 'Optional memoir sketches and profile photo — only if the hunter picks a photo. They can also save a sketched JPEG to the camera roll.',
  microphone: 'Not collected on the Play Android build. Web memoir dictation uses the browser only while they dictate notes.',
  account: 'Email and password via Supabase Auth. Field marks stay private to that user (RLS).',
  notCollected: 'No advertising ID, no analytics SDK, no sale of data.',
} as const;
