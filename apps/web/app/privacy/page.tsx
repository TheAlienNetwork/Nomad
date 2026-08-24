import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-field-ink p-6 text-field-mist">
      <p className="font-mono text-xs tracking-[0.3em] text-field-amber">HUNT//OS</p>
      <h1 className="mt-2 text-2xl">Privacy</h1>
      <div className="mt-4 max-w-2xl space-y-3 text-sm leading-6">
        <p>Hunter locations are treated as sensitive.</p>
        <p>
          Waypoints, tracks, cameras, harvests, and hunt areas default to private. The server
          stores them only for the signed-in account. Precise location sharing is not enabled
          in this version.
        </p>
        <p>
          Field marks also stay in this browser&apos;s IndexedDB so they survive a lost
          connection. Signing out does not delete local field notes.
        </p>
        <p>
          Map tiles and land-status queries go to USGS / Open-Meteo through this application.
          Those providers receive the coordinates needed to answer the request.
        </p>
        <p>
          Do not use this product to publish someone else&apos;s stand, camera, or harvest
          location.
        </p>
      </div>
      <Link className="btn-dock mt-6 inline-flex items-center px-4" href="/">
        BACK TO MAP
      </Link>
      <Link className="btn-dock mt-6 ml-2 inline-flex items-center px-4" href="/terms">
        TERMS
      </Link>
    </main>
  );
}
