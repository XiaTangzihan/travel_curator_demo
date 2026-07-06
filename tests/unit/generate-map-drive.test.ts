import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapRecordSchema,
  type EventRecord,
  type Landmark,
} from "@/src/contracts/domain";
import {
  driveMapRun,
  startGenerateMapRun,
  startRegenerateMapRun,
} from "@/src/engine/pipelines/generate-map";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import {
  deleteMapArtifacts,
  getEventsDataset,
  getMapRecord,
  getRenderedMap,
  getRunTrace,
  getRouteMarkdown,
  posterOutputPath,
  posterPublicPath,
  saveKnowledge,
  saveMapRecord,
  saveRenderedMap,
  saveRouteMarkdown,
} from "@/src/server/repositories/demo-repository";
import { pathExists, runtimeAssetAbsolutePath, writeBinaryFile } from "@/src/server/utils/storage";
import { runDoubaoChat, runSeedreamImage } from "@/src/engine/providers/ark-provider";

vi.mock("@/src/engine/providers/ark-provider", () => ({
  runDoubaoChat: vi.fn(),
  runSeedreamImage: vi.fn(),
}));

const createdMapIds: string[] = [];

function createValidRouteMarkdown(params: {
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

describe("generate map drive flow", () => {
  beforeEach(() => {
    vi.mocked(runDoubaoChat).mockReset();
    vi.mocked(runSeedreamImage).mockReset();
  });

  afterEach(async () => {
    await Promise.all(createdMapIds.map((mapId) => deleteMapArtifacts(mapId)));
    createdMapIds.length = 0;
  });

  it("会按 preparing -> rendering -> finalizing -> completed 推进 generate run", async () => {
    const eventsSnapshot = await getEventsDataset("guangzhou");
    if (!eventsSnapshot?.events.length) {
      throw new Error("guangzhou events dataset missing");
    }

    const selectedCommentIds = eventsSnapshot.events
      .slice(0, 2)
      .map((event) => event.commentId);

    vi.mocked(runDoubaoChat)
      .mockResolvedValueOnce(JSON.stringify(
        selectedCommentIds.map((_commentId, index) => ({
          shortName: `短名${index + 1}`,
          subject: `主体${index + 1}、明亮`,
          avoid: ["店招文字", "价格标签", "楼层标识"],
        })),
      ))
      .mockResolvedValueOnce(JSON.stringify([
        {
          name: "西湖",
          visual: "湖面、拱桥与远山",
        },
      ]));
    vi.mocked(runSeedreamImage).mockResolvedValue(Buffer.from("poster-binary"));

    const started = await startGenerateMapRun({
      datasetKey: "guangzhou",
      mapName: "Phase2 Drive 测试图",
      city: "广州",
      style: "young-cartoon",
      selectedCommentIds,
    });
    createdMapIds.push(started.mapId);

    const initialRun = await getRunTrace(started.runId);
    expect(initialRun?.status).toBe("running");
    expect(initialRun?.progressStep).toBe("preparing");
    expect(initialRun?.driveState?.phase).toBe("preparing");

    const preparedRun = await driveMapRun(started.runId);
    expect(preparedRun.progressStep).toBe("rendering");
    expect(preparedRun.driveState?.phase).toBe("rendering");
    expect(preparedRun.artifacts.routePath).toContain("/runtime/mock/routes/");
    expect(await getRouteMarkdown(started.mapId)).toContain("## Important Rules");

    const renderedRun = await driveMapRun(started.runId);
    expect(renderedRun.progressStep).toBe("finalizing");
    expect(renderedRun.driveState?.phase).toBe("finalizing");
    expect(renderedRun.artifacts.posterPath).toContain("/runtime/mock/posters/");
    expect(
      await pathExists(runtimeAssetAbsolutePath("posters", `${started.mapId}.png`)),
    ).toBe(true);

    const completedRun = await driveMapRun(started.runId);
    expect(completedRun.status).toBe("completed");
    expect(completedRun.endedAt).toBeTruthy();

    const [mapRecord, renderedMap] = await Promise.all([
      getMapRecord(started.mapId),
      getRenderedMap(started.mapId),
    ]);
    expect(mapRecord?.currentRunId).toBe(started.runId);
    expect(mapRecord?.posterPath).toBe(completedRun.artifacts.posterPath);
    expect(renderedMap?.posterPath).toBe(completedRun.artifacts.posterPath);
  });

  it("会按 preparing -> rendering -> finalizing -> completed 推进 regenerate run", async () => {
    const eventsSnapshot = await getEventsDataset("guangzhou");
    const event = eventsSnapshot?.events[0];
    if (!event) {
      throw new Error("guangzhou events dataset missing");
    }

    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `phase2_regen_${token}`;
    createdMapIds.push(mapId);

    const knowledge: Landmark[] = [{ name: "广州塔", visual: "塔身与夜景" }];
    const routeMarkdown = createValidRouteMarkdown({
      mapName: `地图-${token}`,
      city: "广州",
      event: {
        ...event,
        subject: event.subject ?? "糖水铺、清甜",
        avoid: event.avoid ?? ["店招文字", "价格标签", "楼层标识"],
      },
      knowledgeCount: knowledge.length,
    });

    const routePath = await saveRouteMarkdown(mapId, routeMarkdown);
    const knowledgePath = await saveKnowledge(mapId, knowledge);
    await writeBinaryFile(posterOutputPath(mapId, "png"), Buffer.from("base-poster"));

    const mapViewModel = buildMapViewModel({
      mapId,
      datasetKey: "guangzhou",
      mapName: `地图-${token}`,
      city: "广州",
      style: "young-cartoon",
      posterPath: posterPublicPath(mapId, "png"),
      routeMarkdown,
      events: [event],
      knowledge,
    });
    await saveRenderedMap(mapId, mapViewModel);

    await saveMapRecord(
      mapRecordSchema.parse({
        mapId,
        datasetKey: "guangzhou",
        mapName: `地图-${token}`,
        city: "广州",
        style: "young-cartoon",
        status: "draft",
        eventCount: 1,
        routePath,
        posterPath: posterPublicPath(mapId, "png"),
        knowledgePath,
        currentRunId: "seed_run",
        posterVersions: [
          {
            versionId: "seed_run",
            posterPath: posterPublicPath(mapId, "png"),
            runId: "seed_run",
            createdAt: new Date().toISOString(),
          },
        ],
        selectedPosterVersionId: "seed_run",
        selectedCommentIds: [event.commentId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    vi.mocked(runSeedreamImage).mockResolvedValue(Buffer.from("regen-poster"));

    const seededRecord = await getMapRecord(mapId);
    if (!seededRecord) {
      throw new Error("seeded map record missing");
    }

    const started = await startRegenerateMapRun({
      mapRecord: seededRecord,
      mode: "variant",
      instruction: "",
    });

    const initialRun = await getRunTrace(started.runId);
    expect(initialRun?.stage).toBe("regenerate");
    expect(initialRun?.progressStep).toBe("preparing");

    const preparedRun = await driveMapRun(started.runId);
    expect(preparedRun.progressStep).toBe("rendering");

    const renderedRun = await driveMapRun(started.runId);
    expect(renderedRun.progressStep).toBe("finalizing");
    expect(renderedRun.artifacts.posterPath).toContain(`/runtime/mock/posters/${mapId}__`);

    const completedRun = await driveMapRun(started.runId);
    expect(completedRun.status).toBe("completed");

    const [nextRecord, nextRenderedMap] = await Promise.all([
      getMapRecord(mapId),
      getRenderedMap(mapId),
    ]);
    expect(nextRecord?.currentRunId).toBe(started.runId);
    expect(nextRecord?.selectedPosterVersionId).toBe(started.runId);
    expect(nextRecord?.posterVersions).toHaveLength(2);
    expect(nextRenderedMap?.posterPath).toBe(completedRun.artifacts.posterPath);
  });
});
