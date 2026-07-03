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
} from "@/src/server/repositories/demo-repository";
import { pathExists, writeBinaryFile } from "@/src/server/utils/storage";

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
        routePath: `/mock/routes/${mapId}.route.md`,
        posterPath: posterPublicPath(mapId, "png"),
        mapPath: `/mock/maps/${mapId}.view.json`,
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
});
