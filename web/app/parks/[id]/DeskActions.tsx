"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { NOT_IN_PIPELINE, STAGES, dealSave } from "@/lib/stages";

export default function DeskActions({
  parkId, stage, nextAction, managed,
}: { parkId: string; stage: string | null; nextAction: string | null; managed: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(stage ?? "");
  const [when, setWhen] = useState(nextAction ?? "");
  const stageRef = useRef(stage ?? "");
  const whenRef = useRef(nextAction ?? "");
  const saveId = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(managed);
  const [msg, setMsg] = useState<string | null>(null);

  const dateInField = () => rootRef.current?.querySelector<HTMLInputElement>("input[type=date]")?.value ?? whenRef.current;

  const saveDeal = async (stageValue: string, action: string) => {
    const plan = dealSave(stageValue, action);
    if (!plan.post) {
      whenRef.current = action;
      setWhen(action);
      setMsg(plan.message);
      return;
    }
    const previousStage = stageRef.current;
    const previousWhen = stageValue === stageRef.current ? whenRef.current : action;
    stageRef.current = plan.stage;
    whenRef.current = plan.action;
    setS(plan.stage);
    setWhen(plan.action);
    const id = ++saveId.current;
    try {
      const res = await fetch("/api/deals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ parkId, stage: plan.stage, nextAction: plan.action }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      if (id !== saveId.current) return;
      stageRef.current = previousStage;
      whenRef.current = previousWhen;
      setS(previousStage);
      setWhen(previousWhen);
      setMsg("Could not save the stage.");
      return;
    }
    if (id !== saveId.current) return;
    setMsg("Pipeline updated.");
    router.refresh();
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
    <div ref={rootRef} className="flex flex-wrap items-end gap-3 rounded-sm border border-line bg-panel p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Stage</span>
        <select value={s} onChange={(e) => saveDeal(e.target.value, dateInField())} className="h-8 rounded-sm border border-line px-2">
          {s === "" && <option value="">{NOT_IN_PIPELINE}</option>}
          {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Next action</span>
        <input type="date" value={when} onChange={(e) => saveDeal(stageRef.current, e.target.value)} className="h-8 rounded-sm border border-line px-2" />
      </label>
      <button onClick={toggle} className="h-8 rounded-sm border border-line-strong px-3">
        {on ? "Managed" : "Mark managed"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
