import { buildCommonVideoPrompt, normalizeVideoDurationSeconds } from "@/src/engine/prompts/video/shared";
import { getVideoStylePreset } from "@/src/engine/prompts/video/styles";

export type VideoPromptInput = {
  styleKey: string;
  durationSeconds: number;
  promptInstruction?: string;
};

export function buildVideoPrompt(params: VideoPromptInput) {
  const durationSeconds = normalizeVideoDurationSeconds(params.durationSeconds);
  const stylePreset = getVideoStylePreset(params.styleKey);
  const stylePromptInstruction = params.promptInstruction ?? stylePreset.prompt;

  return [
    buildCommonVideoPrompt({ durationSeconds }),
    `视频风格：${stylePreset.label}`,
    stylePromptInstruction,
    `风格参考图：${stylePreset.referenceId}；仅用于继承当前地图风格，不得改写原图中的文字、编号、路线布局和信息结构。`,
  ].join("\n");
}
