import { describe, expect, it } from "vitest";
import { stylePromptLibrary, supportedStyleKeys } from "@/src/engine/prompts";
import { fromPublicPath, pathExists } from "@/src/server/utils/storage";

describe("stylePromptLibrary", () => {
  it("三种风格都配置了参考图与 prompt 版本", async () => {
    expect(supportedStyleKeys).toEqual(["young-cartoon", "watercolor", "storybook"]);

    for (const styleKey of supportedStyleKeys) {
      const preset = stylePromptLibrary[styleKey];
      expect(preset.promptVersion).toBe("phase4_reference_v1");
      expect(preset.referenceId).toMatch(/^style_ref_/);
      expect(preset.previewImage).toBe(preset.referencePublicPath);
      expect(await pathExists(fromPublicPath(preset.referencePublicPath))).toBe(true);
    }
  });
});
