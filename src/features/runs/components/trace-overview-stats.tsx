"use client";

import { useMemo, useState } from "react";
import { formatDurationSecondsLabel, formatPercentLabel, formatDateTimeLabel } from "@/src/features/runs/presentation";
import type { TraceDatasetStats, TraceGlobalStats } from "@/src/server/trace-diagnostics/types";

type TraceOverviewStatsProps = {
  globalStats: TraceGlobalStats;
  datasetStats: TraceDatasetStats[];
};

export function TraceOverviewStats(props: TraceOverviewStatsProps) {
  const [scale, setScale] = useState<"compact" | "standard" | "comfortable">("compact");

  const cardGridClass = useMemo(() => {
    if (scale === "comfortable") {
      return "grid-cols-[repeat(auto-fit,minmax(180px,1fr))]";
    }
    if (scale === "standard") {
      return "grid-cols-[repeat(auto-fit,minmax(150px,1fr))]";
    }
    return "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]";
  }, [scale]);

  const valueTextClass = scale === "comfortable" ? "text-3xl" : scale === "standard" ? "text-2xl" : "text-xl";

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">全局统计</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                先判断系统整体稳不稳，再下钻到单作品。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                最近更新：{formatDateTimeLabel(props.globalStats.latestUpdatedAt)}
              </span>
              <div className="inline-flex rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-1 text-xs">
                {[
                  ["compact", "紧凑"],
                  ["standard", "标准"],
                  ["comfortable", "宽松"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setScale(value as "compact" | "standard" | "comfortable")}
                    className={`rounded-full px-3 py-1 transition ${
                      scale === value
                        ? "bg-[var(--bg-surface)] text-[var(--text-strong)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`mt-5 grid gap-3 ${cardGridClass}`}>
            {[
              { label: "总作品", value: props.globalStats.totalMapCount },
              { label: "总 run", value: props.globalStats.totalRunCount },
              { label: "成功", value: props.globalStats.completedRunCount },
              { label: "失败", value: props.globalStats.failedRunCount },
              { label: "未完成", value: props.globalStats.incompleteRunCount },
              { label: "fallback", value: props.globalStats.fallbackRunCount },
              { label: "fallback 占比", value: formatPercentLabel(props.globalStats.fallbackRate) },
              { label: "平均耗时", value: formatDurationSecondsLabel(props.globalStats.averageDurationSeconds) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-4"
              >
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{item.label}</p>
                <p className={`mt-3 font-semibold tracking-[-0.04em] text-[var(--text-strong)] ${valueTextClass}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {props.datasetStats.map((dataset) => (
          <article
            key={dataset.datasetKey}
            className="rounded-[26px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">数据集</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                  {dataset.datasetKey}
                </h2>
              </div>
              <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                最近更新：{formatDateTimeLabel(dataset.latestUpdatedAt)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">map</p>
                <p className={`mt-2 font-semibold text-[var(--text-strong)] ${valueTextClass}`}>{dataset.mapCount}</p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">run</p>
                <p className={`mt-2 font-semibold text-[var(--text-strong)] ${valueTextClass}`}>{dataset.runCount}</p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">fallback</p>
                <p className={`mt-2 font-semibold text-[var(--text-strong)] ${valueTextClass}`}>
                  {formatPercentLabel(dataset.fallbackRate)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm leading-6 text-[var(--text-muted)]">
              <p>成功：{dataset.completedRunCount}</p>
              <p>失败 + 未完成：{dataset.failedRunCount + dataset.incompleteRunCount}</p>
              <p>平均耗时：{formatDurationSecondsLabel(dataset.averageDurationSeconds)}</p>
              <p>orphan runs：{dataset.orphanRunCount}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
