import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VideoGeneratingPage } from "@/src/features/video-generating/video-generating-page";
import type { RunTrace } from "@/src/contracts/domain";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function createRun(overrides?: Partial<RunTrace>): RunTrace {
  return {
    runId: "run_video_wait_001",
    mapId: "map_video_wait_001",
    datasetKey: "hangzhou",
    status: "completed",
    stage: "video_generate",
    imageModel: "unknown",
    videoModel: "seedance-1-5-pro",
    videoDurationSeconds: 5,
    warnings: [],
    artifacts: {
      posterPath: "/mock/posters/map_video_wait_001.png",
      videoPath: "/mock/videos/map_video_wait_001.mp4",
      mapPath: "/mock/maps/map_video_wait_001.view.json",
    },
    providerMode: "live",
    startedAt: "2026-07-05T10:00:00.000Z",
    endedAt: "2026-07-05T10:00:05.000Z",
    ...overrides,
  };
}

describe("VideoGeneratingPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it("完成后会自动回跳到 ?tab=video", async () => {
    render(<VideoGeneratingPage initialRun={createRun()} />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/maps/map_video_wait_001?tab=video");
    });
  });
});
