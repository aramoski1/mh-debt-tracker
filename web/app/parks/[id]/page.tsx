import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { BASIS_LABEL, KIND_LABEL, LENDER_LABEL, type ParkRow, type ScoreComponent } from "@/lib/types";
import { money, monthYear, pct, scoreTone } from "@/lib/format";
import { callLine } from "@/lib/brief";
import { mergeOperating, occupancy, type Merged, type OperatingRow } from "@/lib/operating";
import NoteForm from "./NoteForm";
import OperatingForm from "./OperatingForm";

export const dynamic = "force-dynamic";

const COMPONENT_LABEL: Record<string, [string, number]> = {
  maturity: ["Loan coming due", 35],
  rate_shock: ["Rate shock", 20],
  refi_gap: ["Refinance gap", 20],
  lender: ["Lender pressure", 10],
  owner: ["Owner profile", 15],
};

function Detail({ c, k }: { c: ScoreComponent; k: string }) {
  const parts: string[] = [];
  if (k === "rate_shock" && c.old_rate != null)
    parts.push(`Borrowed at ~${pct(c.old_rate as number)} (${c.old_rate_basis}); today ~${pct(c.new_rate as number)}`);
  if (k === "refi_gap" && c.dscr_at_new_rate != null) {
    parts.push(`Coverage at today's rate ${Number(c.dscr_at_new_rate).toFixed(2)}x on ${money(c.noi as number)} NOI (${c.noi_basis})`);
    if ((c.equity_needed as number) > 0) parts.push(`about ${money(c.equity_needed as number)} of new equity needed to refinance`);
  }
  if (c.why) parts.push(String(c.why));
  return <p className="text-xs text-[#787d85]">{parts.join(". ") || "No signal."}</p>;
}

function Fact({ label, f, show }: { label: string; f?: { source: string; on: string }; show: string | null }) {
  return (
    <>
      <dt className="text-[#787d85]">{label}</dt>
      <dd>
        <span className="num">{show ?? "—"}</span>
        {f && show && <span className="ml-1 text-xs text-[#787d85]">{f.source}, {f.on}</span>}
      </dd>
    </>
  );
}

function OperatingFacts({ m }: { m: Merged }) {
  const occ = occupancy(m);
  const rent = m.rent_current?.value;
  const prior = m.rent_jan_last?.value;
  const growth = rent && prior ? (Number(rent) / Number(prior) - 1) * 100 : null;
  const history = [m.rent_jan_prior, m.rent_jan_last, m.rent_jan_this].map((x) => (x ? money(Number(x.value)) : "—"));
  const sitesSrc = m.total_sites ?? m.vacant_sites ?? m.occupancy_pct;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <Fact label="Lot rent" f={m.rent_current}
            show={rent ? `${money(Number(rent))}/mo${growth != null ? ` (${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs last Jan)` : ""}` : null} />
      <Fact label="Jan 1 rent" f={m.rent_jan_last ?? m.rent_jan_this ?? m.rent_jan_prior}
            show={history.some((h) => h !== "—") ? history.join(" → ") : null} />
      <Fact label="Sites" f={m.total_sites}
            show={m.total_sites ? `${m.total_sites.value}${m.vacant_sites ? `, ${m.vacant_sites.value} vacant` : ""}${m.dev_sites ? `, ${m.dev_sites.value} in development` : ""}` : null} />
      <Fact label="Fill rate" f={sitesSrc} show={occ != null ? `${Math.round(occ * 100)}%` : null} />
      <Fact label="Park-owned homes" f={m.park_owned_homes}
            show={m.park_owned_homes ? `${m.park_owned_homes.value}${m.empty_homes ? `, ${m.empty_homes.value} empty` : ""}` : null} />
      <Fact label="Type" f={m.age_restricted ?? m.rv_share_pct}
            show={[m.age_restricted ? (m.age_restricted.value ? "55+" : "All ages") : null,
                   m.rv_share_pct ? `${Math.round(Number(m.rv_share_pct.value))}% RV` : null,
                   m.year_built ? `built ${m.year_built.value}` : null].filter(Boolean).join(" · ") || null} />
      <Fact label="Land" f={m.land_tenure} show={m.land_tenure ? (m.land_tenure.value === "owned" ? "Owned" : "Leased") : null} />
      <Fact label="Owned since" f={m.owned_since} show={m.owned_since ? String(m.owned_since.value) : null} />
      <Fact label="Amenities" f={m.amenities} show={m.amenities ? String(m.amenities.value) : null} />
    </dl>
  );
}

export default async function ParkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: park }, { data: loans }, { data: docs }, { data: notes }, { data: parcels }, { data: opRows }] = await Promise.all([
    supabase.from("park_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("loans").select("*, lenders(name, kind, cre_concentration), maturity_estimates(*)").eq("park_id", id)
      .order("recording_date", { ascending: false, nullsFirst: false }),
    supabase.from("recorded_documents").select("*").eq("park_id", id).order("recording_date", { ascending: false }),
    supabase.from("activities").select("*").eq("park_id", id).order("created_at", { ascending: false }),
    supabase.from("parcels").select("*").eq("park_id", id),
    supabase.from("park_operating").select("*").eq("park_id", id)
      .order("observed_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (!park) notFound();
  const p = park as ParkRow;
  const comps = p.score_components ?? {};
  const op = mergeOperating((opRows ?? []) as OperatingRow[]);
  const hasOp = Object.keys(op).length > 0;

  return (
    <div className="space-y-4">
      <Link href="/" className="text-xs tracking-wide text-[#787d85] hover:text-[#85152a]">← Prospects</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-sm border border-[#e2e2e2] bg-white p-5">
        <div>
          <p className="text-[10px] font-medium tracking-[0.22em] text-[#85152a]">PARK</p>
          <h1 className="text-2xl font-medium tracking-tight">{p.name}</h1>
          <p className="mt-1 text-[#333539]">
            {[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")} · {KIND_LABEL[p.kind]}
            {p.units ? ` · ${p.units} sites` : ""}
          </p>
          <p className="mt-2">
            <span className="text-[#787d85]">Owner </span>
            <span className="font-medium">{p.owner_name ?? "Unknown"}</span>
            <span className="text-[#787d85]">
              {" "}· {[p.owner_city, p.owner_state].filter(Boolean).join(", ")}
              {p.owner_park_count && p.owner_park_count > 1 ? ` · owns ${p.owner_park_count} parks` : ""}
            </span>
          </p>
          {p.phone && <a className="num mt-1 inline-block text-[#85152a]" href={`tel:${p.phone}`}>{p.phone}</a>}
        </div>
        <div className="text-right">
          <div className={`num inline-block rounded-sm px-3 py-1 text-2xl font-semibold ${scoreTone(p.score)}`}>
            {p.score == null ? "–" : Math.round(p.score)}
          </div>
          <div className="mt-1 text-xs tracking-wide text-[#787d85]">Owner pressure</div>
        </div>
      </div>

      <section className="rounded-sm border border-[#dd9933] bg-[#18191b] p-5 text-white">
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#dd9933]">BEFORE YOU CALL</p>
        <p className="mt-2 max-w-3xl text-base leading-7">{callLine(p)}</p>
        <p className="mt-2 text-xs text-white/60">
          {p.loan_status === "foreclosure"
            ? "The notice is in the county record. Confirm the sale date before you quote a payoff."
            : p.maturity_basis === "estimated"
              ? "The date is a model, not a fact from the note. Confirm it before you quote it."
              : "Use the loan section below if the owner asks for the source."}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-sm border border-[#e2e2e2] bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Why it scores {p.score == null ? "–" : Math.round(p.score)}</h2>
          <div className="space-y-3">
            {Object.entries(COMPONENT_LABEL).map(([k, [label, max]]) => {
              const c = comps[k];
              const pts = c?.points ?? 0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <span className="num text-[#333539]">{Math.round(pts)} / {max}</span>
                  </div>
                  <div className="my-1 h-1.5 rounded bg-[#f4f4f4]">
                    <div className="h-1.5 rounded bg-[#85152a]" style={{ width: `${(pts / max) * 100}%` }} />
                  </div>
                  {c && <Detail c={c} k={k} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-sm border border-[#e2e2e2] bg-white p-4">
          <h2 className="mb-3 font-semibold">Next maturity</h2>
          <div className="num text-2xl font-semibold">{monthYear(p.maturity_date)}</div>
          <p className="text-[#333539]">{p.maturity_basis ? BASIS_LABEL[p.maturity_basis] : "No loan found"}</p>
          {p.loan_status === "foreclosure" && (
            <p className="mt-2 rounded bg-[#f8e7ea] px-2 py-1 text-[#85152a]">A trustee sale notice or lis pendens has been recorded.</p>
          )}
          {p.maturity_basis === "estimated" && p.p10_date && (
            <p className="mt-1 text-xs text-[#787d85]">Likely range {monthYear(p.p10_date)} to {monthYear(p.p90_date)}</p>
          )}
          {p.maturity_explanation && <p className="mt-2 text-xs text-[#787d85]">{p.maturity_explanation}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-[#787d85]">Lender</dt>
            <dd>{p.lender_name ?? p.lender_name_raw ?? "—"}</dd>
            <dt className="text-[#787d85]">Type</dt>
            <dd>{p.lender_kind ? LENDER_LABEL[p.lender_kind] : "—"}</dd>
            <dt className="text-[#787d85]">Balance</dt>
            <dd className="num">{money(p.current_balance ?? p.original_amount)}</dd>
            <dt className="text-[#787d85]">Rate</dt>
            <dd className="num">{pct(p.note_rate)}</dd>
          </dl>
        </section>
      </div>

      <section className="rounded-sm border border-[#e2e2e2] bg-white p-4">
        <h2 className="mb-1 font-semibold">Operating figures</h2>
        <p className="mb-3 text-xs text-[#787d85]">
          {hasOp
            ? "Rent and occupancy here replace the statewide estimate in the refinance gap."
            : `None yet. The refinance gap assumes ${p.state} market lot rent and 90% occupancy until rent and vacancy are entered.`}
        </p>
        {hasOp && <OperatingFacts m={op} />}
        <details className="mt-3">
          <summary className="cursor-pointer text-[#85152a]">{hasOp ? "Update figures" : "Enter figures"}</summary>
          <div className="mt-3"><OperatingForm parkId={p.id} /></div>
        </details>
      </section>

      <section className="rounded-sm border border-[#e2e2e2] bg-white">
        <h2 className="border-b border-[#e2e2e2] px-4 py-3 font-semibold">Loan history</h2>
        <table className="w-full">
          <thead className="bg-[#f7f7f8] text-left text-xs text-[#787d85]">
            <tr>
              <th className="px-4 py-2 font-medium">Recorded</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Lender</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Maturity</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(loans ?? []).map((l) => {
              const est = Array.isArray(l.maturity_estimates) ? l.maturity_estimates[0] : l.maturity_estimates;
              return (
                <tr key={l.id} className="border-t border-[#f4f4f4]">
                  <td className="num px-4 py-2">{l.recording_date ?? l.origination_date ?? "—"}</td>
                  <td className="px-4 py-2 uppercase text-[#787d85]">{l.source}</td>
                  <td className="px-4 py-2">{l.lenders?.name ?? l.lender_name_raw ?? "—"}</td>
                  <td className="num px-4 py-2 text-right">{money(l.current_balance ?? l.original_amount)}</td>
                  <td className="num px-4 py-2">
                    {monthYear(l.maturity_date ?? est?.likely_date ?? est?.p50_date)}{" "}
                    <span className="text-xs text-[#787d85]">
                      {BASIS_LABEL[l.maturity_date ? l.maturity_basis : est?.basis ?? "unknown"]}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">{l.status}</td>
                </tr>
              );
            })}
            {!loans?.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#787d85]">No recorded loans found. The park may be owned free and clear.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-[#e2e2e2] bg-white p-4">
          <h2 className="mb-3 font-semibold">Call notes</h2>
          <NoteForm parkId={p.id} />
          <ul className="mt-4 space-y-3">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="border-t border-[#f4f4f4] pt-3">
                <div className="text-xs text-[#787d85]">
                  {new Date(n.created_at).toLocaleDateString()} · {n.author_name ?? "Team"} · {n.outcome?.replace("_", " ") ?? n.kind}
                  {n.next_follow_up ? ` · follow up ${n.next_follow_up}` : ""}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                {n.extracted?.motivation && <p className="mt-1 text-xs text-[#787d85]">Motivation: {n.extracted.motivation}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-sm border border-[#e2e2e2] bg-white p-4">
          <h2 className="mb-3 font-semibold">Recorded documents</h2>
          <ul className="space-y-2">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex justify-between gap-3 border-t border-[#f4f4f4] pt-2">
                <div>
                  <div className="capitalize">{d.doc_type.replaceAll("_", " ")}</div>
                  <div className="text-xs text-[#787d85]">
                    {d.county} #{d.recording_number}
                    {d.extracted?.maturity_date ? ` · states maturity ${d.extracted.maturity_date}` : ""}
                  </div>
                </div>
                <div className="num text-right">
                  <div>{d.recording_date}</div>
                  {d.pdf_url && <a className="text-xs text-[#787d85] underline" href={d.pdf_url} target="_blank">View</a>}
                </div>
              </li>
            ))}
            {!docs?.length && <li className="text-[#787d85]">None yet.</li>}
          </ul>
          {!!parcels?.length && (
            <p className="mt-4 text-xs text-[#787d85]">
              Parcels: {parcels.map((x) => `${x.apn} (${x.county})`).join(", ")}
              {parcels[0].last_sale_date ? ` · last sold ${parcels[0].last_sale_date}` : ""}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
