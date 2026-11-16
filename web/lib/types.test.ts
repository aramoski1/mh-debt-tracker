import { describe, expect, it } from "vitest";
import { sourceLabel } from "./types";

describe("source label", () => {
  it("names every filing the pipeline writes", () => {
    expect(sourceLabel("county")).toBe("County record");
    expect(sourceLabel("cmbs")).toBe("CMBS filing");
    expect(sourceLabel("fannie")).toBe("Fannie Mae");
    expect(sourceLabel("freddie")).toBe("Freddie Mac");
    expect(sourceLabel("sba")).toBe("SBA");
    expect(sourceLabel("hud")).toBe("FHA");
  });

  it("does not print an unmapped source code", () => {
    expect(sourceLabel("edgar_efts")).toBe("Source not labeled");
    expect(sourceLabel("fannie")).not.toBe("fannie");
    expect(sourceLabel(null)).toBe("none on the primary loan");
    expect(sourceLabel("edgar_efts")).not.toContain("edgar");
  });
});
