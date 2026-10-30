import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { BASIS_LABEL, KIND_LABEL, LENDER_LABEL, type ParkRow, type ScoreComponent } from "@/lib/types";
import { money, monthYear, pct } from "@/lib/format";
import { callLine } from "@/lib/brief";
import { mergeOperating, occupancy, type Merged, type OperatingRow } from "@/lib/operating";
import { Tabs } from "@/components/ui/Bits";
import { ScorePill } from "@/components/ui/ScorePill";
import { PrintButton } from "@/components/ui/PrintButton";
import { OutreachDraft } from "@/components/ui/OutreachDraft";
import { outreachDraft } from "@/lib/outreach";
import { verifyHref } from "@/lib/verify";
import NoteForm from "./NoteForm";
import OperatingForm from "./OperatingForm";
import DeskActions from "./DeskActions";
import UnderwritingDesk from "./UnderwritingDesk";

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
  return <p className="text-xs text-muted">{parts.join(". ") || "No signal."}</p>;
}

function Fact({ label, f, show }: { label: string; f?: { source: string; on: string }; show: string | null }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>
        <span className="num">{show ?? "—"}</span>
        {f && show && <span className="ml-1 text-xs text-muted">{f.source}, {f.on}</span>}
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
  const [{ data: park }, { data: loans }, { data: docs }, { data: notes }, { data: parcels }, { data: opRows },
    { data: savedCase }, { data: deal }] = await Promise.all([
    supabase.from("park_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("loans").select("*, lenders(name, kind, cre_concentration), maturity_estimates(*)").eq("park_id", id)
      .order("recording_date", { ascending: false, nullsFirst: false }),
    supabase.from("recorded_documents").select("*").eq("park_id", id).order("recording_date", { ascending: false }),
    supabase.from("activities").select("*").eq("park_id", id).order("created_at", { ascending: false }),
    supabase.from("parcels").select("*").eq("park_id", id),
    supabase.from("park_operating").select("*").eq("park_id", id)
      .order("observed_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("underwriting").select("*").eq("park_id", id).maybeSingle(),
    supabase.from("deals").select("*").eq("park_id", id).maybeSingle(),
  ]);
  if (!park) notFound();
  const p = park as ParkRow;
  const comps = p.score_components ?? {};
  const op = mergeOperating((opRows ?? []) as OperatingRow[]);
  const hasOp = Object.keys(op).length > 0;
  const sold = ((parcels ?? []) as { last_sale_price?: number | null; last_sale_date?: string | null }[])
    .filter((x) => x.last_sale_price)
    .sort((a, b) => String(b.last_sale_date ?? "").localeCompare(String(a.last_sale_date ?? "")))[0];
  const { data: water } = await supabase.from("water_systems").select("*").eq("park_id", id);

  return (
    <div className="space-y-4">
      <Link href="/" className="text-xs tracking-wide text-muted hover:text-accent">← Prospects</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-sm border border-line bg-panel p-5">
        <div>
          <p className="text-2xs font-medium tracking-wide text-accent">PARK</p>
          <h1 className="text-2xl font-medium tracking-tight">{p.name}</h1>
          <p className="mt-1 text-body">
            {[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")} · {KIND_LABEL[p.kind]}
            {p.units ? ` · ${p.units} sites` : ""}
          </p>
          <p className="mt-2">
            <span className="text-muted">Owner </span>
            {p.owner_id ? (
              <Link href={`/owners/${p.owner_id}`} className="font-medium hover:text-accent">{p.owner_name ?? "Unknown"}</Link>
            ) : (
              <span className="font-medium">{p.owner_name ?? "Unknown"}</span>
            )}
            <span className="text-muted">
              {" "}· {[p.owner_city, p.owner_state].filter(Boolean).join(", ")}
              {p.owner_park_count && p.owner_park_count > 1 ? ` · owns ${p.owner_park_count} parks` : ""}
            </span>
          </p>
          {p.phone && <a className="num mt-1 inline-block text-accent" href={`tel:${p.phone}`}>{p.phone}</a>}
          {(p.email || p.owner_email) && (
            <a className="mt-1 block text-sm text-accent" href={`mailto:${p.email || p.owner_email}`}>{p.email || p.owner_email}</a>
          )}
          {p.flood_zone && <p className="mt-1 text-xs text-muted">FEMA flood zone {p.flood_zone}</p>}
          {(water ?? []).map((w) => (
            <p key={w.pws_id} className="mt-1 text-xs text-muted">
              EPA water system {w.name} ({w.pws_id})
              {w.serious_violator ? " · serious violator" : ""}
              {w.qtrs_with_violations ? ` · violations in ${w.qtrs_with_violations} recent quarters` : " · no recent violation quarters on the ECHO row"}
            </p>
          ))}
        </div>
        <div className="flex items-start gap-3">
          <PrintButton />
          <div className="text-right">
            <ScorePill score={p.score} />
            <div className="mt-1 text-xs text-muted">Owner pressure</div>
          </div>
        </div>
      </div>

      <section className="rounded-sm border border-gold bg-inverse p-5 text-on-inverse">
        <p className="text-xs font-medium tracking-wide text-gold">Before you call</p>
        <p className="mt-2 max-w-3xl text-base leading-7">{callLine(p)}</p>
        <p className="mt-2 text-xs text-on-inverse/70">
          {p.loan_status === "foreclosure"
            ? "The notice is in the county record. Confirm the sale date before you quote a payoff."
            : p.maturity_basis === "estimated"
              ? "The date is a model, not a fact from the note. Confirm it before you quote it."
              : "Use the loan section below if the owner asks for the source."}
        </p>
      </section>

      <DeskActions parkId={p.id} stage={deal?.stage ?? null} nextAction={deal?.next_action ?? null} managed={!!p.managed} />

      <OutreachDraft {...outreachDraft(p)} />

      <Tabs tabs={[
        { id: "overview", label: "Overview", content: <div className="space-y-4">
      {comps.fit && (
        <section className="rounded-sm border border-line bg-panel p-4">
          <h2 className="font-semibold">Acquisition fit {Math.round(Number(comps.fit.points ?? 0))}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {((comps.fit.parts as { key: string; points: number; max: number; why: string }[] | undefined) ?? []).map((part) => (
              <li key={part.key} className="flex justify-between gap-4">
                <span>{part.why}</span>
                <span className="num shrink-0 text-muted">{part.points}/{part.max}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-sm border border-line bg-panel p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Why it scores {p.score == null ? "–" : Math.round(p.score)}</h2>
          <div className="space-y-3">
            {Object.entries(COMPONENT_LABEL).map(([k, [label, max]]) => {
              const c = comps[k];
              const pts = c?.points ?? 0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <span className="num text-body">{Math.round(pts)} / {max}</span>
                  </div>
                  <div className="my-1 h-1.5 rounded bg-sunken">
                    <div className="h-1.5 rounded bg-accent" style={{ width: `${(pts / max) * 100}%` }} />
                  </div>
                  {c && <Detail c={c} k={k} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-sm border border-line bg-panel p-4">
          <h2 className="mb-3 font-semibold">Next maturity</h2>
          <div className="num text-2xl font-semibold">{monthYear(p.maturity_date)}</div>
          <p className="text-body">{p.maturity_basis ? BASIS_LABEL[p.maturity_basis] : "No loan found"}</p>
          {p.loan_status === "foreclosure" && (
            <p className="mt-2 rounded bg-negative-soft px-2 py-1 text-accent">A trustee sale notice or lis pendens has been recorded.</p>
          )}
          {p.maturity_basis === "estimated" && p.p10_date && (
            <p className="mt-1 text-xs text-muted">Likely range {monthYear(p.p10_date)} to {monthYear(p.p90_date)}</p>
          )}
          {p.maturity_explanation && <p className="mt-2 text-xs text-muted">{p.maturity_explanation}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Lender</dt>
            <dd>{p.lender_name ?? p.lender_name_raw ?? "—"}</dd>
            <dt className="text-muted">Type</dt>
            <dd>{p.lender_kind ? LENDER_LABEL[p.lender_kind] : "—"}</dd>
            <dt className="text-muted">Balance</dt>
            <dd className="num">{money(p.current_balance ?? p.original_amount)}</dd>
            <dt className="text-muted">Rate</dt>
            <dd className="num">{pct(p.note_rate)}</dd>
          </dl>
        </section>
      </div>

      <section className="rounded-sm border border-line bg-panel p-4">
        <h2 className="mb-1 font-semibold">Operating figures</h2>
        <p className="mb-3 text-xs text-muted">
          {hasOp
            ? "Rent and occupancy here replace the statewide estimate in the refinance gap."
            : `None yet. The refinance gap assumes ${p.state} market lot rent and 90% occupancy until rent and vacancy are entered.`}
        </p>
        {hasOp && <OperatingFacts m={op} />}
        <details className="mt-3">
          <summary className="cursor-pointer text-accent">{hasOp ? "Update figures" : "Enter figures"}</summary>
          <div className="mt-3"><OperatingForm parkId={p.id} /></div>
        </details>
      </section>

        </div> },
        { id: "debt", label: "Debt", content: <>
      <section className="rounded-sm border border-line bg-panel">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Loan history</h2>
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
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
                <tr key={l.id} className="border-t border-line">
                  <td className="num px-4 py-2">{l.recording_date ?? l.origination_date ?? "—"}</td>
                  <td className="px-4 py-2 uppercase text-muted">{l.source}</td>
                  <td className="px-4 py-2">{l.lenders?.name ?? l.lender_name_raw ?? "—"}</td>
                  <td className="num px-4 py-2 text-right">{money(l.current_balance ?? l.original_amount)}</td>
                  <td className="num px-4 py-2">
                    {monthYear(l.maturity_date ?? est?.likely_date ?? est?.p50_date)}{" "}
                    <span className="text-xs text-muted">
                      {BASIS_LABEL[l.maturity_date ? l.maturity_basis : est?.basis ?? "unknown"]}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">
                    {l.status}
                    {l.payment_status ? ` · ${l.payment_status}` : ""}
                    {l.noi_current ? ` · NOI ${money(Number(l.noi_current))}` : ""}
                    {l.raw?.modified ? " · modified" : ""}
                  </td>
                </tr>
              );
            })}
            {!loans?.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No recorded loans found. The park may be owned free and clear.</td></tr>
            )}
          </tbody>
        </table>
      </section>

        </> },
        { id: "underwriting", label: "Underwriting", content: (
          <UnderwritingDesk
            parkId={p.id}
            parkName={p.name}
            city={p.city}
            saved={savedCase as { price?: number | null; cap_rate?: number | null; lot_rent?: number | null; occupancy_pct?: number | null; expense_pct?: number | null; rent_growth?: number | null; sites?: number | null } | null}
            sites={p.units}
            lotRent={op.rent_current ? Number(op.rent_current.value) : null}
            occupancyPct={occupancy(op) != null ? Math.round((occupancy(op) as number) * 100) : null}
            modelRate={comps.rate_shock?.new_rate != null ? Number(comps.rate_shock.new_rate) : null}
            spreadBasis={comps.rate_shock?.spread_basis != null ? String(comps.rate_shock.spread_basis) : null}
            noteRate={p.note_rate}
          />
        ) },
        { id: "comps", label: "Comps", content: (
          <section className="rounded-md border border-line bg-panel p-4 text-sm">
            {sold ? (
              <p className="num">Last assessor sale {sold.last_sale_date ?? "—"} for {money(Number(sold.last_sale_price))}{p.units ? ` · ${money(Number(sold.last_sale_price) / p.units)} per site` : ""}. This is the roll price, not a closed-deal comp.</p>
            ) : <p className="text-muted">No assessor sale price is on the parcels linked to this park.</p>}
          </section>
        ) },
        { id: "owner", label: "Owner", content: (
          <section className="rounded-md border border-line bg-panel p-4 text-sm">
            <p>{p.owner_name ?? "No owner name on the record."}</p>
            <p className="text-muted">{[p.owner_city, p.owner_state].filter(Boolean).join(", ")}{p.owner_entity_type ? ` · ${p.owner_entity_type}` : ""}{p.owner_park_count && p.owner_park_count > 1 ? ` · ${p.owner_park_count} parks on this desk` : ""}</p>
            {p.owner_id && <Link href={`/owners/${p.owner_id}`} className="mt-2 inline-block text-accent">Owner dossier</Link>}
          </section>
        ) },
        { id: "records", label: "Documents and activity", content: <>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-line bg-panel p-4">
          <h2 className="mb-3 font-semibold">Call notes</h2>
          <NoteForm parkId={p.id} />
          <ul className="mt-4 space-y-3">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="border-t border-line pt-3">
                <div className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleDateString()} · {n.author_name ?? "Team"} · {n.outcome?.replace("_", " ") ?? n.kind}
                  {n.next_follow_up ? ` · follow up ${n.next_follow_up}` : ""}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                {n.extracted?.motivation && <p className="mt-1 text-xs text-muted">Motivation: {n.extracted.motivation}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-sm border border-line bg-panel p-4">
          <h2 className="mb-3 font-semibold">Recorded documents</h2>
          <ul className="space-y-2">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex justify-between gap-3 border-t border-line pt-2">
                <div>
                  <div className="capitalize">{d.doc_type.replaceAll("_", " ")}</div>
                  <div className="text-xs text-muted">
                    {d.county} #{d.recording_number}
                    {d.extracted?.maturity_date ? ` · states maturity ${d.extracted.maturity_date}` : ""}
                  </div>
                </div>
                <div className="num text-right">
                  <div>{d.recording_date}</div>
                  {d.pdf_url && <a className="text-xs text-muted underline" href={d.pdf_url} target="_blank">View</a>}
                  {d.county === "maricopa" && verifyHref(`mcrec:${d.recording_number}`) && (
                    <a className="block text-xs text-accent" href={verifyHref(`mcrec:${d.recording_number}`) ?? undefined} target="_blank" rel="noreferrer">Recorder</a>
                  )}
                </div>
              </li>
            ))}
            {!docs?.length && <li className="text-muted">None yet.</li>}
          </ul>
          {(docs ?? []).filter((d) => d.pdf_url).slice(0, 1).map((d) => (
            <iframe key={d.id} title={d.doc_type} src={d.pdf_url} className="mt-3 h-96 w-full rounded-sm border border-line" />
          ))}
          {!!parcels?.length && (
            <p className="mt-4 text-xs text-muted">
              Parcels: {parcels.map((x) => `${x.apn} (${x.county})`).join(", ")}
              {sold ? ` · last sold ${sold.last_sale_date ?? ""} for ${money(Number(sold.last_sale_price))}` : ""}
              {sold && p.units ? ` · ${money(Number(sold.last_sale_price) / p.units)} per site` : ""}
              {sold ? " · assessor sale price" : parcels[0].last_sale_date ? ` · last sold ${parcels[0].last_sale_date}` : ""}
            </p>
          )}
        </section>
      </div>
        </> },
      ]} />
    </div>
  );
}
