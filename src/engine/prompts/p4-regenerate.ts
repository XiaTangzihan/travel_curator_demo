import {
  buildPosterPrompt,
  type PosterPromptInput,
} from "@/src/engine/prompts/p3-poster";

export type RegeneratePosterPromptInput = PosterPromptInput & {
  instruction: string;
  basedOnExistingImage: boolean;
};

export function buildRegeneratePosterPrompt(params: RegeneratePosterPromptInput) {
  return buildPosterPrompt(params);
}
