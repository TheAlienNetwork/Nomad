import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-field-ink p-6 text-field-mist">
      <p className="font-mono text-xs tracking-[0.3em] text-field-amber">HUNT//OS</p>
      <h1 className="mt-2 text-2xl">Field terms</h1>
      <div className="mt-4 max-w-2xl space-y-3 text-sm leading-6">
        <p>
          HUNT//OS is a hunting intelligence aid. It is not a substitute for posted signs,
          fences, landowner instructions, official regulations, or current agency closures.
        </p>
        <p>
          Public-land overlays come from configured government datasets (currently PAD-US Fee).
          Missing data means unknown, not private and not huntable.
        </p>
        <p>
          Habitat scores and AI Scout results are heuristics. They do not claim animals are
          present.
        </p>
        <p>
          Season dates, bag limits, weapon rules, and legal shooting light are not invented by
          this application. Verify with the state wildlife agency before hunting.
        </p>
        <p>You are responsible for legal access, safe travel, and ethical harvest.</p>
      </div>
      <Link className="btn-dock mt-6 inline-flex items-center px-4" href="/">
        BACK TO MAP
      </Link>
    </main>
  );
}
