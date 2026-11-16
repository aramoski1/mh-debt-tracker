import { afterEach, describe, expect, it } from "vitest";
import { callLine } from "./brief";
import type { ParkRow } from "./types";

function row(over: Partial<ParkRow>): ParkRow {
  return { maturity_date: null, loan_status: "active", score_components: null, ...over } as ParkRow;
}

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

function pin() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "demo";
  process.env.DEMO_AS_OF = "2026-11-12";
}

describe("call line", () => {
  it("names a price cap instead of an income shortfall", () => {
    const line = callLine(row({
      score_components: {
        refi_gap: {
          points: 0,
          scored: true,
          noi_basis: "reported",
          balance_basis: "reported",
          equity_needed: 750000,
          why: "25-year bank amortization. 75% of price (desk cap) binds",
        },
      },
    }));
    expect(line).toContain("$750,000");
    expect(line).toContain("price cap");
    expect(line).not.toContain("short about");
  });

  it("names an income shortfall when the DSCR test binds", () => {
    const line = callLine(row({
      score_components: {
        refi_gap: {
          points: 12.3,
          scored: true,
          noi_basis: "reported",
          balance_basis: "reported",
          equity_needed: 755393,
          why: "25-year bank amortization. 1.25x DSCR binds",
        },
      },
    }));
    expect(line).toContain("$755,393");
    expect(line).toContain("reported income");
  });

  it("does not ask for a replacement when the note says the loan was most likely repaid", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2022-07-05",
      maturity_basis: "document",
      maturity_explanation: "Maturity 2022-07-05 (stated in the recorded document). The date passed long ago; the loan was most likely repaid without a recorded release.",
    }));
    expect(line).toBe("The Jul 2022 date has passed. The loan was most likely repaid without a recorded release.");
    expect(line).not.toContain("lined up");
    expect(line).not.toContain("come due");
  });

  it("does not quote a coming-due date when the estimated range has passed", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2026-09-01",
      maturity_basis: "estimated",
      p10_date: "2023-09-01",
      p90_date: "2026-09-01",
      maturity_explanation: "Most likely maturity 2026-09-01. There is about a 74% chance it was already repaid or refinanced without a release in our data.",
    }));
    expect(line).toBe("The likely range, Sep 2023 to Sep 2026, has already passed. The date is a model, not a date to quote.");
    expect(line).not.toContain("come due");
  });

  it("does not call a passed point date coming due while the range still runs ahead", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2026-09-01",
      maturity_basis: "estimated",
      p10_date: "2026-06-01",
      p90_date: "2027-03-01",
    }));
    expect(line).toBe("The Sep 2026 point date has passed. The likely range runs through Mar 2027. The date is a model, not a date to quote.");
    expect(line).not.toContain("come due");
  });

  it("says reported to come due when the lender reported a date inside twelve months", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2027-09-08",
      maturity_basis: "reported",
      maturity_explanation: "Maturity 2027-09-08 (reported by the lender/servicer).",
    }));
    expect(line).toBe("The loan is reported to come due Sep 2027. Ask what they have lined up to replace it.");
    expect(line).not.toContain("documented");
  });

  it("keeps the hold question when a reported date is outside twelve months", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2028-05-12",
      maturity_basis: "reported",
    }));
    expect(line).toBe("The loan is reported to come due May 2028. Confirm the real date and whether they want to hold.");
  });

  it("still asks about a replacement when the documented date is ahead", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2027-09-25",
      maturity_basis: "document",
      maturity_explanation: "Maturity 2027-09-25 (stated in the recorded document).",
    }));
    expect(line).toBe("The loan is documented through Sep 2027. Ask what they have lined up to replace it.");
  });

  it("says no loan is on file when the only words would be how long they have held", () => {
    pin();
    const line = callLine(row({
      loan_id: null,
      score_components: { owner: { why: "held about 26 years; owner based in IL; owned by a trust", points: 12 } },
    }));
    expect(line).toBe("No loan is on file.");
    expect(line).not.toContain("held about");
  });

  it("names a reported maturity when the hold phrase would be the whole sentence", () => {
    pin();
    const line = callLine(row({
      loan_id: "606f881d-d250-4e6e-b937-3af4855d32b0",
      maturity_date: "2028-07-03",
      maturity_basis: "reported",
      score_components: { owner: { why: "held about 24 years", points: 5 } },
    }));
    expect(line).toBe("The loan is reported to come due Jul 2028.");
    expect(line).not.toContain("held about");
  });

  it("keeps an owner fact that is more than the hold phrase", () => {
    pin();
    const line = callLine(row({
      loan_id: "loan",
      maturity_date: "2030-07-05",
      maturity_basis: "reported",
      score_components: { owner: { why: "held about 30 years; owner based in CA", points: 8 } },
    }));
    expect(line).toBe("held about 30 years; owner based in CA");
  });

  it("keeps the trustee-sale sentence when the maturity has also passed", () => {
    pin();
    const line = callLine(row({
      loan_status: "foreclosure",
      maturity_date: "2022-07-05",
      maturity_basis: "document",
      maturity_explanation: "The date passed long ago; the loan was most likely repaid without a recorded release.",
    }));
    expect(line).toBe("A trustee sale or lis pendens is on the record. Ask if they want a buyer before the sale date.");
  });
});
