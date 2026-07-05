import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeedanceVideoTask } from "@/src/engine/providers/ark-provider";

const trackedEnvNames = [
  "SEEDANCE_BASE_URL",
  "SEEDANCE_1_5_MODEL_ID",
  "SEEDANCE_1_5_API_KEY",
] as const;

const originalEnv = Object.fromEntries(
  trackedEnvNames.map((envName) => [envName, process.env[envName]]),
) as Record<(typeof trackedEnvNames)[number], string | undefined>;

afterEach(() => {
  vi.restoreAllMocks();
  for (const envName of trackedEnvNames) {
    const originalValue = originalEnv[envName];
    if (originalValue === undefined) {
      delete process.env[envName];
    } else {
      process.env[envName] = originalValue;
    }
  }
});

describe("createSeedanceVideoTask", () => {
  it("默认请求会开启 generate_audio", async () => {
    process.env.SEEDANCE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
    process.env.SEEDANCE_1_5_MODEL_ID = "doubao-seedance-1-5-pro-251215";
    process.env.SEEDANCE_1_5_API_KEY = "ark-test-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cgt_test_video_001",
        status: "queued",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createSeedanceVideoTask({
      prompt: "test prompt",
      imageUrl: "data:image/png;base64,ZmFrZQ==",
      durationSeconds: 5,
      videoModel: "seedance-1-5-pro",
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(body.generate_audio).toBe(true);
    expect(body.duration).toBe(5);
  });
});
