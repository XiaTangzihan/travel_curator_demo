import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export const storybookStylePreset = {
  key: "storybook",
  label: "治愈绘本插画风",
  description: "暖棕、墨绿、土黄、雾蓝低饱和配色，带纸质纹理与手绘颗粒感，整体温馨、有故事感。",
  promptVersion: "phase4_reference_v1",
  prompt:
    "画面使用温暖低饱和的暖棕、墨绿、土黄、雾蓝配色，带纸质纹理、细腻线描淡彩与手绘颗粒感，整体温馨、亲切、有故事感。",
  previewImage: "/ui-static/styles/storybook.jpeg",
  referenceId: "style_ref_storybook_20260702",
  referencePublicPath: "/ui-static/styles/storybook.jpeg",
} as const satisfies StylePromptPreset;
