"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteShell } from "@/src/components/site-shell";
import { TraceMapDetailPanel } from "@/src/features/runs/components/trace-map-detail-panel";
import {
  TraceMapListPanel,
  type TraceMapListFilters,
} from "@/src/features/runs/components/trace-map-list-panel";
import { TraceOverviewStats } from "@/src/features/runs/components/trace-overview-stats";
import { matchesMapSearch } from "@/src/features/runs/presentation";
import type {
  TraceMapDetailViewModel,
  TraceOverviewViewModel,
} from "@/src/server/trace-diagnostics/types";

type RunsPageProps = {
  overview: TraceOverviewViewModel;
  initialDetail: TraceMapDetailViewModel | null;
};

const defaultFilters: TraceMapListFilters = {
  searchQuery: "",
  datasetKey: "all",
  mapStatus: "all",
  selectedPosterSourceRunStatus: "all",
  latestLifecycleRunStatus: "all",
  providerMode: "all",
};

export function RunsPage(props: RunsPageProps) {
  const [filters, setFilters] = useState<TraceMapListFilters>(defaultFilters);
  const [requestedMapId, setRequestedMapId] = useState(
    props.initialDetail?.mapId ?? props.overview.mapItems[0]?.mapId ?? "",
  );
  const [detailCache, setDetailCache] = useState<Record<string, TraceMapDetailViewModel>>(
    props.initialDetail ? { [props.initialDetail.mapId]: props.initialDetail } : {},
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const filteredMapItems = useMemo(
    () =>
      props.overview.mapItems.filter((item) => {
        if (!matchesMapSearch(item, filters.searchQuery)) {
          return false;
        }
        if (filters.datasetKey !== "all" && item.datasetKey !== filters.datasetKey) {
          return false;
        }
        if (filters.mapStatus !== "all" && item.mapStatus !== filters.mapStatus) {
          return false;
        }
        if (
          filters.selectedPosterSourceRunStatus !== "all" &&
          item.selectedPosterSourceRunStatus !== filters.selectedPosterSourceRunStatus
        ) {
          return false;
        }
        if (
          filters.latestLifecycleRunStatus !== "all" &&
          item.latestLifecycleRunStatus !== filters.latestLifecycleRunStatus
        ) {
          return false;
        }
        if (filters.providerMode !== "all" && item.selectedPosterSourceRunProviderMode !== filters.providerMode) {
          return false;
        }
        return true;
      }),
    [filters, props.overview.mapItems],
  );

  const selectedMapId = useMemo(() => {
    if (!filteredMapItems.length) {
      return "";
    }

    if (filteredMapItems.some((item) => item.mapId === requestedMapId)) {
      return requestedMapId;
    }

    return filteredMapItems[0].mapId;
  }, [filteredMapItems, requestedMapId]);

  const selectedDetail = selectedMapId ? detailCache[selectedMapId] ?? null : null;

  useEffect(() => {
    if (!selectedMapId || selectedDetail) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadDetail() {
      try {
        setLoadingDetail(true);
        setDetailError("");
        const response = await fetch(`/api/runs/maps/${selectedMapId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          detail?: TraceMapDetailViewModel;
          error?: string;
        };

        if (!response.ok || !payload.detail) {
          throw new Error(payload.error ?? "读取作品追踪详情失败");
        }

        if (!active) {
          return;
        }

        setDetailCache((current) => ({
          ...current,
          [payload.detail!.mapId]: payload.detail!,
        }));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        if (!active) {
          return;
        }
        setDetailError((error as Error).message || "读取作品追踪详情失败");
      } finally {
        if (active) {
          setLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDetail, selectedMapId]);

  return (
    <SiteShell
      title="测试追踪页"
      eyebrow="作品诊断台"
      description="先按作品定位，再查看当前态、AI Contract、当前产物与 run 时间线。"
      activeHref="/runs"
    >
      <div className="grid gap-6">
        <TraceOverviewStats
          globalStats={props.overview.globalStats}
          datasetStats={props.overview.datasetStats}
        />

        <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <TraceMapListPanel
            mapItems={filteredMapItems}
            totalCount={props.overview.mapItems.length}
            selectedMapId={selectedMapId}
            filters={filters}
            onSelectMap={setRequestedMapId}
            onFiltersChange={setFilters}
          />

          <TraceMapDetailPanel
            detail={selectedDetail}
            loading={loadingDetail}
            error={detailError}
          />
        </div>
      </div>
    </SiteShell>
  );
}
