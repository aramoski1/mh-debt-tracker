import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const ROLES = new Set(["owner", "manager", "broker", "lender", "attorney"]);

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name the contact" }, { status: 400 });
  const role = ROLES.has(body.role) ? body.role : "owner";
  const { error } = await supabase.from("contacts").insert({
    owner_id: body.ownerId ?? null,
    park_id: body.parkId ?? null,
    name,
    role,
    phone: body.phone || null,
    email: body.email || null,
    mailing: body.mailing || null,
    source: body.source === "assessor" ? "assessor" : "manual",
    verified: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
