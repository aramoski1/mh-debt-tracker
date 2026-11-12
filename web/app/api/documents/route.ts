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
    if (body.action === "reject") {
      const { data: rejected, error } = await supabase.from("park_documents").update({ status: "rejected" }).eq("id", body.id).select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!rejected || rejected.length === 0) return NextResponse.json({ error: "Document was not updated" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    const { data: doc, error: readError } = await supabase
      .from("park_documents")
      .select("id, park_id, field, quote, value, status")
      .eq("id", body.id)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "Document was not found" }, { status: 404 });
    const row = doc as { id: string; park_id: string; field: string | null; quote: string | null; value: string | null; status: string };
    if (row.field === "lot_rent") {
      const rent = num(row.value);
      if (rent == null) return NextResponse.json({ error: "Lot rent must be a number stored on the document" }, { status: 400 });
      if (!String(row.quote ?? "").trim()) return NextResponse.json({ error: "Accept needs a quote stored on the document" }, { status: 400 });
      const { error: rentError } = await supabase.from("park_operating").insert({
        park_id: row.park_id,
        source: "document",
        source_ref: row.id,
        entered_by: user.id,
        observed_on: new Date().toISOString().slice(0, 10),
        rent_current: rent,
        field_sources: { rent_current: "document" },
        notes: `Accepted from a quote: ${String(row.quote).slice(0, 240)}`,
      });
      if (rentError && rentError.code !== "23505") return NextResponse.json({ error: rentError.message }, { status: 500 });
    }
    const { data: accepted, error } = await supabase.from("park_documents").update({ status: "accepted" }).eq("id", body.id).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!accepted || accepted.length === 0) return NextResponse.json({ error: "Document was not updated" }, { status: 409 });
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
