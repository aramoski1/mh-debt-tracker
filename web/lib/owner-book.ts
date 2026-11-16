/** Recorded-name matching, the debt figure, and the maturity line on an owner record. */

import { monthYear, monthsFromNow } from "./format";

export function recordedNameKey(name: string | null | undefined): string | null {
  if (name == null) return null;
  const key = name.trim().toLowerCase();
  return key || null;
}

export function debtOnFile(balances: readonly (number | string | null | undefined)[]): {
  amount: number | null;
  missing: number;
} {
  let sum = 0;
  let reported = 0;
  let missing = 0;
  for (const value of balances) {
    if (value == null || value === "") {
      missing += 1;
      continue;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) {
      missing += 1;
      continue;
    }
    sum += n;
    reported += 1;
  }
  if (reported === 0) return { amount: null, missing: 0 };
  return { amount: sum, missing };
}

/** Shown only when this record has a reported balance and at least one blank. */
export function balancesNotOnFile(missing: number): string | null {
  if (missing <= 0) return null;
  return missing === 1 ? "1 balance not on file" : `${missing} balances not on file`;
}

export type NamedPark = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
};

export function otherParksWithSameName(parks: readonly NamedPark[], ownerId: string, ownerName: string | null): NamedPark[] {
  const key = recordedNameKey(ownerName);
  if (!key) return [];
  const ownerKey = ownerId.trim().toLowerCase();
  return parks
    .filter((park) => (park.ownerId ?? "").trim().toLowerCase() !== ownerKey && recordedNameKey(park.ownerName) === key)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The list keeps the records with the most parks. Say so when some are left off. */
export function ownerListNote(shown: number, total: number): string | null {
  if (shown >= total) return null;
  return `Showing ${shown} of ${total} recorded owners.`;
}

/** One other park shows its name. Two or more show a count. None shows a blank. */
export function sameNameCell(otherParks: readonly { name: string }[]): string {
  if (otherParks.length === 0) return "—";
  if (otherParks.length === 1) return otherParks[0].name;
  return `${otherParks.length} other parks`;
}

export type DatedPark = {
  maturity_date: string | null;
  maturity_basis: string | null;
  p10_date?: string | null;
  p90_date?: string | null;
};

export type DossierMaturity = {
  sentence: string;
  tileLabel: string;
  tileValue: string;
  tileDetail: string | null;
  row: string;
};

const NONE: DossierMaturity = {
  sentence: "No maturity on file.",
  tileLabel: "Next maturity",
  tileValue: "—",
  tileDetail: null,
  row: "no maturity on file",
};

function basisWord(basis: string | null) {
  if (basis === "reported") return "Reported";
  if (basis === "document") return "From document";
  if (basis === "estimated") return "Estimated";
  return "Basis unknown";
}

function monthPassed(date: string | null | undefined) {
  const months = monthsFromNow(date);
  return months != null && months < 0;
}

/** One park's maturity line. A passed month is not called next. */
export function parkMaturity(park: DatedPark): DossierMaturity & { rank: "ahead" | "range" | "passed" | "none" } {
  const date = park.maturity_date;
  if (!date) return { ...NONE, rank: "none" };
  const word = basisWord(park.maturity_basis);
  const month = monthYear(date);
  if (park.maturity_basis === "estimated") {
    const start = monthYear(park.p10_date || date);
    const end = monthYear(park.p90_date || date);
    const endPassed = monthPassed(park.p90_date || date);
    if (endPassed) {
      return {
        rank: "passed",
        sentence: `No maturity still ahead. Estimated range ${start} to ${end} has already passed.`,
        tileLabel: "Passed",
        tileValue: month,
        tileDetail: `Estimated · ${start} to ${end}`,
        row: `Estimated range ${start} to ${end} has passed`,
      };
    }
    if (monthPassed(date)) {
      return {
        rank: "range",
        sentence: `The ${month} point date has passed. Estimated. Likely range ${start} to ${end}.`,
        tileLabel: "Estimated range",
        tileValue: `${start} to ${end}`,
        row: `point ${month} has passed · Estimated · ${start} to ${end}`,
        tileDetail: "Point date has passed",
      };
    }
    return {
      rank: "ahead",
      sentence: `Next maturity ${month}. Estimated. Likely range ${start} to ${end}.`,
      tileLabel: "Next maturity",
      tileValue: month,
      tileDetail: `Estimated · ${start} to ${end}`,
      row: `matures ${month} · Estimated · ${start} to ${end}`,
    };
  }
  if (monthPassed(date)) {
    return {
      rank: "passed",
      sentence: `No maturity still ahead. ${month} has passed. ${word}.`,
      tileLabel: "Passed",
      tileValue: month,
      tileDetail: word,
      row: `${month} has passed · ${word}`,
    };
  }
  return {
    rank: "ahead",
    sentence: `Next maturity ${month}. ${word}.`,
    tileLabel: "Next maturity",
    tileValue: month,
    tileDetail: word,
    row: `matures ${month} · ${word}`,
  };
}

/** The header uses the earliest month still ahead. A passed month does not take that line. */
export function ownerMaturity(parks: readonly DatedPark[]): DossierMaturity {
  const ranked = parks.map((park) => ({ park, view: parkMaturity(park) }));
  const pick = (rank: "ahead" | "range" | "passed") => ranked
    .filter((item) => item.view.rank === rank)
    .sort((a, b) => (a.park.maturity_date ?? "").localeCompare(b.park.maturity_date ?? ""))[0];
  const chosen = pick("ahead") ?? pick("range") ?? pick("passed");
  if (!chosen) return NONE;
  const { sentence, tileLabel, tileValue, tileDetail, row } = chosen.view;
  return { sentence, tileLabel, tileValue, tileDetail, row };
}
