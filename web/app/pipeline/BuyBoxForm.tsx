"use client";

import { useState } from "react";

type Box = { min_sites: number; max_sites: number; states: string[]; kinds: string[] };

export default function BuyBoxForm({ box }: { box: Box | null }) {
  const [minSites, setMin] = useState(box?.min_sites ?? 50);
  const [maxSites, setMax] = useState(box?.max_sites ?? 400);
  const [states, setStates] = useState((box?.states ?? ["AZ"]).join(", "));
  const [kinds, setKinds] = useState(box?.kinds ?? ["mhp", "rv", "mixed"]);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (k: string) => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);
  const save = async () => {
    const res = await fetch("/api/buy-box", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ minSites, maxSites, states, kinds }),
    });
    setMsg(res.ok ? "Buy box saved. It is used the next time parks are scored." : "Could not save.");
  };

  return (
    <section className="rounded-sm border border-line bg-panel p-4">
      <h2 className="font-semibold">Buy box</h2>
      <p className="mb-3 text-xs text-muted">Fit is scored against this box. Distance counts only for parks you have marked as managed.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Sites
          <span className="flex gap-1">
            <input value={minSites} onChange={(e) => setMin(Number(e.target.value))} className="num h-8 w-20 rounded-sm border border-line px-2 text-sm text-fg" />
            <input value={maxSites} onChange={(e) => setMax(Number(e.target.value))} className="num h-8 w-20 rounded-sm border border-line px-2 text-sm text-fg" />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">States
          <input value={states} onChange={(e) => setStates(e.target.value)} className="h-8 w-40 rounded-sm border border-line px-2 text-sm text-fg" />
        </label>
        {["mhp", "rv", "mixed"].map((k) => (
          <label key={k} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggle(k)} /> {k}
          </label>
        ))}
        <button type="button" onClick={save} className="h-8 rounded-sm bg-accent px-3 text-on-accent">Save box</button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </section>
  );
}
