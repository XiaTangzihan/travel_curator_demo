"use client";

import { useState } from "react";
import type { RunTrace } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";

type RunsPageProps = {
  runs: RunTrace[];
};

const traceSections = [
  { key: "rawPath", label: "原始评论数据" },
  { key: "eventsPath", label: "Event 数据集" },
  { key: "routePath", label: "route.md" },
  { key: "posterPath", label: "底片图" },
  { key: "mapPath", label: "HTML / 地图视图模型" },
] as const;

export function RunsPage(props: RunsPageProps) {
  const [selectedRunId, setSelectedRunId] = useState(props.runs[0]?.runId ?? "");
  const selectedRun = props.runs.find((run) => run.runId === selectedRunId) ?? props.runs[0];

  return (
    <SiteShell
      title="测试追踪页"
      eyebrow="留痕壳层"
      description="本期只建设结构壳层与文件留痕，不把真实飞书运行链路接进来。左侧是 run 列表，右侧保留 6 类追溯入口。"
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[32px] border border-[color:var(--line)] bg-white p-4 shadow-[0_18px_42px_rgba(23,63,122,0.08)]">
          <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--blue)]/60">
            Run 列表
          </p>
          <div className="mt-4 grid gap-3">
            {props.runs.length ? (
              props.runs.map((run) => (
                <button
                  type="button"
                  key={run.runId}
                  onClick={() => setSelectedRunId(run.runId)}
                  className={`rounded-[24px] border px-4 py-4 text-left transition ${
                    selectedRun?.runId === run.runId
                      ? "border-[var(--orange)] bg-[rgba(255,122,69,0.1)]"
                      : "border-[color:var(--line)] bg-[var(--paper)]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-[var(--ink)]">{run.runId}</p>
                    <StatusPill status={run.status} />
                  </div>
                  <p className="text-xs text-[var(--ink)]/62">{run.stage}</p>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[color:var(--line)] bg-[var(--paper)] px-4 py-6 text-sm text-[var(--ink)]/70">
                还没有 run 记录。先去工作台生成一次地图。
              </div>
            )}
          </div>
        </aside>

        <section className="grid gap-4">
          {selectedRun ? (
            <>
              <article className="rounded-[32px] border border-[color:var(--line)] bg-white p-6 shadow-[0_18px_42px_rgba(23,63,122,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--orange)]">
                      当前选中 Run
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-[var(--blue)]">{selectedRun.runId}</h2>
                  </div>
                  <StatusPill status={selectedRun.status} />
                </div>

                {selectedRun.errorMessage ? (
                  <div className="mt-4 rounded-[20px] bg-[rgba(180,56,56,0.08)] px-4 py-3 text-sm text-[#9f1d1d]">
                    {selectedRun.errorMessage}
                  </div>
                ) : null}
              </article>

              <div className="grid gap-4 md:grid-cols-2">
                {traceSections.map((section) => (
                  <article
                    key={section.key}
                    className="rounded-[28px] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--blue)]/60">
                      {section.label}
                    </p>
                    <p className="mt-3 break-all text-sm leading-6 text-[var(--ink)]/72">
                      {selectedRun.artifacts[section.key] || "本期未接入真实内容，仅保留结构位置"}
                    </p>
                  </article>
                ))}
                <article className="rounded-[28px] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--blue)]/60">
                    报错与重试
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink)]/72">
                    {selectedRun.warnings.length
                      ? selectedRun.warnings.join("；")
                      : "当前 run 没有额外警告。"}
                  </p>
                </article>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </SiteShell>
  );
}
