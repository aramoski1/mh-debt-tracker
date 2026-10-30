import Link from "next/link";
import { PageHeader } from "@/components/ui/Bits";
import { supabaseServer } from "@/lib/supabase/server";
import { Issues } from "./Issues";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("ingestion_errors")
    .select("id, stage, source_ref, message, created_at, dismissed_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const open = ((data ?? []) as { id: string; stage: string; source_ref: string | null; message: string; created_at: string; dismissed_at: string | null; resolved_at: string | null }[])
    .filter((row) => !row.dismissed_at && !row.resolved_at);
  return (
    <div className="space-y-4">
      <PageHeader kicker="Admin" title="Data issues" lede="A failed source run is written here in plain language. Dismiss hides it. Resolve means someone looked at it." />
      <p className="text-sm"><Link href="/freshness" className="text-accent">Source freshness</Link> · <Link href="/admin/audit" className="text-accent">Park audit</Link></p>
      <Issues rows={open} />
    </div>
  );
}
