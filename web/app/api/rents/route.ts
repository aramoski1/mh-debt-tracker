import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  const submarket = String(body.submarket ?? "").trim();
  const source = String(body.source ?? "").trim();
  const rent = Number(body.lotRent);
  if (!submarket || !source || !Number.isFinite(rent)) return NextResponse.json({ error: "Submarket, rent, and source are required" }, { status: 400 });
  const { error } = await supabase.from("rent_comps").insert({
    submarket,
    lot_rent: rent,
    source,
    observed_on: body.observedOn || new Date().toISOString().slice(0, 10),
    notes: body.notes || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
