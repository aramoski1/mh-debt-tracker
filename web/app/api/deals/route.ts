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
  const { error } = await supabase.from("deals").upsert({
    park_id: body.parkId,
    stage: body.stage,
    next_action: body.nextAction || null,
    note: body.note ?? null,
  }, { onConflict: "park_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
