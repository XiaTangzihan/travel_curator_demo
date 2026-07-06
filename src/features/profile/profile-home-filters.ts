import type { DemoDatasetKey } from "@/src/config/demo";
import { supportedDatasetKeys } from "@/src/config/demo";
import {
  isSelectableImageModel,
  type SelectableImageModel,
} from "@/src/config/image-models";
import type { MapRecord } from "@/src/contracts/domain";
import {
  supportedStyleKeys,
  type SupportedStyleKey,
} from "@/src/engine/prompts";

export type ProfileImageModelFilter = SelectableImageModel | "all";
export type ProfileStyleFilter = SupportedStyleKey | "all";
export type ProfileDatasetFilter = DemoDatasetKey | "all";

export type ProfileHomeFilters = {
  datasetKey: ProfileDatasetFilter;
  imageModel: ProfileImageModelFilter;
  style: ProfileStyleFilter;
  hasVideo: boolean;
  favorite: boolean;
};

function isSupportedStyleKey(value: string): value is SupportedStyleKey {
  return (supportedStyleKeys as readonly string[]).includes(value);
}

export function resolveProfileHomeFilters(params: {
  dataset?: string;
  imageModel?: string;
  style?: string;
  hasVideo?: string;
  favorite?: string;
}): ProfileHomeFilters {
  const datasetKey =
    !params.dataset || params.dataset === "all"
      ? "all"
      : (supportedDatasetKeys as readonly string[]).includes(params.dataset)
        ? (params.dataset as DemoDatasetKey)
        : "all";
  const imageModel =
    params.imageModel === "all"
      ? "all"
      : isSelectableImageModel(params.imageModel ?? "")
        ? (params.imageModel as ProfileImageModelFilter)
        : "all";
  const style =
    params.style === "all"
      ? "all"
      : isSupportedStyleKey(params.style ?? "")
        ? (params.style as ProfileStyleFilter)
        : "all";
  const hasVideo = params.hasVideo === "1" || params.hasVideo === "true";
  const favorite = params.favorite === "1" || params.favorite === "true";

  return {
    datasetKey,
    imageModel,
    style,
    hasVideo,
    favorite,
  };
}

export function filterProfileMaps(
  maps: MapRecord[],
  filters: ProfileHomeFilters,
) {
  return maps.filter((map) => {
    if (filters.datasetKey !== "all" && map.datasetKey !== filters.datasetKey) {
      return false;
    }

    if (filters.imageModel !== "all" && map.imageModel !== filters.imageModel) {
      return false;
    }

    if (filters.style !== "all" && map.style !== filters.style) {
      return false;
    }

    if (filters.hasVideo && !(map.videoPath?.trim().length)) {
      return false;
    }

    if (filters.favorite && !map.isFavorite) {
      return false;
    }

    return true;
  });
}
