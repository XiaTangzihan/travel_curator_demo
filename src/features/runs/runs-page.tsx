"use client";

import { useState } from "react";
import type { RunTrace } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";

type RunsPageProps = {
  runs: RunTrace[];
};

const stageLabels: Record<RunTrace["stage"], string> = {
  preprocess: "素材准备",
  generate: "首次生成",
  regenerate: "重新生成",
  confirm: "确认保存",
};

const traceSections = [
  { key: "rawPath", label: "原始评论" },
  { key: "eventsPath", label: "事件数据" },
  { key: "routePath", label: "route.md" },
  { key: "posterPath", label: "地图主图" },
  { key: "mapPath", label: "地图视图文件" },
] as const;

export function RunsPage(props: RunsPageProps) {
  const [selectedRunId, setSelectedRunId] = useState(props.runs[0]?.runId ?? "");
  const selectedRun = props.runs.find((run) => run.runId === selectedRunId) ?? props.runs[0];
  const traceFlow = selectedRun
    ? traceSections
        .filter((section) => selectedRun.artifacts[section.key])
        .map((section) => section.label)
    : [];

  return (
    <SiteShell
      title="测试追踪页"
      eyebrow="生成记录"
      description="查看每一次生成的阶段、产物路径和处理留痕。"
      activeHref="/runs"
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="px-3 pt-2 text-xs tracking-[0.14em] text-[var(--text-muted)]">Run 列表</p>
          <div className="mt-4 grid gap-3">
            {props.runs.length ? (
              props.runs.map((run) => (
                <button
                  type="button"
                  key={run.runId}
                  onClick={() => setSelectedRunId(run.runId)}
                  className={`rounded-[22px] border px-4 py-4 text-left transition ${
                    selectedRun?.runId === run.runId
                      ? "border-[var(--accent-primary)] bg-[var(--accent-tint)]"
                      : "border-[color:var(--line-subtle)] bg-[var(--bg-soft)]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-strong)]">{run.runId}</p>
                    <StatusPill status={run.status} />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{stageLabels[run.stage]}</p>
                </button>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-6 text-sm text-[var(--text-muted)]">
                还没有 run 记录。先去工作台生成一次地图。
              </div>
            )}
          </div>
        </aside>

        <section className="grid gap-4">
          {selectedRun ? (
            <>
              <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前记录</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                      {selectedRun.runId}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                      当前阶段：{stageLabels[selectedRun.stage]}
                    </p>
                    <p className="text-sm leading-7 text-[var(--text-muted)]">
                      风格键：{selectedRun.styleKey ?? "未记录"}
                    </p>
                  </div>
                  <StatusPill status={selectedRun.status} />
                </div>

                {selectedRun.errorMessage ? (
                  <div className="mt-4 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
                    {selectedRun.errorMessage}
                  </div>
                ) : null}
              </article>

              <div className="grid gap-4 md:grid-cols-2">
                {traceSections.map((section) => (
                  <article
                    key={section.key}
                    className="rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5"
                  >
                    <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{section.label}</p>
                    <p className="mt-3 break-all text-sm leading-6 text-[var(--text-muted)]">
                      {selectedRun.artifacts[section.key] || "本期未接入真实内容，仅保留结构位置"}
                    </p>
                  </article>
                ))}
                <article className="rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
                  <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">提示与警告</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    {selectedRun.warnings.length
                      ? selectedRun.warnings.join("；")
                      : "当前 run 没有额外警告。"}
                  </p>
                </article>
                <article className="rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
                  <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">输入摘要</p>
                  {selectedRun.inputSummary ? (
                    <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                      <p>地图名称：{selectedRun.inputSummary.mapName}</p>
                      <p>目的地：{selectedRun.inputSummary.city}</p>
                      <p>选中评论数：{selectedRun.inputSummary.selectedCommentCount}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      当前 run 还没有输入摘要。
                    </p>
                  )}
                </article>
              </div>

              <article className="rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">追溯链</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                    {stageLabels[selectedRun.stage]}
                  </span>
                  {traceFlow.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            </>
          ) : null}
        </section>
      </div>
    </SiteShell>
  );
}
