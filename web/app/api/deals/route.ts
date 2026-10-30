import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { STAGES } from "@/lib/stages";

const ALLOWED = [...STAGES.map(([id]) => id), "under_contract"];

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  if (!body?.parkId || !ALLOWED.includes(body.stage)) return NextResponse.json({ error: "Missing deal" }, { status: 400 });
  const num = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const row: Record<string, unknown> = {
    park_id: body.parkId,
    stage: body.stage,
    next_action: body.nextAction || null,
    note: body.note ?? null,
    stage_changed_at: new Date().toISOString(),
  };
  if ("price" in body) row.price = num(body.price);
  if ("capRate" in body) row.cap_rate = num(body.capRate);
  if ("financing" in body) row.financing = body.financing || null;
  if ("diligenceDate" in body) row.diligence_date = body.diligenceDate || null;
  if ("closeDate" in body) row.close_date = body.closeDate || null;
  if ("lostReason" in body) row.lost_reason = body.lostReason || null;
  const { error } = await supabase.from("deals").upsert(row, { onConflict: "park_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
