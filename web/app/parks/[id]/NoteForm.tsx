"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Brokers type or dictate a note after a call; the server pulls out outcome, follow-up date, lender, maturity and
// motivation, so the park record stays current without anyone filling in fields.
export default function NoteForm({ parkId }: { parkId: string }) {
  const [body, setBody] = useState("");
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
      body: JSON.stringify({ parkId, body }),
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
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                placeholder="e.g. Spoke with Bob. Loan with Western Alliance comes due next March at 4.1%, they offered 7.25%. Thinking about retiring, call back after New Year."
                className="w-full rounded border border-stone-300 p-2" />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded bg-stone-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save note"}
        </button>
        {err && <span className="text-red-700">{err}</span>}
      </div>
    </form>
  );
}
