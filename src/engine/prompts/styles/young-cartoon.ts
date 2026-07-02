import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export const youngCartoonStylePreset = {
  key: "young-cartoon",
  label: "年轻卡通风",
  prompt:
    "画面使用明亮饱和配色、圆润 Q 版图标、清晰描边，整体年轻、活泼、适合社交分享。",
} as const satisfies StylePromptPreset;
