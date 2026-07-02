import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export const storybookStylePreset = {
  key: "storybook",
  label: "治愈绘本插画风",
  prompt: "画面使用温暖绘本质感、柔和配色与轻故事感构图，整体治愈、亲切、适合收藏。",
} as const satisfies StylePromptPreset;
