import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ dashboard: null });
  const { data } = await supabase.from("user_settings").select("dashboard").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ dashboard: (data as { dashboard?: unknown } | null)?.dashboard ?? null });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  const dashboard = body.dashboard;
  if (!dashboard || typeof dashboard !== "object") return NextResponse.json({ error: "Missing layout" }, { status: 400 });
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, dashboard }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
