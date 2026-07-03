import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export const watercolorStylePreset = {
  key: "watercolor",
  label: "清新水彩风",
  description: "淡雅低饱和的青绿、湖蓝、米白配色；湿润水彩笔触与晕染过渡，整体空灵、治愈。",
  promptVersion: "phase4_reference_v1",
  prompt:
    "画面使用淡雅低饱和的青绿、湖蓝、米白配色，色块带自然晕染过渡，带有湿润水彩笔触，整体空灵、治愈、轻盈。",
  previewImage: "/ui-static/styles/watercolor.jpeg",
  referenceId: "style_ref_watercolor_20260702",
  referencePublicPath: "/ui-static/styles/watercolor.jpeg",
} as const satisfies StylePromptPreset;
