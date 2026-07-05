export const minimumEditInstructionLength = 8;

export type RegenerateMode = "variant" | "edit";

export function normalizeRegenerateInstruction(instruction: string) {
  return instruction.trim();
}

export function isEditInstructionReady(instruction: string) {
  return normalizeRegenerateInstruction(instruction).length >= minimumEditInstructionLength;
}

export function resolveRegenerateExecutionPlan(params: {
  mode: RegenerateMode;
  instruction: string;
}) {
  const normalizedInstruction = normalizeRegenerateInstruction(params.instruction);

  if (params.mode === "edit") {
    if (normalizedInstruction.length < minimumEditInstructionLength) {
      throw new Error(`修改原图时，修改 Prompt 至少需要 ${minimumEditInstructionLength} 个字。`);
    }

    return {
      mode: params.mode,
      instruction: normalizedInstruction,
      basedOnExistingImage: true,
    } as const;
  }

  return {
    mode: params.mode,
    instruction: "",
    basedOnExistingImage: false,
  } as const;
}
