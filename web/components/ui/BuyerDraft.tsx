"use client";

import { useState } from "react";
import type { Draft } from "@/lib/outreach";

export function BuyerDraft({ drafts, parkId }: { drafts: Draft[]; parkId: string }) {
  const [id, setId] = useState(drafts[0]?.id ?? "first");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const draft = drafts.find((row) => row.id === id) ?? drafts[0];
  if (!draft) return null;

  async function markSent() {
    const res = await fetch("/api/notes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, kind: "email", body: `Opened the ${draft.label} draft in the mail client. The desk did not send it.` }),
    });
    setMsg(res.ok ? "Logged as an email. That bumps the cadence clock." : "Could not log the draft.");
  }

  return (
    <section className="rounded-md border border-line bg-panel px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Outreach draft</h2>
        <select value={draft.id} onChange={(e) => setId(e.target.value)} className="h-8 rounded-sm border border-line px-2 text-sm">
          {drafts.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </div>
      <p className="mt-2 text-xs text-muted">Built from fields on the park. This desk does not send mail.</p>
      {draft.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-accent">{warning}</p>)}
      <p className="mt-2 text-sm"><span className="text-muted">To </span>{draft.to || "No email on the owner record. Use the letter."}</p>
      <pre className="mt-2 whitespace-pre-wrap rounded-sm border border-line bg-sunken p-3 text-sm">{draft.body}</pre>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" className="h-8 rounded-sm border border-line px-3 text-sm" onClick={async () => { await navigator.clipboard.writeText(draft.body); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
        {draft.href && draft.id !== "letter" && <a className="inline-flex h-8 items-center text-sm text-accent" href={draft.href}>Open in email</a>}
        <button type="button" className="h-8 text-sm text-accent" onClick={markSent}>Mark as sent</button>
        <a className="inline-flex h-8 items-center text-sm text-accent" href={`/loi/${parkId}`}>Offer letter</a>
      </div>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </section>
  );
}
