import { storybookStylePreset } from "@/src/engine/prompts/styles/storybook";
import type { VideoStylePromptPreset } from "@/src/engine/prompts/video/shared";

export const storybookVideoStylePreset = {
  key: storybookStylePreset.key,
  label: storybookStylePreset.label,
  description: "纸感呼吸的绘本视频动感，强调热气、草木和轻微生活气息。",
  promptVersion: "p6_video_prompt_v1",
  prompt: [
    "整体运动人格是温和、安静、有故事感。",
    "优先表现纸面呼吸感、草木轻摆、湖岸与湿地的微风、食物热气缓慢上升，以及人物或场景中极轻的生活气息。",
    "所有动态都应像一本旅行绘本被翻开后慢慢活过来，细腻、含蓄、温暖。不要出现商业广告式镜头，不要高饱和，不要做成数字感很强的动效。",
  ].join("\n"),
  previewImage: storybookStylePreset.previewImage,
  referenceId: storybookStylePreset.referenceId,
  referencePublicPath: storybookStylePreset.referencePublicPath,
} as const satisfies VideoStylePromptPreset;
