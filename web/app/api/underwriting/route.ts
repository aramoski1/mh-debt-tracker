import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  if (!body?.parkId) return NextResponse.json({ error: "Missing park" }, { status: 400 });
  const num = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const { error } = await supabase.from("underwriting").upsert({
    park_id: body.parkId,
    price: num(body.price),
    cap_rate: num(body.capRate),
    lot_rent: num(body.lotRent),
    occupancy_pct: num(body.occupancyPct),
    expense_pct: num(body.expensePct),
    rent_growth: num(body.rentGrowth),
    sites: num(body.sites),
  }, { onConflict: "park_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
