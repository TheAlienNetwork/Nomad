"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DatasetRecord } from "@huntos/core";

interface HealthPayload {
  datasets: Array<DatasetRecord & { health: { lastCheckedAt?: string; lastError?: string; featureCount?: number } | null }>;
}

export default function AdminPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/health");
    setData((await response.json()) as HealthPayload);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-dvh bg-field-ink p-6 text-field-mist">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-field-amber">HUNT//OS ADMIN</p>
          <h1 className="text-2xl">Dataset health</h1>
        </div>
        <div className="flex gap-2">
          <Link className="btn-dock px-4" href="/">
            MAP
          </Link>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void fetch("/api/admin/health", { method: "POST" })
                .then((response) => response.json())
                .then((payload) => setData(payload as HealthPayload))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "CHECKING…" : "RECHECK SOURCES"}
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data?.datasets.map((dataset) => (
          <article key={dataset.datasetId} className="panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">{dataset.name}</h2>
              <span className="font-mono text-xs uppercase text-field-amber">{dataset.status}</span>
            </div>
            <p className="text-sm text-field-mist/70">{dataset.agency}</p>
            <p className="mt-2 font-mono text-xs">Last checked: {dataset.health?.lastCheckedAt ?? "never"}</p>
            <p className="font-mono text-xs">Version: {dataset.version ?? "—"}</p>
            <p className="font-mono text-xs">Features: {dataset.health?.featureCount ?? "—"}</p>
            {dataset.health?.lastError && (
              <p className="mt-2 text-sm text-field-danger">{dataset.health.lastError}</p>
            )}
            <p className="mt-2 text-xs text-field-mist/50">{dataset.attribution}</p>
            <button
              type="button"
              className="btn-dock mt-3 px-3"
              onClick={() => {
                void fetch("/api/datasets", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ datasetId: dataset.datasetId, enabled: !dataset.enabled }),
                }).then(() => load());
              }}
            >
              {dataset.enabled ? "DISABLE" : "ENABLE"}
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
