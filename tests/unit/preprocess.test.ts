import { describe, expect, it } from "vitest";
import { preprocessDataset } from "@/src/engine/preprocess/raw_to_events";
import type { RawDatasetSnapshot } from "@/src/contracts/domain";

const dataset: RawDatasetSnapshot = {
  datasetKey: "guangzhou",
  datasetId: "guangzhou-golden",
  authorName: "旅行者小夏",
  source: {
    type: "base",
    baseToken: "base",
    tableId: "table",
    viewId: "view",
  },
  syncedAt: new Date().toISOString(),
  reviews: [
    {
      recordId: "rec_2",
      sourceReviewId: "src_2",
      createdAt: "2024-06-02T10:20:00+08:00",
      commentText: "第二天评论",
      poiName: "B 点",
      poiLocation: "地址 B",
      poiProvince: "广东省",
      poiCity: "广州市",
      poiDistrict: "天河区",
      categoryL1: "美食",
      categoryL2: "火锅",
      categoryL3: "特色火锅",
      attachments: [],
    },
    {
      recordId: "rec_1",
      sourceReviewId: "src_1",
      createdAt: "2024-06-01T09:08:00+08:00",
      commentText: "第一天评论",
      poiName: "A 点",
      poiLocation: "地址 A",
      poiProvince: "广东省",
      poiCity: "广州市",
      poiDistrict: "海珠区",
      categoryL1: "购物",
      categoryL2: "零食",
      categoryL3: "零食",
      attachments: [{ sourceUrl: "https://example.com/a.jpg", name: "a.jpg", localPath: "a", publicPath: "/a" }],
    },
  ],
};

describe("preprocessDataset", () => {
  it("会按创建时间排序并生成连续 event_id", () => {
    const result = preprocessDataset(dataset);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].commentId).toBe("rec_1");
    expect(result.events[0].eventId).toBe("evt_001");
    expect(result.events[1].eventId).toBe("evt_002");
  });

  it("会把图片 publicPath 映射到 commentPictures", () => {
    const result = preprocessDataset(dataset);
    expect(result.events[0].commentPictures[0]?.url).toBe("/a");
  });
});
