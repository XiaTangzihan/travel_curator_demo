import { describe, expect, it } from "vitest";
import {
  isEditInstructionReady,
  minimumEditInstructionLength,
  resolveRegenerateExecutionPlan,
} from "@/src/features/confirm/regenerate-policy";

describe("regenerate policy", () => {
  it("再来一张会忽略输入框内容并强制不参考旧图", () => {
    expect(
      resolveRegenerateExecutionPlan({
        mode: "variant",
        instruction: "  让标题更醒目一些  ",
      }),
    ).toEqual({
      mode: "variant",
      instruction: "",
      basedOnExistingImage: false,
    });
  });

  it("修改原图要求至少 8 个字，并基于旧图修改", () => {
    expect(isEditInstructionReady("太短")).toBe(false);
    expect(isEditInstructionReady("让整体路径更清晰明确")).toBe(true);

    expect(() =>
      resolveRegenerateExecutionPlan({
        mode: "edit",
        instruction: "太短",
      }),
    ).toThrow(`${minimumEditInstructionLength} 个字`);

    expect(
      resolveRegenerateExecutionPlan({
        mode: "edit",
        instruction: "  让整体路径更清晰明确  ",
      }),
    ).toEqual({
      mode: "edit",
      instruction: "让整体路径更清晰明确",
      basedOnExistingImage: true,
    });
  });
});
