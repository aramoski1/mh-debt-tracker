import type { ParkRow } from "./types";

export type Draft = { id: string; label: string; to: string; subject: string; body: string; href: string | null; warnings: string[] };

function warn(body: string) {
  const warnings: string[] = [];
  if (/\b(distress|foreclosure|default|behind on|delinquent|trustee)\b/i.test(body)) {
    warnings.push("This draft mentions distress. Do not send that to the owner.");
  }
  if (/\$[\d,]+/.test(body)) warnings.push("This draft contains a dollar figure. Check that it came from a document.");
  return warnings;
}

function mailto(to: string, subject: string, body: string) {
  return to ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
}

/** Drafts a principal buyer can edit. The desk does not send them. */
export function outreachDrafts(park: ParkRow, nearby: string[] = []): Draft[] {
  const to = park.email?.trim() || park.owner_email?.trim() || "";
  const where = [park.city, park.state].filter(Boolean).join(", ");
  const sites = park.units ? `${park.units} sites` : "the park";
  const held = /held about \d+ years/.exec(String(park.score_components?.owner?.why ?? ""))?.[0];
  const documented = park.maturity_basis === "reported" || park.maturity_basis === "document";
  const maturity = documented && park.maturity_date ? `The recorded maturity is ${park.maturity_date.slice(0, 7)}.` : "";
  const near = nearby.length ? `We operate ${nearby.slice(0, 2).join(" and ")} nearby.` : "";
  const facts = [near, maturity, held ? `You have ${held}.` : "", `${park.name} in ${where || "Arizona"} has ${sites}.`].filter(Boolean);

  const first = [
    "Hello,",
    "",
    "Cooper Cardinal buys and operates mobile home parks and RV parks. We are not a broker.",
    facts.join(" "),
    "If a conversation would be useful, I can come by.",
    "",
    "Cooper Cardinal",
  ].join("\n");
  const later = documented
    ? `If you are weighing a refinance around ${park.maturity_date?.slice(0, 7)}, we buy and operate parks and can talk through a purchase.`
    : "If you are weighing what to do with the park, we buy and operate parks and can talk through a purchase. I am not quoting a date, because the one on file is estimated.";
  const letter = [
    park.owner_name ?? "Owner",
    [park.owner_city, park.owner_state].filter(Boolean).join(", ") || "Mailing address is not on the assessor record.",
    "",
    `Re: ${park.name}`,
    "",
    "Cooper Cardinal buys and operates mobile home parks and RV parks. We are not a broker.",
    facts.join(" "),
    "A short note or a call is enough if you would like to talk.",
    "",
    "Cooper Cardinal",
  ].join("\n");

  const packs: [string, string, string, string][] = [
    ["first", "First contact", `${park.name}`, first],
    ["maturity", "Maturity", `${park.name}`, ["Hello,", "", later, facts.filter((line) => line !== maturity).join(" "), "", "Cooper Cardinal"].join("\n")],
    ["portfolio", "Portfolio owner", `${park.owner_name ?? park.name}`, ["Hello,", "", `You are the recorded owner of ${park.name}${park.owner_park_count && park.owner_park_count > 1 ? ` and ${park.owner_park_count - 1} other park${park.owner_park_count > 2 ? "s" : ""} on our book` : ""}.`, "We buy and operate parks. We are not a broker.", "", "Cooper Cardinal"].join("\n")],
    ["followup", "After a call", `Following up, ${park.name}`, ["Hello,", "", `Following up on ${park.name}.`, facts.join(" "), "", "Cooper Cardinal"].join("\n")],
    ["letter", "Direct mail", park.name, letter],
  ];
  return packs.map(([id, label, subject, body]) => ({ id, label, to, subject, body, href: mailto(to, subject, body), warnings: warn(body) }));
}

export function outreachDraft(park: ParkRow) {
  const draft = outreachDrafts(park)[0];
  return { to: draft.to, subject: draft.subject, body: draft.body, href: draft.href };
}
