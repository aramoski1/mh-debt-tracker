"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseAsk } from "@/lib/ask";

type Answer = { reply?: string; href?: string; understood?: string[]; ignored?: { term: string; reason: string }[]; parks?: { id: string; name: string }[] };

export function AskDesk() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAsk(q);
    if (parsed.intent !== "search") {
      setAnswer({ reply: parsed.reply });
      setErr(null);
      return;
    }
    router.push(parsed.href);
  }

  async function explain() {
    setPending(true);
    setErr(null);
    const res = await fetch("/api/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const body = (await res.json().catch(() => ({}))) as Answer & { error?: string };
    setPending(false);
    if (!res.ok) {
      setErr(body.error ?? "Could not answer.");
      return;
    }
    setAnswer(body);
  }

  const note = [
    ...(answer?.understood ?? []),
    ...(answer?.ignored ?? []).map((item) => `Ignored ${item.term}: ${item.reason}`),
  ].join(" · ");

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs text-muted">Ask</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Banks in Tucson due in 12 months"
            className="h-8 rounded-sm border border-line bg-panel px-2 text-sm"
          />
        </label>
        <button className="h-8 rounded-sm bg-accent px-3 text-sm font-medium text-on-accent">Search</button>
        <button type="button" onClick={explain} disabled={pending || !q.trim()} className="h-8 rounded-sm border border-line px-3 text-sm">
          {pending ? "Looking" : "Answer from the book"}
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-negative">{err}</p>}
      {answer?.reply && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{answer.reply}</p>}
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      {answer?.parks && answer.parks.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {answer.parks.map((park) => (
            <li key={park.id}><a className="text-accent" href={`/parks/${park.id}`}>{park.name}</a></li>
          ))}
        </ul>
      )}
    </section>
  );
}
