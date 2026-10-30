import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  if (typeof body.names === "string") {
    const lines = body.names.split(/\n/).map((line: string) => line.trim()).filter(Boolean);
    const { data } = await supabase.from("park_overview").select("id, name").eq("state", "AZ").limit(2000);
    const parks = (data ?? []) as { id: string; name: string }[];
    const matched: string[] = [];
    const missed: string[] = [];
    for (const line of lines) {
      const hit = parks.find((park) => park.name.toLowerCase() === line.toLowerCase());
      if (!hit) { missed.push(line); continue; }
      const { error: upErr } = await supabase.from("portfolio").upsert({ park_id: hit.id }, { onConflict: "park_id" });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      matched.push(hit.name);
    }
    return NextResponse.json({ matched, missed });
  }
  const { parkId, managed } = body;
  if (!parkId) return NextResponse.json({ error: "Missing park" }, { status: 400 });
  const op = managed
    ? supabase.from("portfolio").upsert({ park_id: parkId }, { onConflict: "park_id" })
    : supabase.from("portfolio").delete().eq("park_id", parkId);
  const { error } = await op;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
