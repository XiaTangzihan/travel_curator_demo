import { afterEach, describe, expect, it } from "vitest";
import {
  deleteFilePaths,
  normalizeRuntimeAbsolutePath,
  pathExists,
  readJsonFile,
  runtimeAssetAbsolutePath,
  runtimeAssetPublicPath,
  writeJsonFile,
} from "@/src/server/utils/storage";

const originalRuntimeStoreDriver = process.env.RUNTIME_STORE_DRIVER;

afterEach(async () => {
  process.env.RUNTIME_STORE_DRIVER = originalRuntimeStoreDriver;
});

describe("runtime storage driver", () => {
  it("tmp 驱动下会通过 runtime public path 读写运行态 JSON", async () => {
    process.env.RUNTIME_STORE_DRIVER = "tmp";
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const runPublicPath = runtimeAssetPublicPath("runs", `tmp_driver_${token}.json`);
    const runAbsolutePath = runtimeAssetAbsolutePath("runs", `tmp_driver_${token}.json`);

    await writeJsonFile(runPublicPath, { ok: true, token });

    expect(await pathExists(runPublicPath)).toBe(true);
    expect(await pathExists(runAbsolutePath)).toBe(true);
    expect(await readJsonFile<{ ok: boolean; token: string }>(runPublicPath)).toEqual({
      ok: true,
      token,
    });

    await deleteFilePaths([runPublicPath]);
    expect(await pathExists(runPublicPath)).toBe(false);
  });

  it("会把运行态绝对路径归一化为 /runtime/mock 公共路径", () => {
    const routeAbsolutePath = runtimeAssetAbsolutePath("routes", "map_test.route.md");
    const knowledgeAbsolutePath = runtimeAssetAbsolutePath("routes", "map_test.knowledge.json");

    expect(normalizeRuntimeAbsolutePath(routeAbsolutePath)).toBe("/runtime/mock/routes/map_test.route.md");
    expect(normalizeRuntimeAbsolutePath(knowledgeAbsolutePath)).toBe("/runtime/mock/routes/map_test.knowledge.json");
  });
});
