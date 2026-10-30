import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();

  if (body.action === "accept" || body.action === "reject") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "Missing document" }, { status: 400 });
    if (body.action === "accept" && !String(body.quote ?? "").trim()) {
      return NextResponse.json({ error: "Accept needs a quote from the document" }, { status: 400 });
    }
    const { error } = await supabase.from("park_documents").update({ status: body.action === "accept" ? "accepted" : "rejected" }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (body.action === "accept" && body.field === "lot_rent" && body.parkId) {
      const rent = num(body.value);
      if (rent == null) return NextResponse.json({ error: "Lot rent must be a number" }, { status: 400 });
      await supabase.from("park_operating").insert({
        park_id: body.parkId,
        source: "document",
        observed_on: new Date().toISOString().slice(0, 10),
        rent_current: rent,
        field_sources: { rent_current: "document" },
        notes: `Accepted from a quote: ${String(body.quote).slice(0, 240)}`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  const title = String(body.title ?? "").trim();
  const quote = String(body.quote ?? "").trim();
  if (!body.parkId || !title || !quote) return NextResponse.json({ error: "Title and a quote are required" }, { status: 400 });
  const { error } = await supabase.from("park_documents").insert({
    park_id: body.parkId,
    title,
    url: body.url || null,
    page: body.page ? Number(body.page) : null,
    field: body.field || null,
    value: body.value || null,
    quote,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
