import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export const youngCartoonStylePreset = {
  key: "young-cartoon",
  label: "年轻卡通风",
  description: "明亮饱和，圆润 Q 版扁平图标与矢量描边，整体活泼、年轻、适合社交分享。",
  promptVersion: "phase4_reference_v1",
  prompt:
    "画面使用明亮饱和的配色、圆润的 Q 版扁平图标与清晰矢量描边，整体年轻、活泼、适合社交分享。",
  previewImage: "/ui-static/styles/young-cartoon.jpeg",
  referenceId: "style_ref_young_cartoon_20260702",
  referencePublicPath: "/ui-static/styles/young-cartoon.jpeg",
} as const satisfies StylePromptPreset;
