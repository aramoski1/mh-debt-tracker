import { describe, expect, it } from "vitest";
import { PICK_STAGE, dealSave } from "./stages";

describe("deal save", () => {
  it("holds a date until a stage is chosen", () => {
    expect(dealSave("", "2026-12-01")).toEqual({ post: false, message: PICK_STAGE });
    expect(PICK_STAGE).toBe("Pick a stage to save the next action.");
  });

  it("saves the stage and the date together", () => {
    expect(dealSave("target", "2026-12-01")).toEqual({ post: true, stage: "target", action: "2026-12-01" });
    expect(dealSave("contacted", "")).toEqual({ post: true, stage: "contacted", action: "" });
  });
});
