import { describe, expect, it } from "vitest";
import {
  buildVideoPrompt,
  getVideoStylePreset,
  normalizeVideoDurationSeconds,
} from "@/src/engine/prompts";

describe("buildVideoPrompt", () => {
  it("会拼接通用提示词和风格提示词，并带上音频与版式约束", () => {
    const prompt = buildVideoPrompt({
      styleKey: "young-cartoon",
      durationSeconds: 7,
    });

    expect(prompt).toContain("基于输入的旅行地图插画生成一段 7 秒短视频。");
    expect(prompt).toContain("所有文字必须保持清晰可读");
    expect(prompt).toContain("生成自然环境音");
    expect(prompt).toContain("视频风格：年轻卡通风");
    expect(prompt).toContain("整体运动人格是轻快、明亮、灵动。");
    expect(prompt).toContain("style_ref_young_cartoon_20260702");
  });

  it("会把不合法时长回退到 5 秒，并对未知 styleKey 做默认兜底", () => {
    const prompt = buildVideoPrompt({
      styleKey: "unknown-style",
      durationSeconds: 11,
    });

    expect(normalizeVideoDurationSeconds(11)).toBe(5);
    expect(getVideoStylePreset("unknown-style").key).toBe("young-cartoon");
    expect(prompt).toContain("基于输入的旅行地图插画生成一段 5 秒短视频。");
    expect(prompt).toContain("视频风格：年轻卡通风");
  });
});
