"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, CircleAlert, LoaderCircle } from "lucide-react";
import {
  isSelectableVideoModel,
  videoModelLabels,
} from "@/src/config/video-models";
import type { RunTrace } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";
import { isTerminalRunStatus } from "@/src/lib/run-trace";

type VideoGeneratingPageProps = {
  initialRun: RunTrace;
};

export const minimumWaitingPageVisibleMs = 1200;

const progressSteps = [
  {
    key: "preparing",
    label: "准备底片",
    description: "正在校验海报底片和视频参数。",
  },
  {
    key: "rendering",
    label: "生成视频",
    description: "正在调用视频模型生成动态内容。",
  },
  {
    key: "finalizing",
    label: "写入作品",
    description: "正在保存视频文件并同步到作品页。",
  },
] as const;

function resolveStatusTitle(run: RunTrace, activeStepLabel: string) {
  if (run.status === "failed") {
    return "视频生成失败";
  }

  if (run.status === "incomplete") {
    return "视频生成未完成";
  }

  if (run.status === "completed") {
    return "视频已生成，正在跳转";
  }

  return activeStepLabel;
}

function resolveStatusDescription(run: RunTrace, activeStepDescription: string) {
  if (run.status === "failed" || run.status === "incomplete") {
    return run.errorMessage || "本次视频生成未正常完成，请返回作品页后重试。";
  }

  if (run.status === "completed") {
    return "作品页即将切换到视频页签。";
  }

  return activeStepDescription;
}

export function VideoGeneratingPage(props: VideoGeneratingPageProps) {
  const router = useRouter();
  const redirectingRef = useRef(false);
  const enteredAtRef = useRef<number | null>(null);
  const [run, setRun] = useState(props.initialRun);
  const [error, setError] = useState("");

  const currentStepKey = run.progressStep ?? "preparing";
  const currentStepIndex = progressSteps.findIndex((step) => step.key === currentStepKey);
  const resolvedStepIndex =
    run.status === "completed"
      ? progressSteps.length - 1
      : Math.max(0, currentStepIndex);
  const activeStep = progressSteps[resolvedStepIndex];
  const videoModelLabel =
    run.videoModel && isSelectableVideoModel(run.videoModel)
      ? videoModelLabels[run.videoModel]
      : null;
  const shouldShowFailureAction = run.status === "failed" || run.status === "incomplete";
  const statusTitle = resolveStatusTitle(run, activeStep.label);
  const statusDescription = resolveStatusDescription(run, activeStep.description);

  useEffect(() => {
    if (enteredAtRef.current === null) {
      enteredAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    if (run.status !== "completed" || redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;
    const enteredAtMs = enteredAtRef.current ?? Date.now();
    const elapsedMs = Date.now() - enteredAtMs;
    const remainingMs = Math.max(0, minimumWaitingPageVisibleMs - elapsedMs);
    const timer = window.setTimeout(() => {
      router.replace(`/maps/${run.mapId}?tab=video`);
    }, remainingMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router, run]);

  useEffect(() => {
    if (isTerminalRunStatus(run.status)) {
      return;
    }

    let cancelled = false;

    async function refreshRun() {
      try {
        const response = await fetch(`/api/runs/${run.runId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "读取视频生成状态失败");
        }

        if (!cancelled) {
          setRun(payload.run as RunTrace);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError((requestError as Error).message);
        }
      }
    }

    void refreshRun();

    const timer = window.setInterval(() => {
      void refreshRun();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [run.runId, run.status]);

  return (
    <SiteShell
      title="正在生成旅行视频"
      eyebrow="视频生成中"
      description="生成完成后会自动返回作品页的视频页签。保持当前页面即可。"
      activeHref="/"
      datasetKey={run.datasetKey}
      actions={<StatusPill status={run.status} />}
    >
      <div className="mx-auto grid max-w-[980px] gap-6">
        <section className="rounded-[34px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,245,239,0.92))] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs tracking-[0.12em] text-[var(--text-muted)]">
                <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                  {run.mapId}
                </span>
                {videoModelLabel ? (
                  <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                    {videoModelLabel}
                  </span>
                ) : null}
                {run.videoDurationSeconds ? (
                  <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                    {run.videoDurationSeconds} 秒
                  </span>
                ) : null}
              </div>

              <div className="mt-8 rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-page)] p-6">
                <div className="rounded-[24px] border border-dashed border-[color:var(--line-subtle)] bg-[rgba(255,255,255,0.84)] p-6">
                  <div className="mx-auto flex aspect-[16/10] max-w-[560px] items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,rgba(247,241,227,0.92),rgba(255,253,248,0.98))] shadow-[inset_0_0_0_1px_rgba(218,209,198,0.35)]">
                    <div className="grid gap-4 text-center">
                      <div
                        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] ${
                          shouldShowFailureAction ? "text-[var(--danger-ink)]" : "text-[var(--accent-primary)]"
                        }`}
                      >
                        {shouldShowFailureAction ? (
                          <CircleAlert className="h-8 w-8" />
                        ) : (
                          <LoaderCircle className="h-8 w-8 animate-spin" />
                        )}
                      </div>
                      <div>
                        <p className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                          {statusTitle}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                          {statusDescription}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {progressSteps.map((step, index) => {
                    const completed = index < resolvedStepIndex || run.status === "completed";
                    const current = index === resolvedStepIndex && !isTerminalRunStatus(run.status);

                    return (
                      <div
                        key={step.key}
                        className={`rounded-[22px] border px-4 py-4 transition ${
                          completed
                            ? "border-transparent bg-[var(--success-tint)]"
                            : current
                              ? "border-[var(--accent-primary)] bg-[var(--accent-tint)]"
                              : "border-[color:var(--line-subtle)] bg-[var(--bg-soft)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                              completed
                                ? "bg-[var(--success-ink)] text-white"
                                : current
                                  ? "bg-[var(--accent-primary)] text-white"
                                  : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                            }`}
                          >
                            {completed ? <CheckCheck className="h-4 w-4" /> : index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-strong)]">{step.label}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {error ? (
                  <div className="mt-6 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-5">
              <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">本次视频任务</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
                  <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">Run ID</p>
                  <p className="mt-2 break-all text-sm leading-6 text-[var(--text-strong)]">{run.runId}</p>
                </div>

                <div className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
                  <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">当前状态</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-strong)]">
                    {run.status === "completed"
                      ? "视频已完成"
                      : run.status === "failed"
                        ? "生成失败"
                        : run.status === "incomplete"
                          ? "生成未完成"
                          : "正在处理中"}
                  </p>
                </div>
              </div>

              {shouldShowFailureAction ? (
                <div className="mt-5 grid gap-3">
                  <div className="rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
                    {run.errorMessage || error || "本次视频生成未正常完成。"}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/maps/${run.mapId}?tab=video`)}
                    className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-page)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    返回作品页
                  </button>
                </div>
              ) : (
                <p className="mt-5 text-sm leading-7 text-[var(--text-muted)]">
                  视频生成会在后台持续轮询，完成后自动跳转，无需手动刷新页面。
                </p>
              )}
            </aside>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
