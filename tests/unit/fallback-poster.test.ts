import { describe, expect, it } from "vitest";
import type { EventRecord } from "@/src/contracts/domain";
import { createFallbackPosterSvg } from "@/src/engine/renderers/fallback-poster";

const events: EventRecord[] = [
  {
    eventId: "evt_001",
    commentId: "rec_001",
    sequence: 1,
    day: "2024:06:01",
    time: "10:20:00",
    commentText: "体验不错",
    commentPictures: [],
    canonicalName: "金元泰·泰式按摩·SPA(丽影广场客村店)",
    shortName: "金元泰",
    poiName: "金元泰·泰式按摩·SPA(丽影广场客村店)",
    poiLocation: "海珠区某地",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "休闲娱乐",
    categoryL2: "按摩",
    categoryL3: "SPA",
    authorName: "旅行者小夏",
  },
];

describe("createFallbackPosterSvg", () => {
  it("左上角主标题只使用目的地，不泄露地图名称", () => {
    const svg = createFallbackPosterSvg({
      city: "杭州",
      styleLabel: "清新水彩风",
      events,
    });

    expect(svg).toContain(">杭州<");
    expect(svg).toContain("旅行地图 · 清新水彩风 · 本地稳态底片");
    expect(svg).not.toContain("广州test01");
  });
});
