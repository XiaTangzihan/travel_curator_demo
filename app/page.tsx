import { ProfileHome } from "@/src/features/profile/profile-home";
import { getDemoDataset, supportedDatasetKeys } from "@/src/config/demo";
import {
  imageModelLabels,
  selectableImageModelKeys,
} from "@/src/config/image-models";
import { stylePromptLibrary } from "@/src/engine/prompts";
import {
  filterProfileMaps,
  resolveProfileHomeFilters,
} from "@/src/features/profile/profile-home-filters";
import { getRawDataset, listMapRecords } from "@/src/server/repositories/demo-repository";

type HomeProps = {
  searchParams: Promise<{
    dataset?: string;
    imageModel?: string;
    style?: string;
    hasVideo?: string;
  }>;
};

export default async function Home(props: HomeProps) {
  const searchParams = await props.searchParams;
  const filters = resolveProfileHomeFilters(searchParams);
  const [rawDatasets, maps] = await Promise.all([
    Promise.all(
      (filters.datasetKey === "all"
        ? supportedDatasetKeys
        : [filters.datasetKey]
      ).map((datasetKey) => getRawDataset(datasetKey)),
    ),
    listMapRecords(),
  ]);
  const filteredMaps = filterProfileMaps(maps, filters);
  const rawCount = rawDatasets.reduce(
    (sum, rawDataset) => sum + (rawDataset?.reviews.length ?? 0),
    0,
  );

  return (
    <ProfileHome
      maps={filteredMaps}
      rawCount={rawCount}
      activeDatasetKey={filters.datasetKey}
      activeImageModel={filters.imageModel}
      activeStyle={filters.style}
      activeHasVideo={filters.hasVideo}
      datasetOptions={supportedDatasetKeys.map((key) => getDemoDataset(key))}
      imageModelOptions={selectableImageModelKeys.map((key) => ({
        key,
        label: imageModelLabels[key],
      }))}
      styleOptions={Object.entries(stylePromptLibrary).map(([key, preset]) => ({
        key,
        label: preset.label,
      }))}
    />
  );
}
