import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export const watercolorStylePreset = {
  key: "watercolor",
  label: "清新水彩风",
  prompt: "画面使用清透水彩笔触、柔和留白与低饱和层次，整体轻盈、通透、安静。",
} as const satisfies StylePromptPreset;
