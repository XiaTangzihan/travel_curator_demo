export { buildVideoPrompt, type VideoPromptInput } from "@/src/engine/prompts/video/build";
export {
  buildCommonVideoPrompt,
  normalizeVideoDurationSeconds,
  supportedVideoDurationSeconds,
  type SupportedVideoDurationSeconds,
  type VideoStylePromptPreset,
} from "@/src/engine/prompts/video/shared";
export {
  getVideoStylePreset,
  supportedVideoStyleKeys,
  videoStylePromptLibrary,
  type SupportedVideoStyleKey,
} from "@/src/engine/prompts/video/styles";
