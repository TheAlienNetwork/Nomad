"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-field-ink p-6 text-field-mist">
      <p className="font-mono text-xs tracking-[0.3em] text-field-amber">HUNT//OS</p>
      <h1 className="mt-2 text-2xl">Something failed</h1>
      <p className="mt-2 max-w-md text-center text-sm text-field-mist/70">
        {error.message || "The field client hit an unexpected error. Your offline marks were not discarded."}
      </p>
      <button type="button" className="btn-primary mt-6" onClick={reset}>
        TRY AGAIN
      </button>
    </main>
  );
}
