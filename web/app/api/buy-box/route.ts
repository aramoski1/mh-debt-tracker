import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  const { error } = await supabase.from("buy_box").update({
    min_sites: Number(body.minSites),
    max_sites: Number(body.maxSites),
    states: String(body.states || "AZ").split(",").map((s: string) => s.trim().toUpperCase()).filter(Boolean),
    kinds: body.kinds,
  }).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
