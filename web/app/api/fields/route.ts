import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  if (typeof body.parkId !== "string" || typeof body.slug !== "string") return NextResponse.json({ error: "Missing field" }, { status: 400 });
  const { data } = await supabase.from("parks").select("custom_fields").eq("id", body.parkId).maybeSingle();
  const current = ((data as { custom_fields?: Record<string, string> } | null)?.custom_fields) ?? {};
  const next = { ...current, [body.slug]: String(body.value ?? "") };
  const { error } = await supabase.from("parks").update({ custom_fields: next }).eq("id", body.parkId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
