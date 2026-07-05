/* eslint-disable @next/next/no-img-element */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicMapPage } from "@/src/features/dynamic-map/dynamic-map-page";
import type { MapViewModel } from "@/src/contracts/domain";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.unoptimized;
    return <img alt={String(rest.alt ?? "")} {...rest} />;
  },
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => (
    <a href={String(props.href ?? "#")}>{props.children as React.ReactNode}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const map: MapViewModel = {
  mapId: "map_001",
  datasetKey: "guangzhou",
  mapName: "广州疗愈图",
  city: "广州",
  style: "young-cartoon",
  imageModel: "seedream-5-0",
  posterPath: "/mock/posters/map_001.png",
  routeMarkdown: "# route",
  selectedEventId: "evt_001",
  generatedAt: "2026-07-05T00:00:00.000Z",
  knowledge: [],
  nodes: [
    {
      eventId: "evt_001",
      day: "2024:06:01",
      time: "10:20:00",
      title: "金元泰",
      excerpt: "按摩放松",
      thumbnail: "/mock/files/a.jpg",
    },
  ],
  events: [
    {
      eventId: "evt_001",
      commentId: "rec_001",
      day: "2024:06:01",
      time: "10:20:00",
      commentText: "按摩体验不错。",
      commentPictures: [{ url: "/mock/files/a.jpg", name: "a.jpg" }],
      canonicalName: "金元泰",
      shortName: "金元泰",
      poiName: "金元泰",
      poiLocation: "广州海珠区",
      poiProvince: "广东省",
      poiCity: "广州市",
      poiDistrict: "海珠区",
      categoryL1: "休闲娱乐",
      categoryL2: "按摩",
      categoryL3: "SPA",
      subject: "按摩房、舒缓",
      avoid: ["招牌文字", "楼层指示牌", "套餐价格字样"],
      authorName: "旅行者小夏",
    },
  ],
};

describe("DynamicMapPage", () => {
  it("会渲染回主页、下载图片和灰态 detab", () => {
    render(<DynamicMapPage map={map} />);

    expect(screen.getByRole("link", { name: "回到主页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "下载图片" })).toHaveAttribute(
      "href",
      "/mock/posters/map_001.png",
    );

    expect(screen.getByRole("button", { name: "地图" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "视频" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "图文" })).toBeDisabled();
  });
});
