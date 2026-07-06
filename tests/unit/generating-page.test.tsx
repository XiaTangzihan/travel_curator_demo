/* eslint-disable @next/next/no-img-element */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GeneratingPage,
  runStatusPollIntervalMs,
} from "@/src/features/generating/generating-page";
import type { RunTrace } from "@/src/contracts/domain";

const replaceMock = vi.fn();
const originalConsoleError = console.error;

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.unoptimized;
    delete rest.fill;
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
    replace: replaceMock,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function createRun(overrides?: Partial<RunTrace>): RunTrace {
  return {
    runId: "run_wait_001",
    mapId: "map_wait_001",
    datasetKey: "guangzhou",
    status: "running",
    stage: "generate",
    imageModel: "seedream-5-0",
    videoModel: "unknown",
    styleKey: "storybook",
    progressStep: "preparing",
    previewImagePaths: ["/mock/files/comments/example-1.jpg"],
    generateInput: {
      datasetKey: "guangzhou",
      mapName: "广州周末地图",
      city: "广州",
      style: "storybook",
      imageModel: "seedream-5-0",
      selectedCommentIds: ["comment_001"],
    },
    inputSummary: {
      datasetKey: "guangzhou",
      mapName: "广州周末地图",
      city: "广州",
      selectedCommentCount: 1,
    },
    driveState: {
      phase: "preparing",
    },
    warnings: [],
    artifacts: {
      rawPath: "/mock/raw/guangzhou.raw.json",
      eventsPath: "/mock/events/guangzhou.events.json",
    },
    providerMode: "live",
    startedAt: "2026-07-06T05:00:00.000Z",
    updatedAt: "2026-07-06T05:00:00.000Z",
    ...overrides,
  };
}

describe("GeneratingPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    vi.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).includes("Received `true` for a non-boolean attribute `jsx`")) {
        return;
      }

      originalConsoleError(message, ...args);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("即使 drive 请求未返回，也会根据 run 状态轮询推进当前步骤", async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url === "/api/runs/run_wait_001/drive") {
        return new Promise(() => undefined);
      }

      if (url === "/api/runs/run_wait_001") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            run: createRun({
              progressStep: "rendering",
              driveState: {
                phase: "rendering",
              },
              updatedAt: "2026-07-06T05:02:30.000Z",
            }),
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratingPage initialRun={createRun()} />);

    await waitFor(() => {
      expect(screen.getByTestId("generating-active-step")).toHaveTextContent("生成海报");
    });
    expect(replaceMock).not.toHaveBeenCalled();
  }, 10_000);

  it("即使 drive 请求挂起，也会在轮询读到完成态后自动跳转结果页", async () => {
    let statusReadCount = 0;
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url === "/api/runs/run_wait_001/drive") {
        return new Promise(() => undefined);
      }

      if (url === "/api/runs/run_wait_001") {
        statusReadCount += 1;
        if (statusReadCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              run: createRun({
                progressStep: "rendering",
                driveState: {
                  phase: "rendering",
                },
                updatedAt: "2026-07-06T05:02:30.000Z",
              }),
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            run: createRun({
              status: "completed",
              progressStep: "finalizing",
              driveState: {
                phase: "finalizing",
              },
              artifacts: {
                rawPath: "/mock/raw/guangzhou.raw.json",
                eventsPath: "/mock/events/guangzhou.events.json",
                routePath: "/runtime/mock/routes/map_wait_001.route.md",
                posterPath: "/runtime/mock/posters/map_wait_001.png",
                mapPath: "/runtime/mock/maps/map_wait_001.view.json",
              },
              endedAt: "2026-07-06T05:03:40.000Z",
              updatedAt: "2026-07-06T05:03:40.000Z",
            }),
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GeneratingPage initialRun={createRun()} />);

    await waitFor(() => {
      expect(screen.getByTestId("generating-active-step")).toHaveTextContent("生成海报");
    });

    await new Promise((resolve) => {
      window.setTimeout(resolve, runStatusPollIntervalMs + 50);
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/confirm/map_wait_001");
    });
  }, 10_000);
});
