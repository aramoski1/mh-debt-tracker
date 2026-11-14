import { describe, expect, it } from "vitest";
import { money } from "./format";
import { balancesNotOnFile, debtOnFile, otherParksWithSameName, ownerListNote, recordedNameKey, sameNameCell } from "./owner-book";

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
