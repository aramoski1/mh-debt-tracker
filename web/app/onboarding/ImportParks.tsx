"use client";

import { useState } from "react";

export function ImportParks() {
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(form: FormData) {
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ names: String(form.get("names") ?? "") }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(body.error ?? "Could not match those names."); return; }
    const matched = (body.matched as string[] | undefined) ?? [];
    const missed = (body.missed as string[] | undefined) ?? [];
    setMsg(`Matched ${matched.length}. ${missed.length ? `Not on the book: ${missed.join(", ")}. Nothing new was created.` : "Every name was already on the book."}`);
  }

  return (
    <form action={submit} className="rounded-md border border-line bg-panel p-4">
      <h2 className="text-sm font-medium">Parks you already run</h2>
      <p className="mt-1 text-sm text-body">One name or APN per line. A line is marked managed only when it matches a park already on the book.</p>
      <textarea name="names" rows={4} className="mt-2 w-full rounded-sm border border-line p-2 text-sm" placeholder="Paradise RV Resort" />
      <button type="submit" className="mt-2 h-8 rounded-sm border border-line-strong px-3 text-sm">Match</button>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </form>
  );
}
