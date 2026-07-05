export const selectableImageModelKeys = [
  "seedream-4-0",
  "seedream-4-5",
  "seedream-5-0",
] as const;

export const persistedImageModelKeys = [
  "unknown",
  "seedream-4-0",
  "seedream-4-5",
  "seedream-5-0",
] as const;

export type SelectableImageModel = (typeof selectableImageModelKeys)[number];
export type PersistedImageModel = (typeof persistedImageModelKeys)[number];

export const defaultImageModel: SelectableImageModel = "seedream-5-0";

export const imageModelLabels: Record<SelectableImageModel, string> = {
  "seedream-4-0": "SEEDREAM 4.0",
  "seedream-4-5": "SEEDREAM 4.5",
  "seedream-5-0": "SEEDREAM 5.0",
};

export function isSelectableImageModel(value: string): value is SelectableImageModel {
  return (selectableImageModelKeys as readonly string[]).includes(value);
}

export function resolveRequestedImageModel(value?: string | null): SelectableImageModel {
  if (value && isSelectableImageModel(value)) {
    return value;
  }

  return defaultImageModel;
}
