import Link from "next/link";
import { PageHeader } from "@/components/ui/Bits";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  owner_name: string | null;
  loan_id: string | null;
  loan_source: string | null;
  maturity_date: string | null;
};

const GOV = /\b(county|city of|town of|state of|united states|arizona state land)\b/i;

export default async function AuditPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("park_overview")
    .select("id, name, owner_name, loan_id, loan_source, maturity_date")
    .eq("state", "AZ")
    .limit(2000);
  const rows = (data ?? []) as Row[];
  const flags: { parkId: string; name: string; issue: string }[] = [];
  for (const park of rows) {
    if (/^park at\b/i.test(park.name)) flags.push({ parkId: park.id, name: park.name, issue: "Placeholder name" });
    if (park.owner_name && GOV.test(park.owner_name)) flags.push({ parkId: park.id, name: park.name, issue: "Government owner" });
    if (!park.owner_name) flags.push({ parkId: park.id, name: park.name, issue: "No owner on the park" });
    if (park.loan_id && !park.maturity_date) flags.push({ parkId: park.id, name: park.name, issue: "Loan with no maturity date" });
    if ((park.loan_source === "cmbs" || park.loan_source === "edgar") && !park.maturity_date) {
      flags.push({ parkId: park.id, name: park.name, issue: "CMBS loan with a null maturity" });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Admin" title="Park audit" lede="Rows the book should not treat as a normal owner. A park with no owner is listed because the assessor has not been matched, not because the park has no owner in the world." />
      <p className="text-sm text-muted">{flags.length ? `${flags.length} flags in this book.` : "Nothing in this book matches the audit rules."}</p>
      <ul className="divide-y divide-line rounded-md border border-line bg-panel">
        {flags.slice(0, 80).map((flag, i) => (
          <li key={`${flag.parkId}-${flag.issue}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
            <Link href={`/parks/${flag.parkId}`} className="font-medium hover:text-accent">{flag.name}</Link>
            <span className="text-xs text-muted">{flag.issue}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
