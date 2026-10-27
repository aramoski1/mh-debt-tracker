import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { BASIS_LABEL, KIND_LABEL, LENDER_LABEL, type ParkRow, type ScoreComponent } from "@/lib/types";
import { money, monthYear, pct, scoreTone } from "@/lib/format";
import NoteForm from "./NoteForm";

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
  return <p className="text-xs text-stone-500">{parts.join(". ") || "No signal."}</p>;
}

export default async function ParkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: park }, { data: loans }, { data: docs }, { data: notes }, { data: parcels }] = await Promise.all([
    supabase.from("park_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("loans").select("*, lenders(name, kind, cre_concentration), maturity_estimates(*)").eq("park_id", id)
      .order("recording_date", { ascending: false, nullsFirst: false }),
    supabase.from("recorded_documents").select("*").eq("park_id", id).order("recording_date", { ascending: false }),
    supabase.from("activities").select("*").eq("park_id", id).order("created_at", { ascending: false }),
    supabase.from("parcels").select("*").eq("park_id", id),
  ]);
  if (!park) notFound();
  const p = park as ParkRow;
  const comps = p.score_components ?? {};

  return (
    <div className="space-y-4">
      <Link href="/" className="text-stone-500 hover:text-stone-900">← Prospects</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded border border-stone-200 bg-white p-4">
        <div>
          <h1 className="text-xl font-semibold">{p.name}</h1>
          <p className="text-stone-600">
            {[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")} · {KIND_LABEL[p.kind]}
            {p.units ? ` · ${p.units} sites` : ""}
          </p>
          <p className="mt-2">
            <span className="text-stone-500">Owner </span>
            <span className="font-medium">{p.owner_name ?? "Unknown"}</span>
            <span className="text-stone-500">
              {" "}· {[p.owner_city, p.owner_state].filter(Boolean).join(", ")}
              {p.owner_park_count && p.owner_park_count > 1 ? ` · owns ${p.owner_park_count} parks` : ""}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div className={`num inline-block rounded px-3 py-1 text-2xl font-semibold ${scoreTone(p.score)}`}>
            {p.score == null ? "–" : Math.round(p.score)}
          </div>
          <div className="mt-1 text-xs text-stone-500">Owner pressure score</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded border border-stone-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Why it scores {p.score == null ? "–" : Math.round(p.score)}</h2>
          <div className="space-y-3">
            {Object.entries(COMPONENT_LABEL).map(([k, [label, max]]) => {
              const c = comps[k];
              const pts = c?.points ?? 0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <span className="num text-stone-600">{Math.round(pts)} / {max}</span>
                  </div>
                  <div className="my-1 h-1.5 rounded bg-stone-100">
                    <div className="h-1.5 rounded bg-stone-800" style={{ width: `${(pts / max) * 100}%` }} />
                  </div>
                  {c && <Detail c={c} k={k} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded border border-stone-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Next maturity</h2>
          <div className="num text-2xl font-semibold">{monthYear(p.maturity_date)}</div>
          <p className="text-stone-600">{p.maturity_basis ? BASIS_LABEL[p.maturity_basis] : "No loan found"}</p>
          {p.loan_status === "foreclosure" && (
            <p className="mt-2 rounded bg-red-50 px-2 py-1 text-red-800">A trustee sale notice or lis pendens has been recorded.</p>
          )}
          {p.maturity_basis === "estimated" && p.p10_date && (
            <p className="mt-1 text-xs text-stone-500">Likely range {monthYear(p.p10_date)} to {monthYear(p.p90_date)}</p>
          )}
          {p.maturity_explanation && <p className="mt-2 text-xs text-stone-500">{p.maturity_explanation}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-stone-500">Lender</dt>
            <dd>{p.lender_name ?? p.lender_name_raw ?? "—"}</dd>
            <dt className="text-stone-500">Type</dt>
            <dd>{p.lender_kind ? LENDER_LABEL[p.lender_kind] : "—"}</dd>
            <dt className="text-stone-500">Balance</dt>
            <dd className="num">{money(p.current_balance ?? p.original_amount)}</dd>
            <dt className="text-stone-500">Rate</dt>
            <dd className="num">{pct(p.note_rate)}</dd>
          </dl>
        </section>
      </div>

      <section className="rounded border border-stone-200 bg-white">
        <h2 className="border-b border-stone-200 px-4 py-3 font-semibold">Loan history</h2>
        <table className="w-full">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
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
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="num px-4 py-2">{l.recording_date ?? l.origination_date ?? "—"}</td>
                  <td className="px-4 py-2 uppercase text-stone-500">{l.source}</td>
                  <td className="px-4 py-2">{l.lenders?.name ?? l.lender_name_raw ?? "—"}</td>
                  <td className="num px-4 py-2 text-right">{money(l.current_balance ?? l.original_amount)}</td>
                  <td className="num px-4 py-2">
                    {monthYear(l.maturity_date ?? est?.likely_date ?? est?.p50_date)}{" "}
                    <span className="text-xs text-stone-500">
                      {BASIS_LABEL[l.maturity_date ? l.maturity_basis : est?.basis ?? "unknown"]}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">{l.status}</td>
                </tr>
              );
            })}
            {!loans?.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-500">No recorded loans found. The park may be owned free and clear.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-stone-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Call notes</h2>
          <NoteForm parkId={p.id} />
          <ul className="mt-4 space-y-3">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="border-t border-stone-100 pt-3">
                <div className="text-xs text-stone-500">
                  {new Date(n.created_at).toLocaleDateString()} · {n.author_name ?? "Team"} · {n.outcome?.replace("_", " ") ?? n.kind}
                  {n.next_follow_up ? ` · follow up ${n.next_follow_up}` : ""}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                {n.extracted?.motivation && <p className="mt-1 text-xs text-stone-500">Motivation: {n.extracted.motivation}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-stone-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Recorded documents</h2>
          <ul className="space-y-2">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex justify-between gap-3 border-t border-stone-100 pt-2">
                <div>
                  <div className="capitalize">{d.doc_type.replaceAll("_", " ")}</div>
                  <div className="text-xs text-stone-500">
                    {d.county} #{d.recording_number}
                    {d.extracted?.maturity_date ? ` · states maturity ${d.extracted.maturity_date}` : ""}
                  </div>
                </div>
                <div className="num text-right">
                  <div>{d.recording_date}</div>
                  {d.pdf_url && <a className="text-xs text-stone-500 underline" href={d.pdf_url} target="_blank">View</a>}
                </div>
              </li>
            ))}
            {!docs?.length && <li className="text-stone-500">None yet.</li>}
          </ul>
          {!!parcels?.length && (
            <p className="mt-4 text-xs text-stone-500">
              Parcels: {parcels.map((x) => `${x.apn} (${x.county})`).join(", ")}
              {parcels[0].last_sale_date ? ` · last sold ${parcels[0].last_sale_date}` : ""}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
