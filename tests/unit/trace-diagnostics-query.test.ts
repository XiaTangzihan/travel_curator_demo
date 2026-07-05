import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type Landmark,
} from "@/src/contracts/domain";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import {
  deleteMapArtifacts,
  posterOutputPath,
  posterPublicPath,
  saveKnowledge,
  saveMapRecord,
  saveRenderedMap,
  saveRouteMarkdown,
  saveRunTrace,
} from "@/src/server/repositories/demo-repository";
import {
  getTraceMapDetailViewModel,
  getTraceOverviewViewModel,
} from "@/src/server/trace-diagnostics/queries";
import {
  deleteFilePaths,
  storagePaths,
  writeBinaryFile,
} from "@/src/server/utils/storage";

const createdMapIds: string[] = [];
const createdRunIds: string[] = [];

function createEvent(eventId: string, commentId: string): EventRecord {
  return {
    eventId,
    commentId,
    day: "2025:07:01",
    time: "12:30:00",
    commentText: "评论内容用于测试 trace diagnostics。",
    commentPictures: [{ url: "/mock/files/comments/test_trace_001.jpeg", name: "test_trace_001.jpeg" }],
    poiName: "测试地点",
    poiLocation: "测试地址",
    poiProvince: "浙江省",
    poiCity: "杭州市",
    poiDistrict: "萧山区",
    categoryL1: "美食",
    categoryL2: "地方菜",
    categoryL3: "本帮江浙菜",
    subject: "江南菜肴、清鲜",
    avoid: ["楼层标识", "店招文字", "价格标签"],
    authorName: "旅行者小夏",
  };
}

function buildValidRouteMarkdown(params: {
  mapName: string;
  city: string;
  event: EventRecord;
  knowledgeCount: number;
}) {
  return `---
map_name: ${params.mapName}
city: ${params.city}
style: 年轻卡通风
days: 1
event_count: 1
knowledge_count: ${params.knowledgeCount}
---

## Important Rules
- 所有 event 配图统一服从给定 style，不得自行发散风格。
- 背景地标只作为背景视觉参考，不给地标配文。
- 每个 event 的 subject 必须是 1 个简短中文名词和 1 个简短中文形容词，用顿号连接，顺序固定为“名词、形容词”。
- 每个 event 的 avoid 必须是 3-5 个要避免的意象词。

# Day 1 (${params.event.day})

## Event 1 · ${params.event.poiName}
- sequence: 1
- poi: ${params.event.poiName}
- short_name: 测试地点
- 类目: ${params.event.categoryL1} / ${params.event.categoryL2} / ${params.event.categoryL3}
- 文案: ${params.event.commentText}
- 配图: ${params.event.commentPictures[0]?.url}
- subject: ${params.event.subject}
- avoid: ${(params.event.avoid ?? []).join(", ")}
`;
}

async function seedTraceScenario(token: string) {
  const mapId = `trace_diag_${token}`;
  const generateRunId = `run_generate_${token}`;
  const regenerateRunId = `run_regenerate_${token}`;
  const confirmRunId = `run_confirm_${token}`;
  createdMapIds.push(mapId);
  createdRunIds.push(generateRunId, regenerateRunId, confirmRunId);

  const event = createEvent(`evt_${token}`, `comment_${token}`);
  const knowledge: Landmark[] = [{ name: "湘湖旅游度假区", visual: "滨湖风光与江南水岸" }];
  const routeMarkdown = buildValidRouteMarkdown({
    mapName: `地图-${token}`,
    city: "萧山",
    event,
    knowledgeCount: knowledge.length,
  });

  const routePath = await saveRouteMarkdown(mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(mapId, knowledge);
  const selectedPosterOutputPath = posterOutputPath(mapId, "png", regenerateRunId);
  const selectedPosterPublicPath = posterPublicPath(mapId, "png", regenerateRunId);
  await writeBinaryFile(selectedPosterOutputPath, Buffer.from("selected-poster"));

  const mapViewModel = buildMapViewModel({
    mapId,
    datasetKey: "hangzhou",
    mapName: `地图-${token}`,
    city: "萧山",
    style: "young-cartoon",
    posterPath: selectedPosterPublicPath,
    routeMarkdown,
    events: [event],
    knowledge,
  });
  await saveRenderedMap(mapId, mapViewModel);

  await saveMapRecord(
    mapRecordSchema.parse({
      mapId,
      datasetKey: "hangzhou",
      mapName: `地图-${token}`,
      city: "萧山",
      style: "young-cartoon",
      status: "confirmed",
      eventCount: 1,
      routePath,
      posterPath: selectedPosterPublicPath,
      knowledgePath,
      currentRunId: confirmRunId,
      posterVersions: [
        {
          versionId: generateRunId,
          posterPath: posterPublicPath(mapId, "png"),
          runId: generateRunId,
          createdAt: "2026-07-05T05:30:59.285Z",
        },
        {
          versionId: regenerateRunId,
          posterPath: selectedPosterPublicPath,
          runId: regenerateRunId,
          createdAt: "2026-07-05T05:34:36.985Z",
        },
      ],
      selectedPosterVersionId: regenerateRunId,
      selectedCommentIds: [event.commentId],
      createdAt: "2026-07-05T05:30:59.285Z",
      updatedAt: "2026-07-05T05:39:37.081Z",
      lastInstruction: "",
    }),
  );

  await saveRunTrace(
    runTraceSchema.parse({
      runId: generateRunId,
      mapId,
      datasetKey: "hangzhou",
      status: "completed",
      stage: "generate",
      styleKey: "young-cartoon",
      promptVersion: "phase4_reference_v1",
      referenceIds: ["style_ref_young_cartoon_20260702"],
      warnings: [],
      artifacts: {
        rawPath: "/mock/raw/hangzhou.raw.json",
        eventsPath: "/mock/events/hangzhou.events.json",
        routePath: `/mock/routes/${mapId}.route.md`,
        posterPath: posterPublicPath(mapId, "png"),
        mapPath: `/mock/maps/${mapId}.view.json`,
      },
      providerMode: "live",
      startedAt: "2026-07-05T05:30:59.285Z",
      endedAt: "2026-07-05T05:32:52.400Z",
    }),
  );

  await saveRunTrace(
    runTraceSchema.parse({
      runId: regenerateRunId,
      mapId,
      datasetKey: "hangzhou",
      status: "completed",
      stage: "regenerate",
      basedOnExistingImage: false,
      promptInstruction: "",
      styleKey: "young-cartoon",
      promptVersion: "phase4_reference_v1",
      referenceIds: ["style_ref_young_cartoon_20260702"],
      warnings: [],
      artifacts: {
        routePath: `/mock/routes/${mapId}.route.md`,
        posterPath: selectedPosterPublicPath,
        mapPath: `/mock/maps/${mapId}.view.json`,
      },
      providerMode: "live",
      startedAt: "2026-07-05T05:34:36.985Z",
      endedAt: "2026-07-05T05:35:40.652Z",
    }),
  );

  await saveRunTrace(
    runTraceSchema.parse({
      runId: confirmRunId,
      mapId,
      datasetKey: "hangzhou",
      status: "completed",
      stage: "confirm",
      warnings: [],
      artifacts: {
        routePath: `/mock/routes/${mapId}.route.md`,
        posterPath: selectedPosterPublicPath,
        mapPath: `/mock/maps/${mapId}.view.json`,
      },
      providerMode: "live",
      startedAt: "2026-07-05T05:39:37.088Z",
      endedAt: "2026-07-05T05:39:37.088Z",
    }),
  );

  return {
    mapId,
    generateRunId,
    regenerateRunId,
    confirmRunId,
    selectedPosterPublicPath,
  };
}

afterEach(async () => {
  await Promise.all(createdMapIds.map((mapId) => deleteMapArtifacts(mapId)));
  if (createdRunIds.length) {
    await deleteFilePaths(
      createdRunIds.map((runId) => path.join(storagePaths.runs, `${runId}.json`)),
    );
  }
  createdMapIds.length = 0;
  createdRunIds.length = 0;
});

describe.sequential("trace diagnostics queries", () => {
  it("能正确拆分当前选中海报来源 run 与最新 lifecycle run，并按 dataset 回推 raw/events", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const seeded = await seedTraceScenario(token);

    const detail = await getTraceMapDetailViewModel(seeded.mapId);

    expect(detail).not.toBeNull();
    expect(detail?.currentRunIdRaw).toBe(seeded.confirmRunId);
    expect(detail?.selectedPosterVersion?.versionId).toBe(seeded.regenerateRunId);
    expect(detail?.selectedPosterSourceRun?.runId).toBe(seeded.regenerateRunId);
    expect(detail?.latestLifecycleRun?.runId).toBe(seeded.confirmRunId);
    expect(detail?.currentArtifacts.raw.publicPath).toBe("/mock/raw/hangzhou.raw.json");
    expect(detail?.currentArtifacts.raw.source).toBe("dataset_inferred");
    expect(detail?.currentArtifacts.events.publicPath).toBe("/mock/events/hangzhou.events.json");
    expect(detail?.currentArtifacts.events.source).toBe("dataset_inferred");
  });

  it("能输出结构化 AI Contract，并把被确认流程裁剪的旧候选版本识别为 pruned", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const seeded = await seedTraceScenario(token);

    const detail = await getTraceMapDetailViewModel(seeded.mapId);
    if (!detail) {
      throw new Error("detail should exist");
    }

    expect(detail.aiContract.available).toBe(true);
    expect(detail.aiContract.importantRules.length).toBeGreaterThan(0);
    expect(detail.aiContract.events[0]?.subject).toBe("江南菜肴、清鲜");
    expect(detail.aiContract.events[0]?.avoid).toEqual(["楼层标识", "店招文字", "价格标签"]);

    const generateRun = detail.runHistory.find((run) => run.runId === seeded.generateRunId);
    const regenerateRun = detail.runHistory.find((run) => run.runId === seeded.regenerateRunId);

    expect(generateRun?.posterAssetState).toBe("pruned");
    expect(regenerateRun?.posterAssetState).toBe("present");
  });

  it("overview 能纳入 dataset 统计，并统计 orphan run", async () => {
    const before = await getTraceOverviewViewModel();
    const beforeHangzhou = before.datasetStats.find((item) => item.datasetKey === "hangzhou");
    if (!beforeHangzhou) {
      throw new Error("hangzhou stats missing");
    }

    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const seeded = await seedTraceScenario(token);
    const orphanRunId = `run_orphan_${token}`;
    createdRunIds.push(orphanRunId);

    await saveRunTrace(
      runTraceSchema.parse({
        runId: orphanRunId,
        mapId: `missing_map_${token}`,
        datasetKey: "hangzhou",
        status: "failed",
        stage: "generate",
        warnings: ["测试 orphan run"],
        artifacts: {},
        providerMode: "fallback",
        startedAt: "2026-07-05T06:00:00.000Z",
        endedAt: "2026-07-05T06:00:20.000Z",
      }),
    );

    const after = await getTraceOverviewViewModel();
    const afterHangzhou = after.datasetStats.find((item) => item.datasetKey === "hangzhou");
    if (!afterHangzhou) {
      throw new Error("hangzhou stats missing after seed");
    }

    expect(after.globalStats.orphanRunCount).toBeGreaterThanOrEqual(
      before.globalStats.orphanRunCount + 1,
    );
    expect(afterHangzhou.mapCount).toBe(beforeHangzhou.mapCount + 1);
    expect(afterHangzhou.runCount).toBe(beforeHangzhou.runCount + 4);
    expect(afterHangzhou.orphanRunCount).toBeGreaterThanOrEqual(
      beforeHangzhou.orphanRunCount + 1,
    );
    expect(after.mapItems.some((item) => item.mapId === seeded.mapId)).toBe(true);
  });

  it("当 route parser 失败时，会在 detail 中给出 AI Contract 错误与完整性告警", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `trace_diag_invalid_route_${token}`;
    const runId = `run_invalid_route_${token}`;
    createdMapIds.push(mapId);
    createdRunIds.push(runId);

    const event = createEvent(`evt_invalid_${token}`, `comment_invalid_${token}`);
    const knowledge: Landmark[] = [{ name: "湘湖旅游度假区", visual: "滨湖风光与江南水岸" }];
    const invalidRouteMarkdown = `---
map_name: 地图-${token}
city: 萧山
style: 年轻卡通风
days: 1
event_count: 1
knowledge_count: 1
---

## Rules
- 缺少 Important Rules 标题
`;
    const routePath = await saveRouteMarkdown(mapId, invalidRouteMarkdown);
    const knowledgePath = await saveKnowledge(mapId, knowledge);
    const currentPosterPath = posterPublicPath(mapId, "png");
    await writeBinaryFile(posterOutputPath(mapId, "png"), Buffer.from("poster"));

    const mapViewModel = buildMapViewModel({
      mapId,
      datasetKey: "hangzhou",
      mapName: `地图-${token}`,
      city: "萧山",
      style: "young-cartoon",
      posterPath: currentPosterPath,
      routeMarkdown: invalidRouteMarkdown,
      events: [event],
      knowledge,
    });
    await saveRenderedMap(mapId, mapViewModel);

    await saveMapRecord(
      mapRecordSchema.parse({
        mapId,
        datasetKey: "hangzhou",
        mapName: `地图-${token}`,
        city: "萧山",
        style: "young-cartoon",
        status: "draft",
        eventCount: 1,
        routePath,
        posterPath: currentPosterPath,
        knowledgePath,
        currentRunId: runId,
        selectedCommentIds: [event.commentId],
        createdAt: "2026-07-05T05:30:59.285Z",
        updatedAt: "2026-07-05T05:32:52.400Z",
      }),
    );

    await saveRunTrace(
      runTraceSchema.parse({
        runId,
        mapId,
        datasetKey: "hangzhou",
        status: "completed",
        stage: "generate",
        warnings: [],
        artifacts: {
          rawPath: "/mock/raw/hangzhou.raw.json",
          eventsPath: "/mock/events/hangzhou.events.json",
          routePath: `/mock/routes/${mapId}.route.md`,
          posterPath: currentPosterPath,
          mapPath: `/mock/maps/${mapId}.view.json`,
        },
        providerMode: "live",
        startedAt: "2026-07-05T05:30:59.285Z",
        endedAt: "2026-07-05T05:32:52.400Z",
      }),
    );

    const detail = await getTraceMapDetailViewModel(mapId);

    expect(detail).not.toBeNull();
    expect(detail?.aiContract.available).toBe(false);
    expect(detail?.aiContract.error).toMatch(/Important Rules/);
    expect(detail?.integrityIssues.some((issue) => issue.code === "route_parse_failed")).toBe(true);
  });
});
