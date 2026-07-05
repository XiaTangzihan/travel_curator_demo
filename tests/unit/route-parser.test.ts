import { describe, expect, it } from "vitest";
import { parseRouteMarkdown } from "@/src/engine/parsers/route-markdown";

const validRouteMarkdown = `---
map_name: 广州02
city: 广州市
style: 年轻卡通风
days: 1
event_count: 1
knowledge_count: 2
---

## Important Rules
- 所有 event 配图统一服从给定 style，不得自行发散风格。
- 背景地标只作为背景视觉参考，不给地标配文。
- 每个 event 的 subject 必须是 1 个简短中文名词和 1 个简短中文形容词，用顿号连接，顺序固定为“名词、形容词”。
- 每个 event 的 avoid 必须是 3-5 个要避免的意象词。

# Day 1 (2024:06:01)

## Event 1 · 金元泰
- sequence: 1
- poi: 金元泰·泰式按摩·SPA(丽影广场客村店)
- short_name: 金元泰
- 类目: 休闲娱乐 / 洗浴按摩 / 足疗/按摩
- 文案: 电梯上三楼，过了一家桌游店就是这家泰式按摩了……
- 配图: /mock/files/comments/rec_001.jpeg
- subject: 按摩房、舒缓
- avoid: 台阶, 楼层指示牌, 套餐价格字样
`;

describe("parseRouteMarkdown", () => {
  it("能解析 front matter、Important Rules 和 event 字段", () => {
    const route = parseRouteMarkdown(validRouteMarkdown);

    expect(route.mapName).toBe("广州02");
    expect(route.city).toBe("广州市");
    expect(route.importantRules).toHaveLength(4);
    expect(route.events).toHaveLength(1);
    expect(route.events[0].shortName).toBe("金元泰");
    expect(route.events[0].avoid).toEqual(["台阶", "楼层指示牌", "套餐价格字样"]);
  });

  it("在缺少 Important Rules 时会失败", () => {
    expect(() =>
      parseRouteMarkdown(validRouteMarkdown.replace("## Important Rules", "## Rules")),
    ).toThrow(/Important Rules/);
  });

  it("在 avoid 数量不合法时会失败", () => {
    expect(() =>
      parseRouteMarkdown(
        validRouteMarkdown.replace(
          "- avoid: 台阶, 楼层指示牌, 套餐价格字样",
          "- avoid: 台阶, 楼层指示牌",
        ),
      ),
    ).toThrow();
  });

  it("在 sequence 冲突时会失败", () => {
    const markdown = `${validRouteMarkdown.replace("event_count: 1", "event_count: 2")}
## Event 1 · 第二站
- sequence: 1
- poi: 第二个地点
- short_name: 第二站
- 类目: 美食 / 小吃 / 夜宵
- 文案: 第二条评论
- 配图: /mock/files/comments/rec_002.jpeg
- subject: 小吃店、热闹
- avoid: 楼层牌, 价格菜单, 时间数字
`;

    expect(() => parseRouteMarkdown(markdown)).toThrow(/重复 sequence/);
  });
});
