import { afterEach, describe, expect, it } from "vitest";
import { money } from "./format";
import { balancesNotOnFile, debtOnFile, otherParksWithSameName, ownerListNote, ownerMaturity, parkMaturity, recordedNameKey, sameNameCell } from "./owner-book";

describe("debt on file", () => {
  it("keeps a blank book blank", () => {
    expect(debtOnFile([null, undefined, ""])).toEqual({ amount: null, missing: 0 });
    expect(money(debtOnFile([null]).amount)).toBe("—");
    expect(balancesNotOnFile(0)).toBeNull();
  });

  it("sums reported balances and leaves blanks out", () => {
    expect(debtOnFile([3_231_000, null])).toEqual({ amount: 3_231_000, missing: 1 });
    expect(money(3_231_000)).toBe("$3.2M");
    expect(balancesNotOnFile(1)).toBe("1 balance not on file");
    expect(balancesNotOnFile(2)).toBe("2 balances not on file");
  });

  it("treats a stored zero as zero", () => {
    expect(debtOnFile([0])).toEqual({ amount: 0, missing: 0 });
    expect(money(0)).toBe("$0");
    expect(balancesNotOnFile(debtOnFile([0]).missing)).toBeNull();
    expect(debtOnFile([0, null])).toEqual({ amount: 0, missing: 1 });
    expect(balancesNotOnFile(1)).toBe("1 balance not on file");
  });
});

describe("same recorded name", () => {
  const parks = [
    { id: "a", name: "Silver Spur RV Resort", ownerId: "1", ownerName: "Silver Spur Holdings LLC" },
    { id: "b", name: "Silver Spur Manufactured Home Community", ownerId: "2", ownerName: "silver spur holdings llc" },
    { id: "c", name: "Other", ownerId: "3", ownerName: "Other LLC" },
    { id: "d", name: "Comma", ownerId: "4", ownerName: "Silver Spur Holdings, LLC" },
  ];

  it("trims and ignores letter case, and keeps punctuation", () => {
    expect(recordedNameKey("  Silver Spur Holdings LLC ")).toBe("silver spur holdings llc");
    expect(recordedNameKey("Silver Spur Holdings, LLC")).not.toBe(recordedNameKey("Silver Spur Holdings LLC"));
    expect(otherParksWithSameName(parks, "1", "Silver Spur Holdings LLC").map((park) => park.name)).toEqual([
      "Silver Spur Manufactured Home Community",
    ]);
  });

  it("keeps this owner off the list when the id case differs", () => {
    const rows = [
      { id: "a", name: "Silver Spur RV Resort", ownerId: "EB4C", ownerName: "Silver Spur Holdings LLC" },
      { id: "b", name: "Silver Spur Manufactured Home Community", ownerId: "e29d", ownerName: "Silver Spur Holdings LLC" },
    ];
    expect(otherParksWithSameName(rows, "eb4c", "Silver Spur Holdings LLC").map((park) => park.id)).toEqual(["b"]);
  });

  it("says when the owner list is cut", () => {
    expect(ownerListNote(48, 48)).toBeNull();
    expect(ownerListNote(80, 760)).toBe("Showing 80 of 760 recorded owners.");
  });

  it("labels the owners-list cell", () => {
    expect(sameNameCell([])).toBe("—");
    expect(sameNameCell([{ name: "Silver Spur RV Resort" }])).toBe("Silver Spur RV Resort");
    expect(sameNameCell([{ name: "Sunrise Village" }, { name: "Sunrise Estates" }])).toBe("2 other parks");
  });
});

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

function pin() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "demo";
  process.env.DEMO_AS_OF = "2026-11-12";
}

describe("dossier maturity", () => {
  it("names a future reported date and does not treat the current month as passed", () => {
    pin();
    const golden = ownerMaturity([{ maturity_date: "2028-05-12", maturity_basis: "reported" }]);
    expect(golden.sentence).toBe("Next maturity May 2028. Reported.");
    expect(golden.tileLabel).toBe("Next maturity");
    expect(golden.tileValue).toBe("May 2028");
    expect(golden.tileDetail).toBe("Reported");
    expect(parkMaturity({ maturity_date: "2028-05-12", maturity_basis: "reported" }).row).toBe("matures May 2028 · Reported");
    const current = ownerMaturity([{ maturity_date: "2026-11-02", maturity_basis: "reported" }]);
    expect(current.sentence).toBe("Next maturity Nov 2026. Reported.");
  });

  it("names a future document date", () => {
    pin();
    const view = ownerMaturity([{ maturity_date: "2027-09-25", maturity_basis: "document" }]);
    expect(view.sentence).toBe("Next maturity Sep 2027. From document.");
    expect(view.tileDetail).toBe("From document");
    expect(parkMaturity({ maturity_date: "2027-09-25", maturity_basis: "document" }).row).toBe("matures Sep 2027 · From document");
  });

  it("names a future estimated date and its range", () => {
    pin();
    const canyon = ownerMaturity([{ maturity_date: "2027-01-07", maturity_basis: "estimated", p10_date: "2026-01-07", p90_date: "2029-01-07" }]);
    expect(canyon.sentence).toBe("Next maturity Jan 2027. Estimated. Likely range Jan 2026 to Jan 2029.");
    expect(canyon.tileDetail).toBe("Estimated · Jan 2026 to Jan 2029");
    expect(parkMaturity({ maturity_date: "2027-01-07", maturity_basis: "estimated", p10_date: "2026-01-07", p90_date: "2029-01-07" }).row).toBe("matures Jan 2027 · Estimated · Jan 2026 to Jan 2029");
    const village = ownerMaturity([{ maturity_date: "2029-11-01", maturity_basis: "estimated", p10_date: "2027-11-01", p90_date: "2034-11-01" }]);
    expect(village.sentence).toBe("Next maturity Nov 2029. Estimated. Likely range Nov 2027 to Nov 2034.");
  });

  it("does not call a passed estimated range the next maturity", () => {
    pin();
    const view = ownerMaturity([{ maturity_date: "2026-09-01", maturity_basis: "estimated", p10_date: "2023-09-01", p90_date: "2026-09-01" }]);
    expect(view.sentence).toBe("No maturity still ahead. Estimated range Sep 2023 to Sep 2026 has already passed.");
    expect(view.tileLabel).toBe("Passed");
    expect(view.tileValue).toBe("Sep 2026");
    expect(view.tileDetail).toBe("Estimated · Sep 2023 to Sep 2026");
    expect(parkMaturity({ maturity_date: "2026-09-01", maturity_basis: "estimated", p10_date: "2023-09-01", p90_date: "2026-09-01" }).row).toBe("Estimated range Sep 2023 to Sep 2026 has passed");
    expect(view.sentence).not.toContain("Next maturity");
  });

  it("keeps a passed document date under Passed", () => {
    pin();
    const view = ownerMaturity([{ maturity_date: "2022-07-05", maturity_basis: "document" }]);
    expect(view.sentence).toBe("No maturity still ahead. Jul 2022 has passed. From document.");
    expect(view.tileLabel).toBe("Passed");
    expect(view.tileValue).toBe("Jul 2022");
    expect(parkMaturity({ maturity_date: "2022-07-05", maturity_basis: "document" }).row).toBe("Jul 2022 has passed · From document");
    const reported = ownerMaturity([{ maturity_date: "2022-07-05", maturity_basis: "reported" }]);
    expect(reported.sentence).toBe("No maturity still ahead. Jul 2022 has passed. Reported.");
  });

  it("says when no date is on file", () => {
    pin();
    const view = ownerMaturity([{ maturity_date: null, maturity_basis: null }]);
    expect(view).toMatchObject({ sentence: "No maturity on file.", tileLabel: "Next maturity", tileValue: "—", tileDetail: null });
    expect(parkMaturity({ maturity_date: null, maturity_basis: null }).row).toBe("no maturity on file");
  });

  it("does not call a passed point next while the range still runs ahead", () => {
    pin();
    const view = ownerMaturity([{ maturity_date: "2026-09-01", maturity_basis: "estimated", p10_date: "2026-06-01", p90_date: "2027-03-01" }]);
    expect(view.sentence).toBe("The Sep 2026 point date has passed. Estimated. Likely range Jun 2026 to Mar 2027.");
    expect(view.tileLabel).toBe("Estimated range");
    expect(view.tileValue).toBe("Jun 2026 to Mar 2027");
    expect(view.tileDetail).toBe("Point date has passed");
    expect(parkMaturity({ maturity_date: "2026-09-01", maturity_basis: "estimated", p10_date: "2026-06-01", p90_date: "2027-03-01" }).row).toBe("point Sep 2026 has passed · Estimated · Jun 2026 to Mar 2027");
  });

  it("lets a month still ahead take the line when another date has passed", () => {
    pin();
    const view = ownerMaturity([
      { maturity_date: "2022-07-05", maturity_basis: "document" },
      { maturity_date: "2028-05-12", maturity_basis: "reported" },
    ]);
    expect(view.sentence).toBe("Next maturity May 2028. Reported.");
  });

  it("says the basis is unknown instead of inventing one", () => {
    pin();
    const view = ownerMaturity([{ maturity_date: "2028-01-01", maturity_basis: null }]);
    expect(view.sentence).toBe("Next maturity Jan 2028. Basis unknown.");
    expect(view.tileDetail).toBe("Basis unknown");
  });
});
