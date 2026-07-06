import { afterEach, describe, expect, it } from "vitest";
import { mapRecordSchema } from "@/src/contracts/domain";
import {
  assertSupportedVideoDurationSeconds,
  startGenerateVideoRun,
} from "@/src/engine/pipelines/generate-video";
import {
  resolveAvailableSeedanceModels,
  resolveSeedanceRuntimeConfig,
} from "@/src/engine/providers/seedance-model-registry";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import {
  deleteMapArtifacts,
  saveMapRecord,
  saveRenderedMap,
} from "@/src/server/repositories/demo-repository";

const trackedEnvNames = [
  "SEEDANCE_BASE_URL",
  "SEEDANCE_1_5_MODEL_ID",
  "SEEDANCE_1_5_API_KEY",
  "SEEDANCE_1_0_PRO_FAST_MODEL_ID",
  "SEEDANCE_1_0_PRO_FAST_API_KEY",
] as const;

const originalEnv = Object.fromEntries(
  trackedEnvNames.map((envName) => [envName, process.env[envName]]),
) as Record<(typeof trackedEnvNames)[number], string | undefined>;

const createdMapIds: string[] = [];

afterEach(async () => {
  for (const envName of trackedEnvNames) {
    const originalValue = originalEnv[envName];
    if (originalValue === undefined) {
      delete process.env[envName];
    } else {
      process.env[envName] = originalValue;
    }
  }

  await Promise.all(createdMapIds.map((mapId) => deleteMapArtifacts(mapId)));
  createdMapIds.length = 0;
});

describe("seedance model registry", () => {
  it("1.0 Pro Fast 缺少 model id 时会回退到默认候选值", () => {
    process.env.SEEDANCE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
    process.env.SEEDANCE_1_0_PRO_FAST_API_KEY = "ark-fast-key";

    const runtime = resolveSeedanceRuntimeConfig("seedance-1-0-pro-fast");

    expect(runtime.videoModel).toBe("seedance-1-0-pro-fast");
    expect(runtime.modelId).toBe("doubao-seedance-1-0-pro-fast-251015");
  });

  it("只把配置完整的模型识别为可用项", () => {
    process.env.SEEDANCE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
    process.env.SEEDANCE_1_5_API_KEY = "ark-15-key";
    process.env.SEEDANCE_1_5_MODEL_ID = "doubao-seedance-1-5-pro-251215";

    expect(resolveAvailableSeedanceModels()).toEqual(["seedance-1-5-pro"]);
  });
});

describe("video pipeline constraints", () => {
  it("会拒绝不支持的视频时长", () => {
    expect(() => assertSupportedVideoDurationSeconds(6)).toThrow("5 / 7 / 9");
    expect(assertSupportedVideoDurationSeconds(7)).toBe(7);
  });

  it("会在 svg 底片场景直接拒绝发起视频生成", async () => {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mapId = `test_video_svg_${token}`;
    createdMapIds.push(mapId);

    await saveMapRecord(
      mapRecordSchema.parse({
        mapId,
        mapName: "测试视频地图",
        city: "广州",
        style: "young-cartoon",
        status: "draft",
        eventCount: 1,
        routePath: `/mock/routes/${mapId}.route.md`,
        posterPath: `/mock/posters/${mapId}.svg`,
        knowledgePath: `/mock/routes/${mapId}.knowledge.json`,
        currentRunId: "run_svg_gate",
        selectedCommentIds: ["rec_svg_gate"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    await saveRenderedMap(
      mapId,
      buildMapViewModel({
        mapId,
        mapName: "测试视频地图",
        city: "广州",
        style: "young-cartoon",
        posterPath: `/mock/posters/${mapId}.svg`,
        routeMarkdown: "# route",
        events: [
          {
            eventId: "evt_svg_gate",
            commentId: "rec_svg_gate",
            day: "2024:06:01",
            time: "10:00:00",
            commentText: "测试评论",
            commentPictures: [],
            poiName: "测试地点",
            poiLocation: "测试地址",
            poiProvince: "广东省",
            poiCity: "广州市",
            poiDistrict: "海珠区",
            categoryL1: "美食",
            categoryL2: "小吃",
            categoryL3: "粤式小吃",
            authorName: "旅行者小夏",
          },
        ],
        knowledge: [],
      }),
    );

    await expect(
      startGenerateVideoRun({
        mapId,
        durationSeconds: 5,
        videoModel: "seedance-1-5-pro",
      }),
    ).rejects.toThrow("当前底片不支持视频生成");
  });
});
