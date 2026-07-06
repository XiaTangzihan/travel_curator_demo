export const selectableVideoModelKeys = [
  "seedance-1-5-pro",
  "seedance-1-0-pro-fast",
] as const;

export const persistedVideoModelKeys = [
  "unknown",
  "seedance-1-5-pro",
  "seedance-1-0-pro-fast",
] as const;

export type SelectableVideoModel = (typeof selectableVideoModelKeys)[number];
export type PersistedVideoModel = (typeof persistedVideoModelKeys)[number];

export const defaultVideoModel: SelectableVideoModel = "seedance-1-5-pro";

export const videoModelLabels: Record<SelectableVideoModel, string> = {
  "seedance-1-5-pro": "Seedance 1.5 Pro",
  "seedance-1-0-pro-fast": "Seedance 1.0 Pro Fast",
};

export function isSelectableVideoModel(value: string): value is SelectableVideoModel {
  return (selectableVideoModelKeys as readonly string[]).includes(value);
}

export function resolveRequestedVideoModel(value?: string | null): SelectableVideoModel {
  if (value && isSelectableVideoModel(value)) {
    return value;
  }

  return defaultVideoModel;
}
