"use client";

import { useState } from "react";

const STAGES = [
  ["target", "Target"],
  ["contacted", "Contacted"],
  ["loi", "LOI"],
  ["under_contract", "Under contract"],
  ["closed", "Closed"],
  ["passed", "Passed"],
];

export default function DeskActions({
  parkId, stage, nextAction, managed,
}: { parkId: string; stage: string | null; nextAction: string | null; managed: boolean }) {
  const [s, setS] = useState(stage ?? "target");
  const [when, setWhen] = useState(nextAction ?? "");
  const [on, setOn] = useState(managed);
  const [msg, setMsg] = useState<string | null>(null);

  const saveDeal = async (stageValue: string, action: string) => {
    setS(stageValue);
    setWhen(action);
    const res = await fetch("/api/deals", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, stage: stageValue, nextAction: action }),
    });
    setMsg(res.ok ? "Pipeline updated." : "Could not save the stage.");
  };

  const toggle = async () => {
    const next = !on;
    setOn(next);
    const res = await fetch("/api/portfolio", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, managed: next }),
    });
    setMsg(res.ok ? (next ? "Marked as managed." : "Removed from the managed list.") : "Could not update the portfolio.");
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-sm border border-[#e2e2e2] bg-white p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#787d85]">Stage</span>
        <select value={s} onChange={(e) => saveDeal(e.target.value, when)} className="h-8 rounded-sm border border-[#e2e2e2] px-2">
          {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#787d85]">Next action</span>
        <input type="date" value={when} onChange={(e) => saveDeal(s, e.target.value)} className="h-8 rounded-sm border border-[#e2e2e2] px-2" />
      </label>
      <button onClick={toggle} className="h-8 rounded-sm border border-[#18191b] px-3">
        {on ? "Managed" : "Mark managed"}
      </button>
      {msg && <span className="text-xs text-[#787d85]">{msg}</span>}
    </div>
  );
}
