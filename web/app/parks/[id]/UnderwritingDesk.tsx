"use client";

import { useMemo, useState } from "react";
import { money, pct, ratio } from "@/lib/format";
import { payment, scenario } from "@/lib/underwrite";

type Saved = {
  price?: number | null;
  cap_rate?: number | null;
  lot_rent?: number | null;
  occupancy_pct?: number | null;
  expense_pct?: number | null;
  rent_growth?: number | null;
  sites?: number | null;
};

const CASES = [
  ["bank", "New bank loan"],
  ["agency", "New agency loan"],
  ["assume", "Assume the note"],
  ["seller", "Seller financing"],
] as const;

export default function UnderwritingDesk({
  parkId, parkName, city, saved, sites, lotRent, occupancyPct, modelRate, spreadBasis, noteRate,
}: {
  parkId: string;
  parkName: string;
  city: string | null;
  saved: Saved | null;
  sites: number | null;
  lotRent: number | null;
  occupancyPct: number | null;
  modelRate: number | null;
  spreadBasis: string | null;
  noteRate: number | null;
}) {
  const [price, setPrice] = useState(saved?.price ?? "");
  const [cap, setCap] = useState(saved?.cap_rate ?? "");
  const [rent, setRent] = useState(saved?.lot_rent ?? lotRent ?? "");
  const [occ, setOcc] = useState(saved?.occupancy_pct ?? occupancyPct ?? "");
  const [expense, setExpense] = useState(saved?.expense_pct ?? "");
  const [growth, setGrowth] = useState(saved?.rent_growth ?? "");
  const [nSites, setSites] = useState(saved?.sites ?? sites ?? "");
  const [rates, setRates] = useState<Record<string, string>>({
    bank: "", agency: "", assume: noteRate != null ? String(noteRate) : "", seller: "",
  });
  const [which, setWhich] = useState<(typeof CASES)[number][0]>("bank");
  const [msg, setMsg] = useState<string | null>(null);

  const results = useMemo(() => {
    const parsed = {
      price: Number(price), sites: Number(nSites), lotRent: Number(rent),
      occupancy: Number(occ) / 100, expense: Number(expense) / 100,
      capRate: Number(cap), growth: Number(growth) / 100,
    };
    return Object.fromEntries(CASES.map(([k]) => {
      const rate = Number(rates[k]);
      return [k, rate ? scenario({ ...parsed, rate }) : null];
    }));
  }, [price, nSites, rent, occ, expense, cap, growth, rates]);

  const save = async () => {
    setMsg(null);
    const res = await fetch("/api/underwriting", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parkId, price, capRate: cap, lotRent: rent, occupancyPct: occ,
        expensePct: expense, rentGrowth: growth, sites: nSites,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Saved on this park." : j.error || "Could not save.");
  };

  const active = results[which];
  const letter = active && active.ok
    ? [
        `${parkName}${city ? `, ${city}` : ""}`,
        "",
        `We would buy the park for ${money(Number(price))}. That price is the figure entered on this page, not an appraisal.`,
        `At ${nSites} sites, ${money(Number(rent))} lot rent, ${occ}% occupancy and ${expense}% expenses, year-1 NOI is ${money(active.noi)}.`,
        `The ${CASES.find(([k]) => k === which)?.[1].toLowerCase()} case uses ${pct(Number(rates[which]))}. The loan amount is ${money(active.loan)}, set by the ${active.binding === "ltv" ? "75% loan-to-value cap" : "1.25 debt-service test"}.`,
        `Cash-on-cash on those inputs is ${active.cashOnCash}%. The year-5 IRR, selling at the same ${cap}% cap rate, is ${active.irr == null ? "not computed" : `${active.irr}%`}.`,
        "",
        "This draft is for review inside Cooper Cardinal. It has not been sent.",
      ].join("\n")
    : "Enter a price, cap rate, rent, occupancy, expenses, growth, and a rate. The draft uses only those figures.";

  const field = (label: string, value: string | number, set: (v: string) => void, step = "0.1") => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input value={value} step={step} onChange={(e) => set(e.target.value)}
             className="num h-8 rounded-sm border border-line px-2" />
    </label>
  );

  return (
    <section className="rounded-sm border border-line bg-panel p-4">
      <h2 className="font-semibold">Acquisition case</h2>
      <p className="mb-3 mt-1 text-xs text-muted">
        {modelRate != null
          ? `The pressure score is using ${pct(modelRate)} (${spreadBasis === "measured" ? "a measured spread" : "an assumed spread"}). Type the rate you want to underwrite.`
          : "Type the rate you want to underwrite."}
        {lotRent != null ? " Lot rent starts from the operating figures saved on this park." : " Lot rent stays blank until you enter it."}
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        {field("Price", price, setPrice, "1000")}
        {field("Cap rate %", cap, setCap)}
        {field("Sites", nSites, setSites, "1")}
        {field("Lot rent / month", rent, setRent, "1")}
        {field("Occupancy %", occ, setOcc)}
        {field("Expenses %", expense, setExpense)}
        {field("Rent growth % / year", growth, setGrowth)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {CASES.map(([k, label]) => (
          <label key={k} className={`flex flex-col gap-1 rounded-sm border p-2 ${which === k ? "border-accent" : "border-line"}`}>
            <span className="text-xs text-muted">{label}</span>
            <input value={rates[k]} placeholder="Rate %" onChange={(e) => setRates({ ...rates, [k]: e.target.value })}
                   onFocus={() => setWhich(k)} className="num h-8 rounded-sm border border-line px-2" />
            <span className="num text-xs text-body">
              {results[k]?.ok ? `${results[k]!.cashOnCash}% cash-on-cash · IRR ${results[k]!.irr ?? "—"}%` : "—"}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} className="rounded-sm bg-accent px-3 py-1.5 text-on-accent">Save case</button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
      {active?.ok && (
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Price", money(Number(price))],
            ["Cap rate", pct(Number(cap), 1)],
            ["Cash-on-cash", pct(active.cashOnCash, 1)],
            ["DSCR", ratio(active.noi && Number(rates[which]) ? (active.noi as number) / (payment(active.loan as number, Number(rates[which]), 30) * 12) : null)],
            ["Equity", money(active.equity)],
            ["5-year IRR", active.irr == null ? "—" : pct(active.irr, 1)],
          ].map(([label, value]) => (
            <div key={label} className="bg-panel px-3 py-2">
              <p className="text-xs text-muted">{label}</p>
              <p className="num text-base font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}
      {active?.ok && (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-xs text-muted">IRR by note rate and exit cap. Same rent, occupancy, expenses, and growth as the inputs above.</p>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs text-muted">Rate \ cap</th>
                {[6, 7, 8, 9].map((capStep) => <th key={capStep} className="px-2 py-1 text-right text-xs text-muted">{capStep.toFixed(1)}%</th>)}
              </tr>
            </thead>
            <tbody>
              {[5, 6, 7, 8].map((rateStep) => (
                <tr key={rateStep} className="border-t border-line">
                  <th className="px-2 py-1 text-left font-medium">{rateStep.toFixed(2)}%</th>
                  {[6, 7, 8, 9].map((capStep) => {
                    const cell = scenario({
                      price: Number(price), sites: Number(nSites), lotRent: Number(rent),
                      occupancy: Number(occ) / 100, expense: Number(expense) / 100,
                      capRate: capStep, growth: Number(growth) / 100, rate: rateStep,
                    });
                    return <td key={capStep} className="num px-2 py-1 text-right">{cell.ok && cell.irr != null ? pct(cell.irr, 1) : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-sm font-semibold">Draft for review</h3>
        <textarea readOnly value={letter} rows={8} className="mt-2 w-full rounded-sm border border-line p-2 text-sm" />
      </div>
    </section>
  );
}
