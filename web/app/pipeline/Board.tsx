"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Card = { parkId: string; name: string; overdue: string | null; stale: boolean };
type Column = { id: string; label: string; cards: Card[] };

export function Board({ columns }: { columns: Column[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function drop(stage: string, event: React.DragEvent) {
    event.preventDefault();
    const parkId = event.dataTransfer.getData("text/plain");
    if (!parkId) return;
    const res = await fetch("/api/deals", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, stage }),
    });
    if (!res.ok) { setMsg("Could not move that deal."); return; }
    router.refresh();
  }

  return (
    <div>
      {msg && <p className="mb-2 text-sm text-negative">{msg}</p>}
      <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {columns.map((column) => (
          <div key={column.id} className="rounded-md border border-line bg-panel p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(column.id, e)}>
            <p className="text-xs text-muted">{column.label} · {column.cards.length}</p>
            <ul className="mt-2 space-y-2">
              {column.cards.map((card) => (
                <li key={card.parkId} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", card.parkId)} className="cursor-grab rounded-sm border border-line bg-sunken px-2 py-1">
                  <Link href={`/parks/${card.parkId}`} className="text-sm font-medium hover:text-accent">{card.name}</Link>
                  {card.overdue && <div className="text-xs text-accent">Overdue {card.overdue}</div>}
                  {card.stale && <div className="text-xs text-muted">Sitting more than 14 days</div>}
                </li>
              ))}
              {!column.cards.length && <li className="text-xs text-muted">Drop a deal here.</li>}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
