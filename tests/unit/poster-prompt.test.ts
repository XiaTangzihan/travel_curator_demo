import { describe, expect, it } from "vitest";
import type { Landmark, ParsedRoute } from "@/src/contracts/domain";
import {
  buildPosterPrompt,
  buildRegeneratePosterPrompt,
} from "@/src/engine/prompts";
import { p3PosterImportantRules } from "@/src/engine/prompts/p3-poster-important-rules";

const route: ParsedRoute = {
  mapName: "广州疗愈图",
  city: "广州",
  styleLabel: "年轻卡通风",
  days: 1,
  eventCount: 1,
  knowledgeCount: 1,
  importantRules: [...p3PosterImportantRules],
  events: [
    {
      dayIndex: 1,
      day: "2024:06:01",
      sequence: 1,
      headingTitle: "金元泰",
      poi: "金元泰·泰式按摩·SPA(丽影广场客村店)",
      shortName: "金元泰",
      category: "休闲娱乐 / 按摩 / SPA",
      commentText: "体验不错",
      imagePath: "/mock/a.jpg",
      subject: "按摩房、舒缓",
      avoid: ["台阶", "楼层指示牌", "套餐价格字样"],
    },
  ],
};

const knowledge: Landmark[] = [{ name: "广州塔", visual: "修长塔身与夜景灯光" }];

describe("buildPosterPrompt", () => {
  it("会去除时间信息，并收紧海报标题语义到目的地", () => {
    const prompt = buildPosterPrompt({
      styleKey: "young-cartoon",
      route,
      knowledge,
    });

    expect(prompt).toContain("重要事项：");
    expect(prompt).toContain("所有 event 配图统一服从给定 style，不得自行发散风格。");
    expect(prompt).toContain("1. 金元泰");
    expect(prompt).toContain("1号点固定展示名「金元泰」");
    expect(prompt).toContain("1号点「金元泰」画面要求：按摩房、舒缓");
    expect(prompt).toContain("避免意象：台阶、楼层指示牌、套餐价格字样");
    expect(prompt).toContain("所有 event 主体图标内部禁止出现任何可读文字");
    expect(prompt).toContain("点位名称和编号只能作为节点外部标注");
    expect(prompt).toContain("style_ref_young_cartoon_20260702");
    expect(prompt).toContain("修长塔身与夜景灯光");
    expect(prompt).not.toContain("10:20:00");
    expect(prompt).not.toContain("广州塔（");
    expect(prompt).not.toContain("地图名称：");
    expect(prompt).not.toContain("广州两日行");
    expect(prompt).not.toContain("当前地图名称");
    expect(prompt).toContain("不要输出这些地标的名字文字");
    expect(prompt).toContain("不能保留杭州字样");
    expect(prompt).toContain("左上角艺术字只能写当前目的地名称「广州」");
    expect(prompt).toContain("点位名称和编号只能作为节点外部标注，不能写进主体图标内部");
    expect(prompt).toContain("主路径应以左到右为主阅读轴");
    expect(prompt).toContain("节点中心点横向位置必须随编号递增");
    expect(prompt).toContain("请简化为无字形状，不要生成可读字符");
  });

  it("重生成提示词也只能使用目的地艺术字", () => {
    const prompt = buildRegeneratePosterPrompt({
      route: {
        ...route,
        city: "杭州",
      },
      styleKey: "storybook",
      knowledge,
      instruction: "让右侧路线更清晰",
      basedOnExistingImage: true,
    });

    expect(prompt).toContain("左上角艺术字只能写当前目的地名称「杭州」");
    expect(prompt).not.toContain("地图名称：");
    expect(prompt).not.toContain("当前地图名称");
    expect(prompt).toContain("请尽量保留原有整体构图，只按这条意见调整：让右侧路线更清晰");
  });
});
