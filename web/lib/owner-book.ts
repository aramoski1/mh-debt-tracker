/** Recorded-name matching and the debt figure on an owner record. */

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
  return parks
    .filter((park) => park.ownerId !== ownerId && recordedNameKey(park.ownerName) === key)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One other park shows its name. Two or more show a count. None shows a blank. */
export function sameNameCell(otherParks: readonly { name: string }[]): string {
  if (otherParks.length === 0) return "—";
  if (otherParks.length === 1) return otherParks[0].name;
  return `${otherParks.length} other parks`;
}
