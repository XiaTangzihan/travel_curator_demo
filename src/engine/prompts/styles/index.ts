import { demoConfig } from "@/src/config/demo";
import { storybookStylePreset } from "@/src/engine/prompts/styles/storybook";
import { watercolorStylePreset } from "@/src/engine/prompts/styles/watercolor";
import { youngCartoonStylePreset } from "@/src/engine/prompts/styles/young-cartoon";

export const supportedStyleKeys = ["young-cartoon", "watercolor", "storybook"] as const;

export type SupportedStyleKey = (typeof supportedStyleKeys)[number];

export const stylePromptLibrary = {
  "young-cartoon": youngCartoonStylePreset,
  watercolor: watercolorStylePreset,
  storybook: storybookStylePreset,
} as const;

export function getStylePreset(styleKey: string) {
  if ((supportedStyleKeys as readonly string[]).includes(styleKey)) {
    return stylePromptLibrary[styleKey as SupportedStyleKey];
  }

  return stylePromptLibrary[demoConfig.styleKey as SupportedStyleKey];
}
