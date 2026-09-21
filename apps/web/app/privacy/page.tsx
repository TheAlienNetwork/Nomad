export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <p className="font-mono text-[10px] tracking-[0.35em] text-field-amber">NOMAD</p>
      <h1 className="mt-2 text-2xl font-semibold">Privacy</h1>
      <p className="mt-4 text-sm text-field-mist/80">
        Nomad is an internal field preview. It is not a legal land-access, season, or
        permission tool. Verify posted signs and official sources before you hunt.
      </p>
      <p className="mt-4 text-sm text-field-mist/80">
        Package: com.nomad.field
      </p>
      <h2 className="mt-8 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">LOCATION</h2>
      <p className="mt-2 text-sm text-field-mist/80">
        Precise location — show the hunter on the map and record tracks. Collected on
        device; synced to the signed-in account when cloud save is configured.
      </p>
      <h2 className="mt-6 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">PHOTOS</h2>
      <p className="mt-2 text-sm text-field-mist/80">
        Optional memoir sketches — only if the hunter picks a photo. They can save a sketched JPEG to the camera roll.
      </p>
      <h2 className="mt-6 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">MICROPHONE</h2>
      <p className="mt-2 text-sm text-field-mist/80">
        Optional memoir dictation — only while they dictate notes.
      </p>
      <h2 className="mt-6 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">ACCOUNT</h2>
      <p className="mt-2 text-sm text-field-mist/80">
        Email and password via Supabase Auth. Field marks stay private to that user.
      </p>
      <h2 className="mt-6 font-mono text-[10px] tracking-[0.2em] text-field-mist/50">NOT COLLECTED</h2>
      <p className="mt-2 text-sm text-field-mist/80">
        No advertising ID, no analytics SDK, no sale of data.
      </p>
      <p className="mt-8 text-xs text-field-mist/50">
        Use this URL in Play Console Data safety when the site is publicly hosted.
      </p>
    </main>
  );
}
