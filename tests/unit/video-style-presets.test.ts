import { describe, expect, it } from "vitest";
import {
  supportedVideoStyleKeys,
  videoStylePromptLibrary,
} from "@/src/engine/prompts";
import { fromPublicPath, pathExists } from "@/src/server/utils/storage";

describe("videoStylePromptLibrary", () => {
  it("三种风格都配置了视频 prompt 版本与参考图", async () => {
    expect(supportedVideoStyleKeys).toEqual(["young-cartoon", "watercolor", "storybook"]);

    for (const styleKey of supportedVideoStyleKeys) {
      const preset = videoStylePromptLibrary[styleKey];
      expect(preset.promptVersion).toBe("p6_video_prompt_v1");
      expect(preset.referenceId).toMatch(/^style_ref_/);
      expect(preset.previewImage).toBe(preset.referencePublicPath);
      expect(await pathExists(fromPublicPath(preset.referencePublicPath))).toBe(true);
    }
  });
});
