import type { ReactNode } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { isDemo } from "@/lib/supabase/demo";
import { money, monthYear, pct } from "@/lib/format";
import { PageHeader, Tabs } from "@/components/ui/Bits";

export const dynamic = "force-dynamic";

type HudLoan = {
  property_name_raw: string | null; property_city_raw: string | null; property_state_raw: string | null;
  maturity_date: string | null; note_rate: number | null; original_amount: number | null;
  current_balance: number | null; status: string | null; lender_name_raw: string | null;
  raw: { soa?: string } | null;
};
type Offering = {
  accession: string; issuer_name: string; city: string | null; state: string | null;
  filed_on: string | null; total_sold: number | null; is_equity: boolean | null; is_debt: boolean | null; url: string | null;
};
type Hit = { source: string; source_id: string; title: string | null; url: string | null; filed_on: string | null; form: string | null; snippet: string | null };
type Distress = { source_id: string; event_type: string; county: string | null; event_date: string | null; amount: number | null; title: string | null; park_id: string | null };
type Sale = { source_id: string; county: string | null; apn: string | null; sale_date: string | null; price: number | null; sites: number | null; price_per_site: number | null; owner_name: string | null; park_id: string | null };
type Entity = { id: string; name: string; zip: string; kind: string };

export default async function SignalsPage() {
  const supabase = await supabaseServer();
  const [{ data: hud }, { data: offerings }, { data: hits }, { data: distress }, { data: sales }, { data: entities }] = await Promise.all([
    supabase.from("loans").select("property_name_raw, property_city_raw, property_state_raw, maturity_date, note_rate, original_amount, current_balance, status, lender_name_raw, raw")
      .eq("source", "hud").order("maturity_date", { ascending: true }).limit(80),
    supabase.from("form_d_offerings").select("*").order("filed_on", { ascending: false }).limit(40),
    supabase.from("filing_hits").select("*").order("filed_on", { ascending: false }).limit(40),
    supabase.from("distress_events").select("*").order("event_date", { ascending: false }).limit(40),
    supabase.from("transactions").select("*").order("sale_date", { ascending: false }).limit(40),
    supabase.from("entities").select("id, name, zip, kind").order("name").limit(30),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Signals" title="Filings, sales, and recorded owners" lede="Links and assessor rows already on file. An offering is not a maturity date. The owner is the name on the roll." />
      {isDemo() && <p className="text-xs text-muted">The rows on this page are the fictional demo set.</p>}
      <Tabs tabs={[
        { id: "fha", label: "FHA", content: (
      <Section title="FHA mobile-home mortgages">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Property</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Maturity</th>
              <th className="px-4 py-2 text-right font-medium">Rate</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {((hud ?? []) as HudLoan[]).map((row) => (
              <tr key={`${row.property_name_raw}-${row.maturity_date}`} className="border-t border-line">
                <td className="px-4 py-2">
                  {row.property_name_raw}
                  <span className="block text-xs text-muted">{[row.property_city_raw, row.property_state_raw].filter(Boolean).join(", ")} · {row.lender_name_raw}</span>
                </td>
                <td className="px-4 py-2 text-xs">{row.raw?.soa}</td>
                <td className="num px-4 py-2">{monthYear(row.maturity_date)}</td>
                <td className="num px-4 py-2 text-right">{pct(row.note_rate)}</td>
                <td className="num px-4 py-2 text-right">{money(row.current_balance)}</td>
                <td className="px-4 py-2">{row.status}</td>
              </tr>
            ))}
            {!hud?.length && <Empty cols={6} label="No FHA mobile-home mortgages loaded." />}
          </tbody>
        </table>
      </Section>
        )},
        { id: "formd", label: "Form D", content: (
      <Section title="Form D park issuers">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Issuer</th>
              <th className="px-4 py-2 font-medium">Filed</th>
              <th className="px-4 py-2 text-right font-medium">Sold</th>
              <th className="px-4 py-2 font-medium">Security</th>
            </tr>
          </thead>
          <tbody>
            {((offerings ?? []) as Offering[]).map((row) => (
              <tr key={row.accession} className="border-t border-line">
                <td className="px-4 py-2">
                  {row.url ? <a className="text-accent" href={row.url}>{row.issuer_name}</a> : row.issuer_name}
                  <span className="block text-xs text-muted">{[row.city, row.state].filter(Boolean).join(", ")}</span>
                </td>
                <td className="num px-4 py-2">{row.filed_on}</td>
                <td className="num px-4 py-2 text-right">{money(row.total_sold)}</td>
                <td className="px-4 py-2 text-xs">{row.is_equity ? "Equity" : row.is_debt ? "Debt" : "—"}</td>
              </tr>
            ))}
            {!offerings?.length && <Empty cols={4} label="No park Form D issuers in the latest quarter." />}
          </tbody>
        </table>
      </Section>
        )},
        { id: "filings", label: "Filings", content: (
      <Section title="EDGAR hits and headlines">
        <ul className="divide-y divide-line">
          {((hits ?? []) as Hit[]).map((row) => (
            <li key={`${row.source}:${row.source_id}`} className="px-4 py-2">
              {row.url ? <a className="text-accent" href={row.url}>{row.title}</a> : row.title}
              <span className="block text-xs text-muted">{row.form} · {row.filed_on} · {row.source.replaceAll("_", " ")}</span>
            </li>
          ))}
          {!hits?.length && <li className="px-4 py-6 text-muted">No filings or headlines stored.</li>}
        </ul>
      </Section>
        )},
        { id: "distress", label: "Distress", content: (
      <Section title="Recorder distress">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Park link</th>
            </tr>
          </thead>
          <tbody>
            {((distress ?? []) as Distress[]).map((row) => (
              <tr key={row.source_id + row.event_type} className="border-t border-line">
                <td className="px-4 py-2">{row.title || row.event_type}<span className="block text-xs text-muted">{row.county}</span></td>
                <td className="num px-4 py-2">{row.event_date}</td>
                <td className="num px-4 py-2 text-right">{money(row.amount)}</td>
                <td className="px-4 py-2 text-xs">{row.park_id ? "Linked" : "Unlinked"}</td>
              </tr>
            ))}
            {!distress?.length && <Empty cols={4} label="No trustee-sale or lis pendens documents stored." />}
          </tbody>
        </table>
      </Section>
        )},
        { id: "sales", label: "Sales", content: (
      <Section title="Assessor sale prices">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Parcel</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Per site</th>
              <th className="px-4 py-2 font-medium">Assessor owner</th>
            </tr>
          </thead>
          <tbody>
            {((sales ?? []) as Sale[]).map((row) => (
              <tr key={row.source_id} className="border-t border-line">
                <td className="px-4 py-2">{row.apn}<span className="block text-xs text-muted">{row.county}</span></td>
                <td className="num px-4 py-2">{row.sale_date}</td>
                <td className="num px-4 py-2 text-right">{money(row.price)}</td>
                <td className="num px-4 py-2 text-right">{row.price_per_site == null ? "—" : money(row.price_per_site)}</td>
                <td className="px-4 py-2">{row.owner_name}</td>
              </tr>
            ))}
            {!sales?.length && <Empty cols={5} label="No assessor sale prices on park parcels." />}
          </tbody>
        </table>
      </Section>
        )},
        { id: "owners", label: "Owners", content: (
      <Section title="Recorded owners">
        <ul className="divide-y divide-line">
          {((entities ?? []) as Entity[]).map((row) => (
            <li key={row.id} className="px-4 py-2">{row.name}<span className="block text-xs text-muted">{row.kind.replaceAll("_", " ")}{row.zip ? ` · ${row.zip}` : ""}</span></li>
          ))}
          {!entities?.length && <li className="px-4 py-6 text-muted">No recorded owners grouped yet.</li>}
        </ul>
      </Section>
        )},
      ]} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-x-auto rounded-sm border border-line bg-panel">
      <h2 className="border-b border-line px-4 py-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ cols, label }: { cols: number; label: string }) {
  return <tr><td colSpan={cols} className="px-4 py-6 text-muted">{label}</td></tr>;
}
