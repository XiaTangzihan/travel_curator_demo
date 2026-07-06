import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import {
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type Landmark,
} from "@/src/contracts/domain";
import {
  prunePosterVersionsForConfirm,
  selectMapPosterVersion,
} from "@/src/engine/pipelines/generate-map";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import {
  deleteMapArtifacts,
  getMapRecord,
  getRenderedMap,
  getRunTrace,
  posterOutputPath,
  posterPublicPath,
  saveKnowledge,
  saveMapRecord,
  saveRenderedMap,
  saveRouteMarkdown,
  saveRunTrace,
  setMapFavoriteState,
} from "@/src/server/repositories/demo-repository";
import { pathExists, runtimeAssetPublicPath, writeBinaryFile } from "@/src/server/utils/storage";

const createdMapIds: string[] = [];

function createEvent(eventId: string, commentId: string): EventRecord {
  return {
    eventId,
    commentId,
    day: "2024:06:01",
    time: "10:20:00",
    commentText: "测试评论",
    commentPictures: [{ url: "/mock/test.jpg", name: "test.jpg" }],
    poiName: "测试地点",
    poiLocation: "测试地址",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "美食",
    categoryL2: "小吃",
    categoryL3: "粤式小吃",
    authorName: "旅行者小夏",
  };
}

async function seedMapArtifacts(mapId: string, runId: string) {
  const knowledge: Landmark[] = [{ name: "广州塔", visual: "塔身与夜景" }];
  const events = [createEvent(`evt_${mapId}`, `rec_${mapId}`)];
  const routeMarkdown = "# test route";
  const routePath = await saveRouteMarkdown(mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(mapId, knowledge);
  await writeBinaryFile(posterOutputPath(mapId, "png"), Buffer.from("poster"));

  const mapViewModel = buildMapViewModel({
    mapId,
    mapName: `地图-${mapId}`,
    city: "广州",
    style: "young-cartoon",
    posterPath: posterPublicPath(mapId, "png"),
    routeMarkdown,
    events,
    knowledge,
  });
  await saveRenderedMap(mapId, mapViewModel);

  await saveMapRecord(
    mapRecordSchema.parse({
      mapId,
      mapName: `地图-${mapId}`,
      city: "广州",
      style: "young-cartoon",
      status: "confirmed",
      eventCount: events.length,
      routePath,
      posterPath: posterPublicPath(mapId, "png"),
      knowledgePath,
      currentRunId: runId,
      selectedCommentIds: events.map((event) => event.commentId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  );

  await saveRunTrace(
    runTraceSchema.parse({
      runId,
      mapId,
      status: "completed",
      stage: "generate",
      warnings: [],
      artifacts: {
        routePath: runtimeAssetPublicPath("routes", `${mapId}.route.md`),
        posterPath: posterPublicPath(mapId, "png"),
        mapPath: runtimeAssetPublicPath("maps", `${mapId}.view.json`),
      },
      providerMode: "live",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    }),
  );
}

afterEach(async () => {
  await Promise.all(createdMapIds.map((mapId) => deleteMapArtifacts(mapId)));
  createdMapIds.length = 0;
});

describe("deleteMapArtifacts", () => {
  it("会删除目标地图全部产物且不会误删其他地图", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const targetMapId = `test_delete_target_${token}`;
    const otherMapId = `test_delete_other_${token}`;
    const targetRunId = `run_target_${token}`;
    const otherRunId = `run_other_${token}`;
    createdMapIds.push(targetMapId, otherMapId);

    await seedMapArtifacts(targetMapId, targetRunId);
    await seedMapArtifacts(otherMapId, otherRunId);

    const result = await deleteMapArtifacts(targetMapId);

    expect(result?.verified).toBe(true);
    expect(result?.deletedRunIds).toContain(targetRunId);
    expect(await getMapRecord(targetMapId)).toBeNull();
    expect(await getRenderedMap(targetMapId)).toBeNull();
    expect(await getRunTrace(targetRunId)).toBeNull();
    expect(await pathExists(posterOutputPath(targetMapId, "png"))).toBe(false);

    expect(await getMapRecord(otherMapId)).not.toBeNull();
    expect(await getRenderedMap(otherMapId)).not.toBeNull();
    expect(await getRunTrace(otherRunId)).not.toBeNull();
    expect(await pathExists(posterOutputPath(otherMapId, "png"))).toBe(true);
  });

  it("会删除 mapRecord 上挂载的 posterVersions 与 run artifacts 中的版本化海报", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `test_delete_versioned_${token}`;
    const runId = `run_delete_versioned_${token}`;
    createdMapIds.push(mapId);

    await seedMapArtifacts(mapId, runId);
    const versionedPath = posterOutputPath(mapId, "png", "run_regen_001");
    await writeBinaryFile(versionedPath, Buffer.from("poster-versioned"));

    const mapRecord = await getMapRecord(mapId);
    if (!mapRecord) {
      throw new Error("seed mapRecord failed");
    }

    await saveMapRecord(
      mapRecordSchema.parse({
        ...mapRecord,
        posterVersions: [
          {
            versionId: runId,
            posterPath: posterPublicPath(mapId, "png"),
            runId,
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_001",
            posterPath: posterPublicPath(mapId, "png", "run_regen_001"),
            runId: "run_regen_001",
            createdAt: new Date().toISOString(),
          },
        ],
        selectedPosterVersionId: "run_regen_001",
      }),
    );

    await saveRunTrace(
      runTraceSchema.parse({
        runId: "run_regen_001",
        mapId,
        status: "completed",
        stage: "regenerate",
        warnings: [],
        artifacts: {
          posterPath: posterPublicPath(mapId, "png", "run_regen_001"),
        },
        providerMode: "live",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      }),
    );

    const result = await deleteMapArtifacts(mapId);

    expect(result?.verified).toBe(true);
    expect(await pathExists(versionedPath)).toBe(false);
    expect(await getRunTrace("run_regen_001")).toBeNull();
  });

  it("selectMapPosterVersion 会切换当前选中的海报版本", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `test_select_version_${token}`;
    const runId = `run_select_version_${token}`;
    createdMapIds.push(mapId);

    await seedMapArtifacts(mapId, runId);
    const currentPosterPath = posterPublicPath(mapId, "png", "run_regen_002");
    const currentPosterOutputPath = posterOutputPath(mapId, "png", "run_regen_002");
    await writeBinaryFile(currentPosterOutputPath, Buffer.from("poster-current"));

    const mapRecord = await getMapRecord(mapId);
    const renderedMap = await getRenderedMap(mapId);
    if (!mapRecord || !renderedMap) {
      throw new Error("seed map artifacts failed");
    }

    await saveMapRecord(
      mapRecordSchema.parse({
        ...mapRecord,
        posterVersions: [
          {
            versionId: runId,
            posterPath: posterPublicPath(mapId, "png"),
            runId,
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_002",
            posterPath: currentPosterPath,
            runId: "run_regen_002",
            createdAt: new Date().toISOString(),
          },
        ],
        selectedPosterVersionId: "run_regen_002",
        posterPath: currentPosterPath,
        currentRunId: "run_regen_002",
      }),
    );

    await saveRenderedMap(mapId, {
      ...renderedMap,
      posterPath: currentPosterPath,
    });

    const result = await selectMapPosterVersion({
      mapRecord: mapRecordSchema.parse({
        ...mapRecord,
        posterVersions: [
          {
            versionId: runId,
            posterPath: posterPublicPath(mapId, "png"),
            runId,
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_002",
            posterPath: currentPosterPath,
            runId: "run_regen_002",
            createdAt: new Date().toISOString(),
          },
        ],
        selectedPosterVersionId: "run_regen_002",
        posterPath: currentPosterPath,
        currentRunId: "run_regen_002",
      }),
      versionId: runId,
    });

    expect(result.mapRecord.posterPath).toBe(posterPublicPath(mapId, "png"));
    expect(result.mapRecord.currentRunId).toBe(runId);
    expect(result.mapRecord.selectedPosterVersionId).toBe(runId);

    const nextMapRecord = await getMapRecord(mapId);
    const nextRenderedMap = await getRenderedMap(mapId);
    expect(nextMapRecord?.posterPath).toBe(posterPublicPath(mapId, "png"));
    expect(nextRenderedMap?.posterPath).toBe(posterPublicPath(mapId, "png"));
  });

  it("prunePosterVersionsForConfirm 会只保留当前选中版本并删除未选中产物", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `test_prune_versions_${token}`;
    const runId = `run_prune_versions_${token}`;
    createdMapIds.push(mapId);

    await seedMapArtifacts(mapId, runId);
    const selectedPosterPath = posterPublicPath(mapId, "png", "run_regen_003");
    const selectedPosterOutputPath = posterOutputPath(mapId, "png", "run_regen_003");
    const stalePosterPath = posterPublicPath(mapId, "png", "run_regen_004");
    const stalePosterOutputPath = posterOutputPath(mapId, "png", "run_regen_004");
    await writeBinaryFile(selectedPosterOutputPath, Buffer.from("poster-selected"));
    await writeBinaryFile(stalePosterOutputPath, Buffer.from("poster-stale"));

    const mapRecord = await getMapRecord(mapId);
    if (!mapRecord) {
      throw new Error("seed mapRecord failed");
    }

    await saveMapRecord(
      mapRecordSchema.parse({
        ...mapRecord,
        posterPath: selectedPosterPath,
        currentRunId: "run_regen_003",
        posterVersions: [
          {
            versionId: runId,
            posterPath: posterPublicPath(mapId, "png"),
            runId,
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_003",
            posterPath: selectedPosterPath,
            runId: "run_regen_003",
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_004",
            posterPath: stalePosterPath,
            runId: "run_regen_004",
            createdAt: new Date().toISOString(),
          },
        ],
        selectedPosterVersionId: "run_regen_003",
      }),
    );

    const result = await prunePosterVersionsForConfirm({
      mapRecord: mapRecordSchema.parse({
        ...mapRecord,
        posterPath: selectedPosterPath,
        currentRunId: "run_regen_003",
        posterVersions: [
          {
            versionId: runId,
            posterPath: posterPublicPath(mapId, "png"),
            runId,
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_003",
            posterPath: selectedPosterPath,
            runId: "run_regen_003",
            createdAt: new Date().toISOString(),
          },
          {
            versionId: "run_regen_004",
            posterPath: stalePosterPath,
            runId: "run_regen_004",
            createdAt: new Date().toISOString(),
          },
        ],
        selectedPosterVersionId: "run_regen_003",
      }),
    });

    expect(result.posterVersions).toHaveLength(1);
    expect(result.posterVersions[0].versionId).toBe("run_regen_003");
    expect(await pathExists(selectedPosterOutputPath)).toBe(true);
    expect(await pathExists(stalePosterOutputPath)).toBe(false);
  });

  it("setMapFavoriteState 会同时更新 mapRecord 与 renderedMap 的收藏状态", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `test_favorite_state_${token}`;
    const runId = `run_favorite_state_${token}`;
    createdMapIds.push(mapId);

    await seedMapArtifacts(mapId, runId);

    const result = await setMapFavoriteState(mapId, true);

    expect(result).toMatchObject({
      mapId,
      favorite: true,
      updatedRecord: true,
      updatedRenderedMap: true,
    });

    const [mapRecord, renderedMap] = await Promise.all([
      getMapRecord(mapId),
      getRenderedMap(mapId),
    ]);

    expect(mapRecord?.isFavorite).toBe(true);
    expect(renderedMap?.isFavorite).toBe(true);
  });

  it("getMapRecord 会把旧 public/mock 绝对路径归一化为 runtime 路径", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `test_runtime_path_normalization_${token}`;
    const runId = `run_runtime_path_normalization_${token}`;
    createdMapIds.push(mapId);

    await seedMapArtifacts(mapId, runId);
    const seededRecord = await getMapRecord(mapId);
    if (!seededRecord) {
      throw new Error("seed mapRecord failed");
    }

    const legacyRoutePath = path.join(process.cwd(), "public", "mock", "routes", `${mapId}.route.md`);
    const legacyKnowledgePath = path.join(process.cwd(), "public", "mock", "routes", `${mapId}.knowledge.json`);

    await saveMapRecord(
      mapRecordSchema.parse({
        ...seededRecord,
        mapId,
        routePath: legacyRoutePath,
        knowledgePath: legacyKnowledgePath,
      }),
    );

    const normalized = await getMapRecord(mapId);

    expect(normalized?.routePath).toBe(`/runtime/mock/routes/${mapId}.route.md`);
    expect(normalized?.knowledgePath).toBe(`/runtime/mock/routes/${mapId}.knowledge.json`);
  });
});
