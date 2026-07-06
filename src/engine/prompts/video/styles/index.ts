import { demoConfig } from "@/src/config/demo";
import { supportedStyleKeys, type SupportedStyleKey } from "@/src/engine/prompts/styles";
import { storybookVideoStylePreset } from "@/src/engine/prompts/video/styles/storybook";
import { watercolorVideoStylePreset } from "@/src/engine/prompts/video/styles/watercolor";
import { youngCartoonVideoStylePreset } from "@/src/engine/prompts/video/styles/young-cartoon";

export const supportedVideoStyleKeys = supportedStyleKeys;

export type SupportedVideoStyleKey = SupportedStyleKey;

export const videoStylePromptLibrary = {
  "young-cartoon": youngCartoonVideoStylePreset,
  watercolor: watercolorVideoStylePreset,
  storybook: storybookVideoStylePreset,
} as const;

export function getVideoStylePreset(styleKey: string) {
  if ((supportedVideoStyleKeys as readonly string[]).includes(styleKey)) {
    return videoStylePromptLibrary[styleKey as SupportedVideoStyleKey];
  }

  return videoStylePromptLibrary[demoConfig.styleKey as SupportedVideoStyleKey];
}
