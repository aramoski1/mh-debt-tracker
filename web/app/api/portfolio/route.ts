import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { parkId, managed } = await req.json();
  if (!parkId) return NextResponse.json({ error: "Missing park" }, { status: 400 });
  const op = managed
    ? supabase.from("portfolio").upsert({ park_id: parkId }, { onConflict: "park_id" })
    : supabase.from("portfolio").delete().eq("park_id", parkId);
  const { error } = await op;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
