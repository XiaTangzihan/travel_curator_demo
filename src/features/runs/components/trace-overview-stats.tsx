import { formatDurationSecondsLabel, formatPercentLabel, formatDateTimeLabel } from "@/src/features/runs/presentation";
import type { TraceDatasetStats, TraceGlobalStats } from "@/src/server/trace-diagnostics/types";

type TraceOverviewStatsProps = {
  globalStats: TraceGlobalStats;
  datasetStats: TraceDatasetStats[];
};

export function TraceOverviewStats(props: TraceOverviewStatsProps) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <article className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">全局统计</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                先判断系统整体稳不稳，再下钻到单作品。
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
              最近更新：{formatDateTimeLabel(props.globalStats.latestUpdatedAt)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">运行提醒</p>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--text-muted)]">
            <div className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
              orphan runs：{props.globalStats.orphanRunCount}
            </div>
            <div className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
              失败 + 未完成：{props.globalStats.failedRunCount + props.globalStats.incompleteRunCount}
            </div>
            <div className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
              当前追踪页已切到作品视角，默认优先排查当前选中版本与其来源 run。
            </div>
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
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{dataset.mapCount}</p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">run</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{dataset.runCount}</p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3">
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">fallback</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
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
