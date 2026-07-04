import { describe, expect, it } from "vitest";
import type { EventRecord } from "@/src/contracts/domain";
import {
  buildEventVisualBriefPrompt,
  parseEventVisualBriefs,
  p2EventVisualBriefSystemPrompt,
} from "@/src/engine/prompts";

const events: EventRecord[] = [
  {
    eventId: "evt_001",
    commentId: "rec_001",
    sequence: 1,
    day: "2024:06:01",
    time: "10:20:00",
    commentText: "电梯上三楼，按摩后会送糖水，整体很放松。",
    commentPictures: [],
    canonicalName: "金元泰·泰式按摩·SPA(丽影广场客村店)",
    shortName: "金元泰",
    poiName: "金元泰·泰式按摩·SPA(丽影广场客村店)",
    poiLocation: "海珠区某地",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "休闲娱乐",
    categoryL2: "洗浴按摩",
    categoryL3: "足疗/按摩",
    authorName: "旅行者小夏",
  },
];

describe("event visual brief prompt", () => {
  it("会强调给定 style 统一约束，并要求输出 subject/avoid JSON", () => {
    const prompt = buildEventVisualBriefPrompt({
      styleLabel: "年轻卡通风",
      events,
    });

    expect(p2EventVisualBriefSystemPrompt).toContain("所有 event 配图统一服从给定 style");
    expect(prompt.user).toContain("当前全局 style：年轻卡通风");
    expect(prompt.user).toContain('"poiName": "金元泰·泰式按摩·SPA(丽影广场客村店)"');
    expect(prompt.user).toContain('"categoryL1": "休闲娱乐"');
    expect(prompt.user).toContain('"commentText": "电梯上三楼，按摩后会送糖水，整体很放松。"');
  });
});

describe("parseEventVisualBriefs", () => {
  it("会解析合法 JSON 数组", () => {
    const briefs = parseEventVisualBriefs(`
      [
        {
          "subject": "一间温暖放松的泰式按摩门店内景，按摩床与草本热敷用品摆放整齐，呈现舒缓护理中的休憩感。",
          "avoid": ["台阶", "楼层指示牌", "套餐价格字样"]
        }
      ]
    `);

    expect(briefs).toHaveLength(1);
    expect(briefs[0].avoid).toEqual(["台阶", "楼层指示牌", "套餐价格字样"]);
  });

  it("会拒绝 avoid 数量不合法的输出", () => {
    expect(() =>
      parseEventVisualBriefs(`
        [
          {
            "subject": "一间温暖放松的泰式按摩门店内景，按摩床与草本热敷用品摆放整齐，呈现舒缓护理中的休憩感。",
            "avoid": ["台阶", "楼层指示牌"]
          }
        ]
      `),
    ).toThrow();
  });
});
