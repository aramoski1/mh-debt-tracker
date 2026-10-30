import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json()) as { id?: string; action?: string };
  if (!body.id || (body.action !== "dismiss" && body.action !== "resolve")) {
    return NextResponse.json({ error: "Missing issue" }, { status: 400 });
  }
  const column = body.action === "dismiss" ? "dismissed_at" : "resolved_at";
  const { error } = await supabase.from("ingestion_errors").update({ [column]: new Date().toISOString() }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
