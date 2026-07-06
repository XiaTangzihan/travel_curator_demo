import { youngCartoonStylePreset } from "@/src/engine/prompts/styles/young-cartoon";
import type { VideoStylePromptPreset } from "@/src/engine/prompts/video/shared";

export const youngCartoonVideoStylePreset = {
  key: youngCartoonStylePreset.key,
  label: youngCartoonStylePreset.label,
  description:
    "轻快灵动的旅行贴纸地图动感，强调路线流动感、湖面波纹和轻微呼吸感。",
  promptVersion: "p6_video_prompt_v1",
  prompt: [
    "整体运动人格是轻快、明亮、灵动。",
    "路线的流动感可以稍微更明显，湖面波纹、云朵漂移、小船滑行、食物贴纸和地点圆牌可以有极轻微的呼吸感或弹性起伏，但必须克制、整洁、圆润。",
    "所有动态应像一张可爱的旅行贴纸地图被轻轻唤醒，不要出现幼稚夸张的跳动，不要让食物卡片或数字标记发生大幅位移。",
  ].join("\n"),
  previewImage: youngCartoonStylePreset.previewImage,
  referenceId: youngCartoonStylePreset.referenceId,
  referencePublicPath: youngCartoonStylePreset.referencePublicPath,
} as const satisfies VideoStylePromptPreset;
