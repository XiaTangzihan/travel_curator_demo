import { describe, expect, it } from "vitest";
import { shouldShowSelectionRiskWarning } from "@/src/features/workspace/workspace-page";

describe("shouldShowSelectionRiskWarning", () => {
  it("在选中数量不超过 8 时不显示 warning", () => {
    expect(shouldShowSelectionRiskWarning(0)).toBe(false);
    expect(shouldShowSelectionRiskWarning(8)).toBe(false);
  });

  it("在选中数量超过 8 时显示 warning", () => {
    expect(shouldShowSelectionRiskWarning(9)).toBe(true);
    expect(shouldShowSelectionRiskWarning(12)).toBe(true);
  });
});
