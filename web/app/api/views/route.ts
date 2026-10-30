import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data, error } = await supabase.from("saved_views").select("id, name, params").order("created_at", { ascending: false }).limit(40);
  if (error) return NextResponse.json({ views: [] });
  return NextResponse.json({ views: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  if (body.id && body.remove) {
    const { error } = await supabase.from("saved_views").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const name = String(body.name ?? "").trim();
  if (!name || typeof body.params !== "object" || body.params == null) return NextResponse.json({ error: "Name the view" }, { status: 400 });
  const { error } = await supabase.from("saved_views").insert({ user_id: user.id, name, params: body.params });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
