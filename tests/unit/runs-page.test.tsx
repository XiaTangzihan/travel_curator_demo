/* eslint-disable @next/next/no-img-element */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunsPage } from "@/src/features/runs/runs-page";
import type {
  TraceMapDetailViewModel,
  TraceOverviewViewModel,
} from "@/src/server/trace-diagnostics/types";

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

function createDetail(params: {
  mapId: string;
  mapName: string;
  sourceRunId: string;
  lifecycleRunId: string;
  commentId: string;
}): TraceMapDetailViewModel {
  return {
    mapId: params.mapId,
    mapName: params.mapName,
    city: "萧山",
    datasetKey: "hangzhou",
    mapStatus: "confirmed",
    eventCount: 1,
    updatedAt: "2026-07-05T05:39:37.081Z",
    currentRunIdRaw: params.lifecycleRunId,
    selectedPosterVersion: {
      versionId: params.sourceRunId,
      posterPath: `/mock/posters/${params.mapId}__${params.sourceRunId}.png`,
      runId: params.sourceRunId,
      createdAt: "2026-07-05T05:34:36.985Z",
      instruction: "",
      basedOnExistingImage: false,
    },
    selectedPosterSourceRun: {
      runId: params.sourceRunId,
      mapId: params.mapId,
      datasetKey: "hangzhou",
      status: "completed",
      stage: "regenerate",
      providerMode: "live",
      styleKey: "young-cartoon",
      promptVersion: "phase4_reference_v1",
      referenceIds: ["style_ref_young_cartoon_20260702"],
      warnings: [],
      startedAt: "2026-07-05T05:34:36.985Z",
      endedAt: "2026-07-05T05:35:40.652Z",
      durationSeconds: 64,
      artifacts: {
        routePath: `/mock/routes/${params.mapId}.route.md`,
        posterPath: `/mock/posters/${params.mapId}__${params.sourceRunId}.png`,
        mapPath: `/mock/maps/${params.mapId}.view.json`,
      },
      isSelectedPosterSource: true,
      isLatestLifecycle: false,
      posterAssetState: "present",
    },
    latestLifecycleRun: {
      runId: params.lifecycleRunId,
      mapId: params.mapId,
      datasetKey: "hangzhou",
      status: "completed",
      stage: "confirm",
      providerMode: "live",
      styleKey: undefined,
      promptVersion: undefined,
      referenceIds: [],
      warnings: [],
      startedAt: "2026-07-05T05:39:37.088Z",
      endedAt: "2026-07-05T05:39:37.088Z",
      durationSeconds: 1,
      artifacts: {
        routePath: `/mock/routes/${params.mapId}.route.md`,
        posterPath: `/mock/posters/${params.mapId}__${params.sourceRunId}.png`,
        mapPath: `/mock/maps/${params.mapId}.view.json`,
      },
      isSelectedPosterSource: false,
      isLatestLifecycle: true,
      posterAssetState: "present",
    },
    currentArtifacts: {
      raw: {
        publicPath: "/mock/raw/hangzhou.raw.json",
        count: 8,
        source: "dataset_inferred",
      },
      events: {
        publicPath: "/mock/events/hangzhou.events.json",
        count: 8,
        source: "dataset_inferred",
      },
      route: {
        filePath: `C:\\mock\\routes\\${params.mapId}.route.md`,
        publicPath: `/mock/routes/${params.mapId}.route.md`,
        exists: true,
        parsed: true,
        previewLines: ["---", `map_name: ${params.mapName}`],
      },
      knowledge: {
        filePath: `C:\\mock\\routes\\${params.mapId}.knowledge.json`,
        publicPath: `/mock/routes/${params.mapId}.knowledge.json`,
        exists: true,
        count: 1,
        previewItems: [{ name: "湘湖旅游度假区", visual: "滨湖风光与江南水岸" }],
      },
      mapView: {
        filePath: `C:\\mock\\maps\\${params.mapId}.view.json`,
        publicPath: `/mock/maps/${params.mapId}.view.json`,
        exists: true,
        nodeCount: 1,
        selectedEventId: `evt_${params.mapId}`,
      },
      poster: {
        publicPath: `/mock/posters/${params.mapId}__${params.sourceRunId}.png`,
        exists: true,
        sourceRunId: params.sourceRunId,
        selectedVersionId: params.sourceRunId,
      },
    },
    aiContract: {
      available: true,
      frontMatter: {
        mapName: params.mapName,
        city: "萧山",
        styleLabel: "年轻卡通风",
        days: 1,
        eventCount: 1,
        knowledgeCount: 1,
      },
      importantRules: ["所有 event 配图统一服从给定 style，不得自行发散风格。"],
      events: [
        {
          sequence: 1,
          shortName: "测试地点",
          poi: "测试地点",
          imagePath: "/mock/files/comments/test_trace_001.jpeg",
          subject: "江南菜肴、清鲜",
          avoid: ["楼层标识", "店招文字", "价格标签"],
        },
      ],
      knowledge: [{ name: "湘湖旅游度假区", visual: "滨湖风光与江南水岸" }],
    },
    commentCards: [
      {
        commentId: params.commentId,
        eventId: `evt_${params.mapId}`,
        poiName: "测试地点",
        excerpt: "评论内容用于测试 trace diagnostics。",
        thumbnail: "/mock/files/comments/test_trace_001.jpeg",
        subject: "江南菜肴、清鲜",
        avoid: ["楼层标识", "店招文字", "价格标签"],
      },
    ],
    runHistory: [
      {
        runId: params.sourceRunId,
        mapId: params.mapId,
        datasetKey: "hangzhou",
        status: "completed",
        stage: "regenerate",
        providerMode: "live",
        styleKey: "young-cartoon",
        promptVersion: "phase4_reference_v1",
        referenceIds: [],
        warnings: [],
        startedAt: "2026-07-05T05:34:36.985Z",
        endedAt: "2026-07-05T05:35:40.652Z",
        durationSeconds: 64,
        artifacts: {
          routePath: `/mock/routes/${params.mapId}.route.md`,
          posterPath: `/mock/posters/${params.mapId}__${params.sourceRunId}.png`,
          mapPath: `/mock/maps/${params.mapId}.view.json`,
        },
        isSelectedPosterSource: true,
        isLatestLifecycle: false,
        posterAssetState: "present",
      },
      {
        runId: params.lifecycleRunId,
        mapId: params.mapId,
        datasetKey: "hangzhou",
        status: "completed",
        stage: "confirm",
        providerMode: "live",
        styleKey: undefined,
        promptVersion: undefined,
        referenceIds: [],
        warnings: [],
        startedAt: "2026-07-05T05:39:37.088Z",
        endedAt: "2026-07-05T05:39:37.088Z",
        durationSeconds: 1,
        artifacts: {
          routePath: `/mock/routes/${params.mapId}.route.md`,
          posterPath: `/mock/posters/${params.mapId}__${params.sourceRunId}.png`,
          mapPath: `/mock/maps/${params.mapId}.view.json`,
        },
        isSelectedPosterSource: false,
        isLatestLifecycle: true,
        posterAssetState: "present",
      },
    ],
    integrityIssues: [],
  };
}

const detailA = createDetail({
  mapId: "map_a",
  mapName: "杭州 A",
  sourceRunId: "run_source_a",
  lifecycleRunId: "run_confirm_a",
  commentId: "comment_a",
});

const detailB = createDetail({
  mapId: "map_b",
  mapName: "杭州 B",
  sourceRunId: "run_source_b",
  lifecycleRunId: "run_confirm_b",
  commentId: "comment_b",
});

const overview: TraceOverviewViewModel = {
  globalStats: {
    totalMapCount: 2,
    totalRunCount: 6,
    completedRunCount: 6,
    failedRunCount: 0,
    incompleteRunCount: 0,
    fallbackRunCount: 1,
    fallbackRate: 0.167,
    averageDurationSeconds: 42.5,
    orphanRunCount: 0,
    latestUpdatedAt: "2026-07-05T05:39:37.081Z",
  },
  datasetStats: [
    {
      datasetKey: "guangzhou",
      mapCount: 0,
      runCount: 0,
      completedRunCount: 0,
      failedRunCount: 0,
      incompleteRunCount: 0,
      fallbackRunCount: 0,
      fallbackRate: null,
      averageDurationSeconds: null,
      orphanRunCount: 0,
      latestUpdatedAt: null,
    },
    {
      datasetKey: "hangzhou",
      mapCount: 2,
      runCount: 6,
      completedRunCount: 6,
      failedRunCount: 0,
      incompleteRunCount: 0,
      fallbackRunCount: 1,
      fallbackRate: 0.167,
      averageDurationSeconds: 42.5,
      orphanRunCount: 0,
      latestUpdatedAt: "2026-07-05T05:39:37.081Z",
    },
  ],
  mapItems: [
    {
      mapId: "map_a",
      mapName: "杭州 A",
      city: "萧山",
      datasetKey: "hangzhou",
      mapStatus: "confirmed",
      eventCount: 1,
      updatedAt: "2026-07-05T05:39:37.081Z",
      currentRunIdRaw: "run_confirm_a",
      posterVersionCount: 2,
      selectedPosterVersionId: "run_source_a",
      currentPosterPath: "/mock/posters/map_a__run_source_a.png",
      selectedPosterSourceRunId: "run_source_a",
      selectedPosterSourceRunStatus: "completed",
      selectedPosterSourceRunProviderMode: "live",
      latestLifecycleRunId: "run_confirm_a",
      latestLifecycleRunStatus: "completed",
      latestLifecycleRunStage: "confirm",
      posterVersionIds: ["run_generate_a", "run_source_a"],
      relatedRunIds: ["run_generate_a", "run_source_a", "run_confirm_a"],
      selectedCommentIds: ["comment_a"],
      issueCodes: [],
    },
    {
      mapId: "map_b",
      mapName: "杭州 B",
      city: "萧山",
      datasetKey: "hangzhou",
      mapStatus: "confirmed",
      eventCount: 1,
      updatedAt: "2026-07-05T05:41:37.081Z",
      currentRunIdRaw: "run_confirm_b",
      posterVersionCount: 2,
      selectedPosterVersionId: "run_source_b",
      currentPosterPath: "/mock/posters/map_b__run_source_b.png",
      selectedPosterSourceRunId: "run_source_b",
      selectedPosterSourceRunStatus: "completed",
      selectedPosterSourceRunProviderMode: "fallback",
      latestLifecycleRunId: "run_confirm_b",
      latestLifecycleRunStatus: "completed",
      latestLifecycleRunStage: "confirm",
      posterVersionIds: ["run_generate_b", "run_source_b"],
      relatedRunIds: ["run_generate_b", "run_source_b", "run_confirm_b"],
      selectedCommentIds: ["comment_b"],
      issueCodes: ["selected_comments_mismatch"],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RunsPage", () => {
  it("会渲染作品视角统计与初始详情", () => {
    render(<RunsPage overview={overview} initialDetail={detailA} />);

    expect(screen.getByText("作品诊断台")).toBeInTheDocument();
    expect(screen.getByText("全局统计")).toBeInTheDocument();
    expect(screen.getByText("当前态身份卡")).toBeInTheDocument();
    expect(screen.getByText("当前选中海报来源 run")).toBeInTheDocument();
    expect(screen.getAllByText("杭州 A").length).toBeGreaterThan(0);
    expect(screen.getByText("AI Contract")).toBeInTheDocument();
  });

  it("支持按 commentId 搜索，并在切换作品时懒加载详情", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ detail: detailB }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RunsPage overview={overview} initialDetail={detailA} />);

    fireEvent.change(screen.getAllByPlaceholderText("搜 map / run / comment / version")[0], {
      target: { value: "comment_b" },
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /杭州 B/ }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /杭州 B/ })[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText("杭州 B").length).toBeGreaterThan(0);
      expect(screen.getAllByText("run_source_b").length).toBeGreaterThan(0);
    });
  });
});
