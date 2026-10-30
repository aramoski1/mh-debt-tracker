import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Enroll a park. A finding is a flag. This route does not change the owner or the loan. */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  if (typeof body.parkId !== "string") return NextResponse.json({ error: "Missing park" }, { status: 400 });
  if (body.watching === false) {
    const { error } = await supabase.from("watches").delete().eq("park_id", body.parkId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await supabase.from("watches").upsert({ park_id: body.parkId }, { onConflict: "park_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
