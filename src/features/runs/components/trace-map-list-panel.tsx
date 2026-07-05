import {
  getDemoDataset,
  supportedDatasetKeys,
  type DemoDatasetKey,
} from "@/src/config/demo";
import type { RunTrace } from "@/src/contracts/domain";
import { summarizeIssueCodes } from "@/src/features/runs/presentation";
import {
  TraceIssueChip,
  TraceMapStatusPill,
  TraceProviderModePill,
  TraceRunStatusPill,
} from "@/src/features/runs/components/trace-badges";
import type { TraceMapListItem, TraceRunStatusValue } from "@/src/server/trace-diagnostics/types";

export type TraceMapListFilters = {
  searchQuery: string;
  datasetKey: "all" | DemoDatasetKey;
  mapStatus: "all" | "draft" | "confirmed" | "failed";
  selectedPosterSourceRunStatus: "all" | TraceRunStatusValue;
  latestLifecycleRunStatus: "all" | TraceRunStatusValue;
  providerMode: "all" | RunTrace["providerMode"] | "missing";
};

type TraceMapListPanelProps = {
  mapItems: TraceMapListItem[];
  totalCount: number;
  selectedMapId: string;
  filters: TraceMapListFilters;
  onSelectMap: (mapId: string) => void;
  onFiltersChange: (next: TraceMapListFilters) => void;
};

const runStatusOptions: Array<{ value: TraceRunStatusValue; label: string }> = [
  { value: "running", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "incomplete", label: "未完成" },
  { value: "missing", label: "缺失" },
];

const providerModeOptions: Array<{ value: RunTrace["providerMode"] | "missing"; label: string }> = [
  { value: "live", label: "实时模型" },
  { value: "fallback", label: "本地回退" },
  { value: "missing", label: "未记录" },
];

const datasetFilterOptions = supportedDatasetKeys.map((key) => {
  const dataset = getDemoDataset(key);
  return {
    value: key,
    label: `${dataset.city} · ${key}`,
  };
});

export function TraceMapListPanel(props: TraceMapListPanelProps) {
  const issueSummary =
    props.mapItems.find((item) => item.mapId === props.selectedMapId)?.issueCodes ?? [];

  return (
    <aside className="grid gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-140px)] xl:grid-rows-[auto_minmax(0,1fr)]">
      <section className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">作品索引</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              当前筛出 {props.mapItems.length} / {props.totalCount} 个作品
            </p>
          </div>
          {issueSummary.length ? (
            <div className="flex flex-wrap justify-end gap-2">
              {summarizeIssueCodes(issueSummary).map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-strong)]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm text-[var(--text-strong)]">
            <span className="text-xs tracking-[0.12em] text-[var(--text-muted)]">搜索</span>
            <input
              value={props.filters.searchQuery}
              onChange={(event) =>
                props.onFiltersChange({
                  ...props.filters,
                  searchQuery: event.target.value,
                })
              }
              placeholder="搜 map / run / comment / version"
              className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--text-strong)]">
              <span className="text-xs tracking-[0.12em] text-[var(--text-muted)]">数据集</span>
              <select
                value={props.filters.datasetKey}
                onChange={(event) =>
                  props.onFiltersChange({
                    ...props.filters,
                    datasetKey: event.target.value as TraceMapListFilters["datasetKey"],
                  })
                }
                className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
              >
                <option value="all">全部数据集</option>
                {datasetFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-[var(--text-strong)]">
              <span className="text-xs tracking-[0.12em] text-[var(--text-muted)]">作品状态</span>
              <select
                value={props.filters.mapStatus}
                onChange={(event) =>
                  props.onFiltersChange({
                    ...props.filters,
                    mapStatus: event.target.value as TraceMapListFilters["mapStatus"],
                  })
                }
                className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
              >
                <option value="all">全部状态</option>
                <option value="draft">draft</option>
                <option value="confirmed">confirmed</option>
                <option value="failed">failed</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-[var(--text-strong)]">
              <span className="text-xs tracking-[0.12em] text-[var(--text-muted)]">来源 run</span>
              <select
                value={props.filters.selectedPosterSourceRunStatus}
                onChange={(event) =>
                  props.onFiltersChange({
                    ...props.filters,
                    selectedPosterSourceRunStatus:
                      event.target.value as TraceMapListFilters["selectedPosterSourceRunStatus"],
                  })
                }
                className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
              >
                <option value="all">全部状态</option>
                {runStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-[var(--text-strong)]">
              <span className="text-xs tracking-[0.12em] text-[var(--text-muted)]">Lifecycle run</span>
              <select
                value={props.filters.latestLifecycleRunStatus}
                onChange={(event) =>
                  props.onFiltersChange({
                    ...props.filters,
                    latestLifecycleRunStatus:
                      event.target.value as TraceMapListFilters["latestLifecycleRunStatus"],
                  })
                }
                className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
              >
                <option value="all">全部状态</option>
                {runStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-[var(--text-strong)] md:col-span-2">
              <span className="text-xs tracking-[0.12em] text-[var(--text-muted)]">Provider Mode</span>
              <select
                value={props.filters.providerMode}
                onChange={(event) =>
                  props.onFiltersChange({
                    ...props.filters,
                    providerMode: event.target.value as TraceMapListFilters["providerMode"],
                  })
                }
                className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
              >
                <option value="all">全部模式</option>
                {providerModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-soft)]">
        <div className="max-h-[calc(100vh-520px)] overflow-y-auto pr-1 xl:max-h-full">
          {props.mapItems.length ? (
            props.mapItems.map((item) => {
              const isSelected = item.mapId === props.selectedMapId;

              return (
                <button
                  type="button"
                  key={item.mapId}
                  onClick={() => props.onSelectMap(item.mapId)}
                  className={`mb-3 w-full rounded-[20px] border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[var(--accent-primary)] bg-[var(--accent-tint)]"
                      : "border-[color:var(--line-subtle)] bg-[var(--bg-soft)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-strong)]">{item.mapName}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {item.city} · {item.datasetKey}
                      </p>
                    </div>
                    <TraceMapStatusPill status={item.mapStatus} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <TraceRunStatusPill status={item.selectedPosterSourceRunStatus} />
                    <TraceRunStatusPill status={item.latestLifecycleRunStatus} />
                    <TraceProviderModePill mode={item.selectedPosterSourceRunProviderMode} />
                  </div>

                  <div className="mt-3 space-y-1 text-xs leading-5 text-[var(--text-muted)]">
                    <p className="break-all">当前版本：{item.selectedPosterVersionId ?? "未识别"}</p>
                    <p className="break-all">海报来源：{item.selectedPosterSourceRunId ?? "缺失"}</p>
                    <p className="break-all">Lifecycle：{item.latestLifecycleRunId ?? "缺失"}</p>
                    <p>候选版本：{item.posterVersionCount}</p>
                  </div>

                  {item.issueCodes.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.issueCodes.slice(0, 3).map((code) => (
                        <TraceIssueChip key={code} code={code} severity={code === "selected_comments_mismatch" ? "warning" : "error"} />
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="rounded-[22px] border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-8 text-sm text-[var(--text-muted)]">
              当前筛选条件下没有作品。调整搜索词或筛选项后再试。
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
