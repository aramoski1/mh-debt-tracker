/** Turns a broker's sentence into the prospect filters this desk already understands. */

export type Ignored = { term: string; reason: string };

export type AskParse = {
  intent: "search" | "howto" | "cannot";
  params: Record<string, string>;
  href: string;
  understood: string[];
  ignored: Ignored[];
  reply: string;
};

const CITIES: [string, string][] = [
  ["apache junction", "Apache Junction"],
  ["lake havasu city", "Lake Havasu City"],
  ["lake havasu", "Lake Havasu"],
  ["prescott valley", "Prescott Valley"],
  ["fountain hills", "Fountain Hills"],
  ["queen creek", "Queen Creek"],
  ["casa grande", "Casa Grande"],
  ["paradise valley", "Paradise Valley"],
  ["sun city west", "Sun City West"],
  ["sun city", "Sun City"],
  ["phoenix", "Phoenix"],
  ["tucson", "Tucson"],
  ["scottsdale", "Scottsdale"],
  ["chandler", "Chandler"],
  ["gilbert", "Gilbert"],
  ["glendale", "Glendale"],
  ["mesa", "Mesa"],
  ["tempe", "Tempe"],
  ["peoria", "Peoria"],
  ["surprise", "Surprise"],
  ["goodyear", "Goodyear"],
  ["avondale", "Avondale"],
  ["buckeye", "Buckeye"],
  ["flagstaff", "Flagstaff"],
  ["prescott", "Prescott"],
  ["yuma", "Yuma"],
];

const STOP = new Set(
  "a an the in of on for to with and or show me find list parks park loan loans owner owners arizona az please that are due due within by".split(" "),
);

const FOREIGN = /\b(lease|leases|tenant|sqft|industrial|dock|clear height|commission|sunbiz|costar|loopnet|florida)\b/i;

function hrefOf(params: Record<string, string>) {
  const s = new URLSearchParams(params).toString();
  return s ? `/?${s}` : "/";
}

function take(text: string, re: RegExp): { text: string; hit: string | null } {
  const m = re.exec(text);
  if (!m) return { text, hit: null };
  return { text: text.replace(m[0], " "), hit: m[1] ?? m[0] };
}

export function parseAsk(raw: string): AskParse {
  const original = raw.trim();
  const understood: string[] = [];
  const ignored: Ignored[] = [];
  const params: Record<string, string> = {};
  let text = ` ${original.toLowerCase().replace(/[“”]/g, '"')} `;

  if (/\b(send (an )?e-?mail|e-?mail blast|text blast|whatsapp|scrape costar|log into costar)\b/.test(text)) {
    return {
      intent: "cannot",
      params,
      href: "/",
      understood,
      ignored,
      reply: "This desk does not send mail or log into CoStar. Open the email draft on a park, or work from the records already loaded.",
    };
  }
  if (/\b(make up|invent)\b.*\b(date|maturity|email)\b/.test(text) || /\b(maturity|date|email)\b.*\b(make up|invent)\b/.test(text)) {
    return {
      intent: "cannot",
      params,
      href: "/",
      understood,
      ignored,
      reply: "A date on this desk comes from a recorded document or from the maturity model, and it is labeled. An email is shown only when it is on the owner record.",
    };
  }
  if (/\bhow do i\b|\bwhere (is|do i|are)\b|\bhide (a )?column|\bdark mode\b|\bsave (this |a )?view\b|\bcustomize\b/.test(text)) {
    return {
      intent: "howto",
      params,
      href: "/desk",
      understood: ["How the desk works"],
      ignored,
      reply: "Today is the morning list. Prospects is the book: type a sentence in Ask, or use the filters and Save view. Ctrl+K jumps to a page or a parsed search. Columns, density, and the theme are remembered in this browser. A park page has the call line, the email draft, the stage, and notes.",
    };
  }

  const foreign = FOREIGN.exec(original);
  if (foreign) ignored.push({ term: foreign[1], reason: "Not a field on this park desk" });
  text = text.replace(FOREIGN, " ");

  for (const county of ["maricopa", "pima", "pinal"]) {
    const next = take(text, new RegExp(`\\b${county}(?:\\s+county)?\\b`));
    if (next.hit) {
      params.county = county[0].toUpperCase() + county.slice(1);
      understood.push(`${params.county} County`);
      text = next.text;
    }
  }

  for (const [alias, label] of CITIES) {
    const next = take(text, new RegExp(`\\b${alias}\\b`));
    if (next.hit) {
      params.city = label;
      understood.push(label);
      text = next.text;
      break;
    }
  }

  let next = take(text, /\b(\d+)\s*(?:to|-|–)\s*(\d+)\s*sites?\b/);
  if (next.hit) {
    const m = /\b(\d+)\s*(?:to|-|–)\s*(\d+)\s*sites?\b/.exec(` ${original.toLowerCase()} `);
    if (m) {
      params.minUnits = m[1];
      params.maxUnits = m[2];
      understood.push(`${m[1]}–${m[2]} sites`);
    }
    text = text.replace(/\b\d+\s*(?:to|-|–)\s*\d+\s*sites?\b/, " ");
  }
  next = take(text, /\b(?:over|above|at least|more than)\s+(\d+)\s*sites?\b/);
  if (next.hit) {
    params.minUnits = next.hit;
    understood.push(`at least ${next.hit} sites`);
    text = next.text;
  }
  next = take(text, /\b(?:under|below|fewer than|less than)\s+(\d+)\s*sites?\b/);
  if (next.hit) {
    params.maxUnits = next.hit;
    understood.push(`under ${next.hit} sites`);
    text = next.text;
  }

  next = take(text, /\b(?:score|pressure)\s*(?:over|above|at least|of)?\s*(\d+)\b/);
  if (next.hit) {
    params.minScore = next.hit;
    understood.push(`score at least ${next.hit}`);
    text = next.text;
  } else if (/\b(severe|high pressure)\b/.test(text)) {
    params.minScore = "60";
    understood.push("score at least 60");
    text = text.replace(/\b(severe|high pressure)\b/, " ");
  }

  next = take(text, /\b(?:due|matur\w*|within|inside|next)\s+(?:in\s+|the\s+next\s+)?(\d+)\s*(?:months|mos|mo)\b/);
  if (!next.hit) next = take(text, /\b(\d+)\s*(?:months|mos|mo)\b/);
  if (next.hit) {
    params.window = next.hit;
    understood.push(`matures within ${next.hit} months`);
    text = next.text;
  }

  if (/\b(fannie|freddie|agency)\b/.test(text)) {
    params.lender = "agency";
    understood.push("Fannie or Freddie");
    text = text.replace(/\b(fannie|freddie|agency)\b/g, " ");
  } else if (/\bcmbs\b/.test(text)) {
    params.lender = "cmbs";
    understood.push("CMBS");
    text = text.replace(/\bcmbs\b/g, " ");
  } else if (/\b(private|seller financed|seller)\b/.test(text)) {
    params.lender = "private";
    understood.push("private or seller");
    text = text.replace(/\b(private|seller financed|seller)\b/g, " ");
  } else if (/\b(bank|banks|credit union|credit unions)\b/.test(text)) {
    params.lender = "bank";
    understood.push("banks and credit unions");
    text = text.replace(/\b(bank|banks|credit union|credit unions)\b/g, " ");
  } else if (/\bno loan\b/.test(text)) {
    params.lender = "none";
    understood.push("no loan on file");
    text = text.replace(/\bno loan\b/g, " ");
  }

  if (/\brv\b/.test(text) && /\b(mh|manufactured|mobile)\b/.test(text)) {
    params.kind = "mixed";
    understood.push("MH and RV");
  } else if (/\brv\b/.test(text)) {
    params.kind = "rv";
    understood.push("RV parks");
  } else if (/\b(mh|manufactured|mobile home)\b/.test(text)) {
    params.kind = "mhp";
    understood.push("MH parks");
  }
  text = text.replace(/\b(rv|mh|manufactured|mobile home|mobile)\b/g, " ");

  if (/\b(foreclosure|trustee|lis pendens)\b/.test(text)) {
    params.status = "foreclosure";
    understood.push("foreclosure notice");
    text = text.replace(/\b(foreclosure|trustee sale|lis pendens|trustee)\b/g, " ");
  }
  if (/\b(known dates?|documented|from a document)\b/.test(text)) {
    params.basis = "known";
    understood.push("known dates only");
    text = text.replace(/\b(known dates?|documented|from a document)\b/g, " ");
  }
  if (/\bout[- ]of[- ]state\b/.test(text)) {
    params.owner = "out";
    understood.push("owner based outside Arizona");
    text = text.replace(/\bout[- ]of[- ]state(\s+owners?)?\b/g, " ");
  }
  if (/\b(more than one park|multiple parks|portfolio owners?|two or more parks)\b/.test(text)) {
    params.minParks = "2";
    understood.push("owner has at least two parks");
    text = text.replace(/\b(more than one park|multiple parks|portfolio owners?|two or more parks)\b/g, " ");
  }
  if (/\beast valley\b/.test(text)) {
    params.region = "east";
    understood.push("East Valley");
    text = text.replace(/\beast valley\b/g, " ");
  }
  next = take(text, /\brate shock(?:\s+over|\s+above|\s+of)?\s+(\d+)\s*(?:bps|bp)?\b/);
  if (next.hit) {
    params.shock = next.hit;
    understood.push(`rate shock of at least ${next.hit} bps`);
    text = next.text;
  }
  const gapMatch = /\brefi(?:nance)? gap(?:\s+over|\s+above)?\s+\$?(\d+(?:\.\d+)?)\s*(k|m)?\b/.exec(text);
  if (gapMatch) {
    const n = Number(gapMatch[1]);
    const mult = gapMatch[2] === "m" ? 1_000_000 : gapMatch[2] === "k" ? 1_000 : 1;
    params.gap = String(Math.round(n * mult));
    understood.push(`refinance gap of at least ${params.gap}`);
    text = text.replace(gapMatch[0], " ");
  }
  next = take(text, /\bheld\s+(\d+)\+?\s*years\b/);
  if (next.hit) {
    params.held = next.hit;
    understood.push(`held at least ${next.hit} years`);
    text = next.text;
  }
  next = take(text, /\bwithin\s+(\d+)\s*miles\b/);
  if (next.hit) {
    params.miles = next.hit;
    understood.push(`within ${next.hit} miles of a park we run`);
    text = next.text;
  }
  next = take(text, /\bnot contacted in\s+(\d+)\s*days\b/);
  if (next.hit) {
    params.staleDays = next.hit;
    understood.push(`not contacted in ${next.hit} days`);
    text = next.text;
  }
  if (/\bassumable\b/.test(text)) {
    params.assumable = "1";
    params.lender = params.lender ?? "agency";
    understood.push("assumable agency loan");
    text = text.replace(/\bassumable(\s+agency)?(\s+loan)?\b/g, " ");
  }
  if (/\blot rent\b/.test(text)) {
    ignored.push({ term: "lot rent", reason: "Lot rent is not in the public data. Enter it on the park." });
    text = text.replace(/\blot rent\b/g, " ");
  }

  const leftover = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word) && !/^\d+$/.test(word));
  if (leftover.length) {
    params.q = leftover.join(" ");
    understood.push(`name contains “${params.q}”`);
  }

  const reply = understood.length
    ? `Showing ${understood.join(", ")}.`
    : "Ask for a city, a county, a lender, a site count, a score, or a maturity window. Example: banks in Tucson due in 12 months.";

  return { intent: "search", params, href: hrefOf(params), understood, ignored, reply };
}
