import Link from "next/link";

export type FollowUp = { parkId: string; name: string; when: string; why: string };

export default function FollowUps({ rows, today }: { rows: FollowUp[]; today: string }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-md border border-line bg-panel">
      <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Follow-ups due</h2>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={`${row.parkId}-${row.when}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
            <Link href={`/parks/${row.parkId}`} className="font-medium hover:text-accent">{row.name}</Link>
            <span className="text-xs text-muted">
              <span className="num">{row.when}</span>
              {row.when < today ? " · overdue" : ""}
              {" · "}
              {row.why}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
