import { describe, expect, it } from "vitest";
import {
  SHORT_NAME_MAX_LENGTH,
  buildMechanicalShortName,
  resolveShortName,
  validateModelShortName,
} from "@/src/lib/short-name";

describe("short name helpers", () => {
  it("机械压缩会去括号并限制在 7 个字内", () => {
    expect(buildMechanicalShortName("金元泰·泰式按摩·SPA(丽影广场客村店)")).toBe("金元泰");
    expect(buildMechanicalShortName("杭州西溪喜来登度假大酒店")).toBe("杭州西溪喜来登");
    expect(Array.from(buildMechanicalShortName("杭州西溪喜来登度假大酒店")).length).toBe(
      SHORT_NAME_MAX_LENGTH,
    );
  });

  it("接受模型返回的连续子串 shortName", () => {
    expect(validateModelShortName("西溪喜来登", "杭州西溪喜来登度假大酒店")).toBe("西溪喜来登");
    expect(validateModelShortName('“金元泰”', "金元泰·泰式按摩·SPA(丽影广场客村店)")).toBe("金元泰");
  });

  it("对超长或改写语义的候选值回退到机械压缩", () => {
    expect(
      resolveShortName({
        canonicalName: "杭州西溪喜来登度假大酒店",
        candidate: "杭州西溪喜来登度假大酒店",
      }),
    ).toBe("杭州西溪喜来登");

    expect(
      resolveShortName({
        canonicalName: "金元泰·泰式按摩·SPA(丽影广场客村店)",
        candidate: "舒缓按摩站",
      }),
    ).toBe("金元泰");
  });
});
