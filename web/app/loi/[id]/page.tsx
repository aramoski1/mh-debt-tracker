import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/PrintButton";
import { money } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: park }, { data: saved }] = await Promise.all([
    supabase.from("park_overview").select("id, name, city, state, units, owner_name").eq("id", id).maybeSingle(),
    supabase.from("underwriting").select("price, cap_rate, lot_rent, occupancy_pct, sites, field_sources").eq("park_id", id).maybeSingle(),
  ]);
  if (!park) notFound();
  const row = park as { name: string; city: string | null; state: string; units: number | null; owner_name: string | null };
  const caseRow = saved as { price: number | null; cap_rate: number | null; lot_rent: number | null; occupancy_pct: number | null; sites: number | null; field_sources?: Record<string, string> } | null;
  const sources = caseRow?.field_sources ?? {};
  const ready = caseRow?.price != null;
  return (
    <div className="space-y-4">
      <Link href={`/parks/${id}`} className="text-xs text-muted hover:text-accent">← {row.name}</Link>
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-medium">Offer letter</h1>
        <PrintButton />
      </div>
      {!ready ? (
        <p className="text-sm text-muted">Save a price on the underwriting screen before this letter is ready. Estimated figures are labeled and nothing here is sent.</p>
      ) : (
        <article className="max-w-2xl space-y-3 rounded-md border border-line bg-panel p-6 text-sm leading-6">
          <p>Cooper Cardinal buys and operates parks. This is a draft for {row.owner_name ?? "the owner"} to edit. It is not an offer until you send it yourself.</p>
          <p>{row.name}{row.city ? `, ${row.city}` : ""}, {row.state}. Sites on the underwriting screen: {caseRow?.sites ?? row.units ?? "—"}.</p>
          <p>Price {money(caseRow?.price ?? null)}{sources.price ? ` (${sources.price})` : " (entered on the underwriting screen)"}.</p>
          <p>Cap rate {caseRow?.cap_rate ?? "—"}{sources.cap_rate === "estimate" ? " — this cap rate is an estimate." : ""}.</p>
          <p>Lot rent {caseRow?.lot_rent ?? "—"}{sources.lot_rent === "estimate" ? " — estimated, not from a rent roll." : sources.lot_rent ? ` (${sources.lot_rent})` : ""}.</p>
          <p>Occupancy {caseRow?.occupancy_pct ?? "—"}%{sources.occupancy_pct === "estimate" ? " — estimated." : ""}.</p>
          <p>Edit any line that is marked estimated before this leaves your desk.</p>
        </article>
      )}
    </div>
  );
}
