import { describe, expect, it } from "vitest";
import type { EventRecord, Landmark } from "@/src/contracts/domain";
import { buildPosterPrompt } from "@/src/engine/prompts";

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

const knowledge: Landmark[] = [{ name: "广州塔", visual: "修长塔身与夜景灯光" }];

describe("buildPosterPrompt", () => {
  it("会去除时间信息，并只把地标 visual 暴露给生图提示", () => {
    const prompt = buildPosterPrompt({
      mapName: "广州两日行",
      city: "广州",
      styleKey: "young-cartoon",
      events,
      knowledge,
    });

    expect(prompt).toContain("1. 金元泰");
    expect(prompt).toContain("原名「金元泰·泰式按摩·SPA(丽影广场客村店)」");
    expect(prompt).toContain("修长塔身与夜景灯光");
    expect(prompt).not.toContain("10:20:00");
    expect(prompt).not.toContain("广州塔（");
    expect(prompt).toContain("不要输出这些地标的名字文字");
  });
});
