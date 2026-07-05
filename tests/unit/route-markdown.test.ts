import { describe, expect, it } from "vitest";
import { createDeterministicRouteMarkdown } from "@/src/engine/renderers/route-markdown";
import type { EventRecord, Landmark } from "@/src/contracts/domain";
import { p3PosterImportantRules } from "@/src/engine/prompts/p3-poster-important-rules";

const events: EventRecord[] = [
  {
    eventId: "evt_001",
    commentId: "rec_001",
    sequence: 1,
    day: "2024:06:01",
    time: "10:20:00",
    commentText: "广州塔附近的一次早餐记录",
    commentPictures: [{ url: "/mock/a.jpg", name: "a.jpg" }],
    canonicalName: "广州塔店",
    shortName: "广州塔店",
    poiName: "广州塔店",
    poiLocation: "海珠区某地",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "美食",
    categoryL2: "早午餐",
    categoryL3: "早餐",
    subject: "早餐桌、明亮",
    avoid: ["楼层牌", "价格标签", "时间数字"],
    authorName: "旅行者小夏",
  },
];

const knowledge: Landmark[] = [{ name: "广州塔", visual: "塔身与夜景" }];

describe("createDeterministicRouteMarkdown", () => {
  it("会输出 front matter 和按 sequence 排序的 Day/Event 分层", () => {
    const markdown = createDeterministicRouteMarkdown({
      mapName: "广州两日行",
      city: "广州",
      styleLabel: "年轻卡通",
      events,
      knowledge,
    });

    expect(markdown).toContain("map_name: 广州两日行");
    expect(markdown).toContain("## Important Rules");
    p3PosterImportantRules.forEach((rule) => {
      expect(markdown).toContain(`- ${rule}`);
    });
    expect(markdown).toContain("# Day 1 (2024:06:01)");
    expect(markdown).toContain("## Event 1 · 广州塔店");
    expect(markdown).toContain("- sequence: 1");
    expect(markdown).toContain("- subject: 早餐桌、明亮");
    expect(markdown).toContain("- avoid: 楼层牌, 价格标签, 时间数字");
    expect(markdown).not.toContain("event标志生图提示");
    expect(markdown).not.toContain("10:20:00");
  });
});
