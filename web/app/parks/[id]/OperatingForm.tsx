"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Rent, sites and vacancy from a rent survey, a broker package or the owner. Blank fields keep earlier values.
const NUMBERS: [string, string][] = [
  ["rent_current", "Lot rent today ($/mo)"],
  ["rent_jan_this", "Rent Jan 1 this year"],
  ["rent_jan_last", "Rent Jan 1 last year"],
  ["rent_jan_prior", "Rent Jan 1 year before"],
  ["total_sites", "Total sites"],
  ["vacant_sites", "Vacant sites"],
  ["dev_sites", "Under development"],
  ["park_owned_homes", "Park-owned homes"],
  ["empty_homes", "Empty homes"],
  ["occupancy_pct", "Occupancy % (if stated)"],
  ["rv_share_pct", "RV sites %"],
  ["year_built", "Year built"],
];

export default function OperatingForm({ parkId }: { parkId: string }) {
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/operating", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, ...v }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Could not save." });
      return;
    }
    setV({});
    setMsg({ ok: true, text: "Saved. The score and refinance gap update on the next model run." });
    router.refresh();
  }

  const input = "w-full rounded-sm border border-[#e2e2e2] px-2 py-1";
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        {NUMBERS.map(([k, label]) => (
          <label key={k} className="text-xs text-[#787d85]">
            {label}
            <input inputMode="decimal" value={v[k] ?? ""} onChange={set(k)} className={`num ${input} text-sm text-[#18191b]`} />
          </label>
        ))}
        <label className="text-xs text-[#787d85]">
          Age restriction
          <select value={v.age_restricted ?? ""} onChange={set("age_restricted")} className={`${input} text-sm text-[#18191b]`}>
            <option value="">—</option>
            <option value="55plus">55+</option>
            <option value="all">All ages</option>
          </select>
        </label>
        <label className="text-xs text-[#787d85]">
          Land
          <select value={v.land_tenure ?? ""} onChange={set("land_tenure")} className={`${input} text-sm text-[#18191b]`}>
            <option value="">—</option>
            <option value="owned">Owned</option>
            <option value="leased">Leased</option>
          </select>
        </label>
        <label className="text-xs text-[#787d85]">
          Owned since
          <input type="date" value={v.owned_since ?? ""} onChange={set("owned_since")} className={`${input} text-sm text-[#18191b]`} />
        </label>
        <label className="text-xs text-[#787d85]">
          Figures as of
          <input type="date" value={v.observed_on ?? ""} onChange={set("observed_on")} className={`${input} text-sm text-[#18191b]`} />
        </label>
      </div>
      <label className="block text-xs text-[#787d85]">
        Amenities and home mix (call prep, not scored)
        <textarea rows={2} value={v.amenities ?? ""} onChange={set("amenities")} className={`${input} text-sm text-[#18191b]`}
                  placeholder="Pool, clubhouse, paved streets; homes mostly 1990s singlewides" />
      </label>
      <label className="block text-xs text-[#787d85]">
        Where these figures came from
        <input value={v.notes ?? ""} onChange={set("notes")} className={`${input} text-sm text-[#18191b]`}
               placeholder="e.g. owner on the phone, 10/29" />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-sm bg-[#85152a] px-3 py-1.5 font-medium text-white hover:bg-[#6e1023] disabled:opacity-50">
          {busy ? "Saving…" : "Save figures"}
        </button>
        {msg && <span className={msg.ok ? "text-xs text-[#787d85]" : "text-red-700"}>{msg.text}</span>}
      </div>
    </form>
  );
}
