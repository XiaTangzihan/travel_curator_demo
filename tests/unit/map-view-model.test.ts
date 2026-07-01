import { describe, expect, it } from "vitest";
import type { EventRecord } from "@/src/contracts/domain";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";

const events: EventRecord[] = [
  {
    eventId: "evt_002",
    commentId: "rec_002",
    day: "2024:06:02",
    time: "12:00:00",
    commentText: "第二条评论",
    commentPictures: [],
    poiName: "B 站点",
    poiLocation: "地址 B",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "美食",
    categoryL2: "小吃",
    categoryL3: "甜品",
    authorName: "旅行者小夏",
  },
  {
    eventId: "evt_001",
    commentId: "rec_001",
    day: "2024:06:01",
    time: "09:30:00",
    commentText: "第一条评论",
    commentPictures: [],
    poiName: "A 站点",
    poiLocation: "地址 A",
    poiProvince: "广东省",
    poiCity: "广州市",
    poiDistrict: "海珠区",
    categoryL1: "购物",
    categoryL2: "零食",
    categoryL3: "零食",
    authorName: "旅行者小夏",
  },
];

describe("buildMapViewModel", () => {
  it("会按时间顺序组织节点，并保持 event_id 绑定", () => {
    const model = buildMapViewModel({
      mapId: "map_001",
      mapName: "广州两日行",
      city: "广州",
      style: "young-cartoon",
      posterPath: "/mock/posters/map_001.svg",
      routeMarkdown: "# route",
      events,
      knowledge: [],
    });

    expect(model.selectedEventId).toBe("evt_001");
    expect(model.nodes[0]?.eventId).toBe("evt_001");
    expect(model.events[0]?.eventId).toBe("evt_001");
    expect(model.nodes[1]?.eventId).toBe("evt_002");
  });
});
