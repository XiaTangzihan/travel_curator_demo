import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type Landmark,
  type MapRecord,
  type MapViewModel,
  type RunTrace,
} from "@/src/contracts/domain";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import {
  applyCuratedMapImport,
  hasBlockingCuratedMapImportErrors,
  prepareCuratedMapImport,
} from "@/src/server/curated-map-import";
import * as demoRepository from "@/src/server/repositories/demo-repository";
import {
  deleteMapArtifacts,
  getMapRecord,
  posterOutputPath,
  posterPublicPath,
  saveKnowledge,
  saveMapRecord,
  saveRenderedMap,
  saveRouteMarkdown,
  saveRunTrace,
  saveVideoArtifact,
  videoPublicPath,
} from "@/src/server/repositories/demo-repository";
import { pathExists, readJsonFile, runtimeAssetPublicPath, storagePaths, writeBinaryFile } from "@/src/server/utils/storage";

vi.mock("@/src/server/repositories/demo-repository", async () => {
  const actual = await vi.importActual<typeof import("@/src/server/repositories/demo-repository")>(
    "@/src/server/repositories/demo-repository",
  );

  return {
    ...actual,
    listMapRecords: vi.fn(actual.listMapRecords),
  };
});

const createdMapIds: string[] = [];
const createdImportRoots: string[] = [];

function createEvent(mapId: string): EventRecord {
  return {
    eventId: `evt_${mapId}`,
    commentId: `comment_${mapId}`,
    day: "2024:06:01",
    time: "10:20:00",
    commentText: `测试评论-${mapId}`,
    commentPictures: [{ url: "/mock/files/comments/example.jpg", name: "example.jpg" }],
    poiName: `测试地点-${mapId}`,
    poiLocation: "测试地址",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "美食",
    categoryL2: "小吃快餐",
    categoryL3: "快餐",
    authorName: "旅行者小夏",
  };
}

async function seedCuratedMap(params: {
  mapId: string;
  favorite: boolean;
  withVideo: boolean;
}) {
  const event = createEvent(params.mapId);
  const knowledge: Landmark[] = [{ name: "广州塔", visual: "塔身与夜景" }];
  const routeMarkdown = `# route ${params.mapId}`;
  const currentRunId = `run_generate_${params.mapId}`;
  const currentVideoRunId = params.withVideo ? `run_video_${params.mapId}` : undefined;
  const routePath = await saveRouteMarkdown(params.mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(params.mapId, knowledge);
  await writeBinaryFile(posterOutputPath(params.mapId, "png"), Buffer.from(`poster-${params.mapId}`));

  const baseRenderedMap = buildMapViewModel({
    mapId: params.mapId,
    datasetKey: "guangzhou",
    mapName: `地图-${params.mapId}`,
    city: "广州",
    style: "young-cartoon",
    posterPath: posterPublicPath(params.mapId, "png"),
    routeMarkdown,
    events: [event],
    knowledge,
  });

  const renderedMap: MapViewModel = {
    ...baseRenderedMap,
    isFavorite: params.favorite,
    currentVideoRunId,
    videoPath: params.withVideo ? videoPublicPath(params.mapId) : undefined,
    videoDurationSeconds: params.withVideo ? 5 : undefined,
    videoUpdatedAt: params.withVideo ? "2026-07-06T12:30:00.000Z" : undefined,
    videoModel: params.withVideo ? "seedance-1-5-pro" : "unknown",
  };
  await saveRenderedMap(params.mapId, renderedMap);

  if (params.withVideo) {
    await saveVideoArtifact(params.mapId, Buffer.from(`video-${params.mapId}`));
  }

  await saveMapRecord(
    mapRecordSchema.parse({
      mapId: params.mapId,
      datasetKey: "guangzhou",
      mapName: `地图-${params.mapId}`,
      city: "广州",
      style: "young-cartoon",
      isFavorite: params.favorite,
      imageModel: "seedream-5-0",
      currentVideoRunId,
      videoPath: params.withVideo ? videoPublicPath(params.mapId) : undefined,
      videoDurationSeconds: params.withVideo ? 5 : undefined,
      videoUpdatedAt: params.withVideo ? "2026-07-06T12:30:00.000Z" : undefined,
      videoModel: params.withVideo ? "seedance-1-5-pro" : "unknown",
      status: "confirmed",
      eventCount: 1,
      routePath,
      posterPath: posterPublicPath(params.mapId, "png"),
      knowledgePath,
      currentRunId,
      posterVersions: [
        {
          versionId: currentRunId,
          posterPath: posterPublicPath(params.mapId, "png"),
          runId: currentRunId,
          imageModel: "seedream-5-0",
          createdAt: "2026-07-06T12:20:00.000Z",
        },
      ],
      selectedPosterVersionId: currentRunId,
      selectedCommentIds: [event.commentId],
      createdAt: "2026-07-06T12:20:00.000Z",
      updatedAt: "2026-07-06T12:30:00.000Z",
    }),
  );

  await saveRunTrace(
    runTraceSchema.parse({
      runId: currentRunId,
      mapId: params.mapId,
      datasetKey: "guangzhou",
      status: "completed",
      stage: "confirm",
      imageModel: "seedream-5-0",
      warnings: [],
      artifacts: {
        routePath: runtimeAssetPublicPath("routes", `${params.mapId}.route.md`),
        posterPath: posterPublicPath(params.mapId, "png"),
        mapPath: runtimeAssetPublicPath("maps", `${params.mapId}.view.json`),
      },
      providerMode: "live",
      startedAt: "2026-07-06T12:20:00.000Z",
      endedAt: "2026-07-06T12:20:00.000Z",
    }),
  );

  if (params.withVideo && currentVideoRunId) {
    await saveRunTrace(
      runTraceSchema.parse({
        runId: currentVideoRunId,
        mapId: params.mapId,
        datasetKey: "guangzhou",
        status: "completed",
        stage: "video_generate",
        imageModel: "seedream-5-0",
        videoModel: "seedance-1-5-pro",
        videoDurationSeconds: 5,
        warnings: [],
        artifacts: {
          routePath: runtimeAssetPublicPath("routes", `${params.mapId}.route.md`),
          posterPath: posterPublicPath(params.mapId, "png"),
          videoPath: videoPublicPath(params.mapId),
          mapPath: runtimeAssetPublicPath("maps", `${params.mapId}.view.json`),
        },
        providerMode: "live",
        startedAt: "2026-07-06T12:30:00.000Z",
        endedAt: "2026-07-06T12:30:05.000Z",
      }),
    );
  }

  createdMapIds.push(params.mapId);
  const storedRecord = await getMapRecord(params.mapId);
  if (!storedRecord) {
    throw new Error(`failed to seed map ${params.mapId}`);
  }
  return storedRecord;
}

beforeEach(() => {
  vi.mocked(demoRepository.listMapRecords).mockReset();
});

afterEach(async () => {
  await Promise.all(createdMapIds.map((mapId) => deleteMapArtifacts(mapId)));
  createdMapIds.length = 0;

  await Promise.all(createdImportRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdImportRoots.length = 0;
});

describe("curated map import", () => {
  it("favorite preload dry-run 会扫描收藏地图并允许无视频地图通过", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const favoriteA = await seedCuratedMap({
      mapId: `favorite_a_${token}`,
      favorite: true,
      withVideo: true,
    });
    const favoriteB = await seedCuratedMap({
      mapId: `favorite_b_${token}`,
      favorite: true,
      withVideo: false,
    });
    await seedCuratedMap({
      mapId: `normal_c_${token}`,
      favorite: false,
      withVideo: true,
    });

    vi.mocked(demoRepository.listMapRecords).mockResolvedValue([favoriteA, favoriteB]);

    const prepared = await prepareCuratedMapImport({
      mode: "favorite_preload",
      dryRun: true,
      expectedCount: 2,
    });

    expect(prepared.report.totalSelected).toBe(2);
    expect(prepared.report.readyCount).toBe(2);
    expect(prepared.report.mapsWithVideo).toBe(1);
    expect(prepared.report.mapsWithoutVideo).toBe(1);
    expect(hasBlockingCuratedMapImportErrors(prepared.report)).toBe(false);
    expect(
      prepared.report.entries.find((entry) => entry.mapId === favoriteB.mapId)?.warnings.join(" "),
    ).toContain("无视频");
  });

  it("manual apply 只会导入显式指定的 mapId，并把绝对路径改写到目标 runtime root", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const targetMapId = `manual_target_${token}`;
    const otherMapId = `manual_other_${token}`;
    await seedCuratedMap({
      mapId: targetMapId,
      favorite: true,
      withVideo: true,
    });
    await seedCuratedMap({
      mapId: otherMapId,
      favorite: true,
      withVideo: false,
    });

    const targetRoot = path.join(storagePaths.runtimeDir, "imports", `unit-manual-${token}`);
    createdImportRoots.push(targetRoot);

    const report = await applyCuratedMapImport({
      mode: "manual",
      apply: true,
      mapIds: [targetMapId],
      targetRoot,
    });

    expect(hasBlockingCuratedMapImportErrors(report)).toBe(false);
    expect(report.targetRoot).toBe(targetRoot);
    expect(report.totalSelected).toBe(1);
    expect(report.entries[0]?.mapId).toBe(targetMapId);

    const importedMapRecordPath = path.join(targetRoot, "mock", "maps", `${targetMapId}.json`);
    const importedRenderedMapPath = path.join(targetRoot, "mock", "maps", `${targetMapId}.view.json`);
    const importedReportPath = path.join(targetRoot, "report.json");
    const importedRunPath = path.join(targetRoot, "mock", "runs", `run_generate_${targetMapId}.json`);
    const importedVideoRunPath = path.join(targetRoot, "mock", "runs", `run_video_${targetMapId}.json`);

    expect(await pathExists(importedMapRecordPath)).toBe(true);
    expect(await pathExists(importedRenderedMapPath)).toBe(true);
    expect(await pathExists(importedReportPath)).toBe(true);
    expect(await pathExists(importedRunPath)).toBe(true);
    expect(await pathExists(importedVideoRunPath)).toBe(true);
    expect(await pathExists(path.join(targetRoot, "mock", "maps", `${otherMapId}.json`))).toBe(false);

    const importedMapRecord = await readJsonFile<MapRecord>(importedMapRecordPath);
    const importedRenderedMap = await readJsonFile<MapViewModel>(importedRenderedMapPath);
    const importedRun = await readJsonFile<RunTrace>(importedRunPath);

    expect(importedMapRecord?.routePath).toBe(`/runtime/mock/routes/${targetMapId}.route.md`);
    expect(importedMapRecord?.knowledgePath).toBe(`/runtime/mock/routes/${targetMapId}.knowledge.json`);
    expect(importedMapRecord?.posterPath).toBe(`/runtime/mock/posters/${targetMapId}.png`);
    expect(importedMapRecord?.videoPath).toBe(`/runtime/mock/videos/${targetMapId}.mp4`);
    expect(importedRenderedMap?.posterPath).toBe(`/runtime/mock/posters/${targetMapId}.png`);
    expect(importedRenderedMap?.videoPath).toBe(`/runtime/mock/videos/${targetMapId}.mp4`);
    expect(importedRun?.artifacts?.posterPath).toBe(`/runtime/mock/posters/${targetMapId}.png`);
    expect(importedRun?.artifacts?.mapPath).toBe(`/runtime/mock/maps/${targetMapId}.view.json`);
  });
});
