import { watercolorStylePreset } from "@/src/engine/prompts/styles/watercolor";
import type { VideoStylePromptPreset } from "@/src/engine/prompts/video/shared";

export const watercolorVideoStylePreset = {
  key: watercolorStylePreset.key,
  label: watercolorStylePreset.label,
  description: "湿润流动的水彩视频动感，强调雾气、波纹和植物轻摆。",
  promptVersion: "p6_video_prompt_v1",
  prompt: [
    "整体运动人格是轻柔、湿润、缓慢。",
    "优先表现水面微波、远山雾气、柳树和芦苇的轻摆、空气中若有若无的流动感。",
    "所有动态都应更慢、更淡、更软，像水彩颜料在纸面上缓缓洇开。不要出现清晰硬边的运动轨迹，不要出现卡通弹跳，不要让画面节奏变快或颜色变亮。",
  ].join("\n"),
  previewImage: watercolorStylePreset.previewImage,
  referenceId: watercolorStylePreset.referenceId,
  referencePublicPath: watercolorStylePreset.referencePublicPath,
} as const satisfies VideoStylePromptPreset;
