"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="font-semibold">The portfolio could not be loaded</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
