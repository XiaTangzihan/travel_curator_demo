/* eslint-disable @next/next/no-img-element */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicMapPage } from "@/src/features/dynamic-map/dynamic-map-page";
import type { MapViewModel } from "@/src/contracts/domain";

const pushMock = vi.fn();
const replaceMock = vi.fn();

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
    push: pushMock,
    replace: replaceMock,
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
  videoModel: "unknown",
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

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DynamicMapPage", () => {
  it("在视频页会默认展示当前风格的视频提示词", () => {
    render(
      <DynamicMapPage
        map={map}
        initialTab="video"
        availableVideoModels={["seedance-1-5-pro"]}
      />,
    );

    expect(screen.getByRole("link", { name: "回到主页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "下载图片" })).toHaveAttribute(
      "href",
      "/mock/posters/map_001.png",
    );
    expect(screen.getByRole("button", { name: "地图" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "视频" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "图文" })).toBeDisabled();
    expect(String(screen.getByLabelText("风格提示词").getAttribute("aria-label"))).toBe("风格提示词");
    expect((screen.getByLabelText("风格提示词") as HTMLTextAreaElement).value).toContain(
      "整体运动人格是轻快、明亮、灵动。",
    );
  });

  it("会回显最近一次视频 run 的提示词，并在提交时带上用户修改后的内容", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        waitPath: "/maps/map_001/video/generating/run_video_new_001",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DynamicMapPage
        map={map}
        initialTab="video"
        availableVideoModels={["seedance-1-5-pro"]}
        initialVideoPromptInstruction="先回显这条旧提示词"
      />,
    );

    const textarea = screen.getByLabelText("风格提示词");
    expect(textarea).toHaveValue("先回显这条旧提示词");

    fireEvent.change(textarea, {
      target: {
        value: "只允许路线有轻微流动感，其他装饰元素尽量静止。",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe("/api/maps/map_001/video/generate");
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      durationSeconds: 5,
      videoModel: "seedance-1-5-pro",
      promptInstruction: "只允许路线有轻微流动感，其他装饰元素尽量静止。",
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/maps/map_001/video/generating/run_video_new_001");
    });
  });
});
