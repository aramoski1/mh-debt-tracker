"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Brokers type or dictate a note after a call; the server pulls out outcome, follow-up date, lender, maturity and
// motivation, so the park record stays current without anyone filling in fields.
export default function NoteForm({ parkId }: { parkId: string }) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("call");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, body, kind }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Could not save the note.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 w-36 rounded-sm border border-line bg-panel px-2 text-sm text-fg">
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="visit">Visit</option>
          <option value="note">Note</option>
        </select>
      </label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                placeholder="e.g. Spoke with Bob. Loan with Western Alliance comes due next March at 4.1%, they offered 7.25%. Thinking about retiring, call back after New Year."
                className="w-full rounded-sm border border-line p-2" />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-sm bg-accent px-3 py-1.5 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50">
          {busy ? "Saving…" : "Save note"}
        </button>
        {err && <span className="text-negative">{err}</span>}
      </div>
    </form>
  );
}
