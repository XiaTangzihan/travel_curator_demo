import { describe, expect, it } from "vitest";
import type { MapRecord } from "@/src/contracts/domain";
import {
  filterProfileMaps,
  resolveProfileHomeFilters,
} from "@/src/features/profile/profile-home-filters";

function createMapRecord(params: Partial<MapRecord> & Pick<MapRecord, "mapId">): MapRecord {
  return {
    mapId: params.mapId,
    datasetKey: params.datasetKey ?? "guangzhou",
    mapName: params.mapName ?? `地图-${params.mapId}`,
    city: params.city ?? "广州",
    style: params.style ?? "young-cartoon",
    imageModel: params.imageModel ?? "unknown",
    status: params.status ?? "draft",
    eventCount: params.eventCount ?? 3,
    routePath: params.routePath ?? `/mock/routes/${params.mapId}.route.md`,
    posterPath: params.posterPath ?? `/mock/posters/${params.mapId}.png`,
    knowledgePath:
      params.knowledgePath ?? `/mock/routes/${params.mapId}.knowledge.json`,
    currentRunId: params.currentRunId ?? `run_${params.mapId}`,
    posterVersions: params.posterVersions ?? [],
    selectedPosterVersionId: params.selectedPosterVersionId,
    selectedCommentIds: params.selectedCommentIds ?? [],
    createdAt: params.createdAt ?? "2026-07-05T00:00:00.000Z",
    updatedAt: params.updatedAt ?? "2026-07-05T00:00:00.000Z",
    lastInstruction: params.lastInstruction,
  };
}

describe("profile home filters", () => {
  it("会把非法 query 兜底到 dataset 默认值和 all", () => {
    expect(
      resolveProfileHomeFilters({
        dataset: "unknown-city",
        imageModel: "bad-model",
        style: "bad-style",
      }),
    ).toEqual({
      datasetKey: "all",
      imageModel: "all",
      style: "all",
    });
  });

  it("会把空 dataset 解析为全部目的地", () => {
    expect(resolveProfileHomeFilters({})).toEqual({
      datasetKey: "all",
      imageModel: "all",
      style: "all",
    });
  });

  it("会按 dataset、imageModel、style 三段过滤地图", () => {
    const maps = [
      createMapRecord({
        mapId: "map_gz_a",
        datasetKey: "guangzhou",
        imageModel: "seedream-5-0",
        style: "young-cartoon",
      }),
      createMapRecord({
        mapId: "map_gz_b",
        datasetKey: "guangzhou",
        imageModel: "unknown",
        style: "young-cartoon",
      }),
      createMapRecord({
        mapId: "map_gz_c",
        datasetKey: "guangzhou",
        imageModel: "seedream-4-5",
        style: "storybook",
      }),
      createMapRecord({
        mapId: "map_hz_a",
        datasetKey: "hangzhou",
        imageModel: "seedream-5-0",
        style: "young-cartoon",
      }),
    ];

    expect(
      filterProfileMaps(maps, {
        datasetKey: "guangzhou",
        imageModel: "all",
        style: "all",
      }).map((map) => map.mapId),
    ).toEqual(["map_gz_a", "map_gz_b", "map_gz_c"]);

    expect(
      filterProfileMaps(maps, {
        datasetKey: "all",
        imageModel: "all",
        style: "all",
      }).map((map) => map.mapId),
    ).toEqual(["map_gz_a", "map_gz_b", "map_gz_c", "map_hz_a"]);

    expect(
      filterProfileMaps(maps, {
        datasetKey: "guangzhou",
        imageModel: "seedream-5-0",
        style: "all",
      }).map((map) => map.mapId),
    ).toEqual(["map_gz_a"]);

    expect(
      filterProfileMaps(maps, {
        datasetKey: "guangzhou",
        imageModel: "seedream-4-5",
        style: "storybook",
      }).map((map) => map.mapId),
    ).toEqual(["map_gz_c"]);
  });
});
