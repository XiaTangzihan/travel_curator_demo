import { afterEach, describe, expect, it } from "vitest";
import {
  mapRecordSchema,
  runTraceSchema,
} from "@/src/contracts/domain";
import {
  defaultImageModel,
  resolveRequestedImageModel,
} from "@/src/config/image-models";
import { resolveSeedreamRuntimeConfig } from "@/src/engine/providers/seedream-model-registry";

const trackedEnvNames = [
  "SEEDREAM_BASE_URL",
  "SEEDREAM_MODEL_ID",
  "SEEDREAM_API_KEY",
  "SEEDREAM_4_0_MODEL_ID",
  "SEEDREAM_4_0_API_KEY",
  "SEEDREAM_4_5_MODEL_ID",
  "SEEDREAM_4_5_API_KEY",
  "SEEDREAM_5_0_MODEL_ID",
  "SEEDREAM_5_0_API_KEY",
] as const;

const originalEnv = Object.fromEntries(
  trackedEnvNames.map((envName) => [envName, process.env[envName]]),
) as Record<(typeof trackedEnvNames)[number], string | undefined>;

afterEach(() => {
  for (const envName of trackedEnvNames) {
    const originalValue = originalEnv[envName];
    if (originalValue === undefined) {
      delete process.env[envName];
    } else {
      process.env[envName] = originalValue;
    }
  }
});

describe("image model contracts", () => {
  it("会将历史 map/run 中缺失的 imageModel 兼容为 unknown", () => {
    const mapRecord = mapRecordSchema.parse({
      mapId: "map_001",
      mapName: "广州两日行",
      city: "广州",
      style: "young-cartoon",
      status: "draft",
      eventCount: 2,
      routePath: "/mock/routes/map_001.route.md",
      posterPath: "/mock/posters/map_001.png",
      knowledgePath: "/mock/routes/map_001.knowledge.json",
      currentRunId: "run_001",
      posterVersions: [
        {
          versionId: "run_001",
          posterPath: "/mock/posters/map_001.png",
          runId: "run_001",
          createdAt: "2026-07-05T17:00:00.000Z",
        },
      ],
      selectedCommentIds: ["rec_001"],
      createdAt: "2026-07-05T17:00:00.000Z",
      updatedAt: "2026-07-05T17:00:00.000Z",
    });

    const runTrace = runTraceSchema.parse({
      runId: "run_001",
      mapId: "map_001",
      status: "completed",
      stage: "generate",
      warnings: [],
      artifacts: {
        posterPath: "/mock/posters/map_001.png",
      },
      providerMode: "live",
      startedAt: "2026-07-05T17:00:00.000Z",
      endedAt: "2026-07-05T17:01:00.000Z",
    });

    expect(mapRecord.imageModel).toBe("unknown");
    expect(mapRecord.posterVersions[0]?.imageModel).toBe("unknown");
    expect(runTrace.imageModel).toBe("unknown");
  });

  it("会把未指定的请求模型默认解析为 5.0", () => {
    expect(resolveRequestedImageModel()).toBe(defaultImageModel);
    expect(resolveRequestedImageModel("seedream-4-5")).toBe("seedream-4-5");
    expect(resolveRequestedImageModel("unknown")).toBe(defaultImageModel);
  });
});

describe("seedream model registry", () => {
  it("5.0 会兼容当前单一 SEEDREAM 环境变量", () => {
    process.env.SEEDREAM_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
    process.env.SEEDREAM_MODEL_ID = "doubao-seedream-5-0-260128";
    process.env.SEEDREAM_API_KEY = "ark-legacy-500";

    const runtime = resolveSeedreamRuntimeConfig("seedream-5-0");

    expect(runtime.imageModel).toBe("seedream-5-0");
    expect(runtime.modelId).toBe("doubao-seedream-5-0-260128");
    expect(runtime.apiKey).toBe("ark-legacy-500");
  });

  it("4.0 缺少专属 model id 时会抛出可读错误", () => {
    process.env.SEEDREAM_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
    process.env.SEEDREAM_4_0_API_KEY = "ark-phase1-400";

    expect(() => resolveSeedreamRuntimeConfig("seedream-4-0")).toThrow(
      "SEEDREAM_4_0_MODEL_ID",
    );
  });
});
