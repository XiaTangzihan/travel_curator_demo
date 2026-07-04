"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";
import type { RunTrace } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";
import {
  persistAiNotice,
  resolveAiNoticeFromWarnings,
} from "@/src/lib/ai-notice";
import { isTerminalRunStatus } from "@/src/lib/run-trace";

type GeneratingPageProps = {
  initialRun: RunTrace;
};

const progressSteps = [
  {
    key: "preparing",
    label: "准备素材",
    description: "正在整理评论图片、目的地和风格输入。",
  },
  {
    key: "rendering",
    label: "生成海报",
    description: "正在绘制旅行海报，保持当前页面即可。",
  },
  {
    key: "finalizing",
    label: "即将完成",
    description: "正在写入地图数据并准备跳转二次确认页。",
  },
] as const;

function shufflePreviewImages(paths: string[]) {
  const next = [...paths];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildFilmStripFrames(previewImagePaths: string[]) {
  if (!previewImagePaths.length) {
    return [];
  }

  const shuffled = shufflePreviewImages(previewImagePaths);
  const minFrameCount = 10;
  const repeated =
    shuffled.length >= minFrameCount
      ? shuffled
      : Array.from({ length: minFrameCount }, (_, index) => shuffled[index % shuffled.length]);

  return [...repeated, ...repeated.slice(0, Math.min(4, repeated.length))];
}

export function GeneratingPage(props: GeneratingPageProps) {
  const router = useRouter();
  const redirectingRef = useRef(false);
  const [run, setRun] = useState(props.initialRun);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  const currentStepKey = run.progressStep ?? "preparing";
  const currentStepIndex = progressSteps.findIndex((step) => step.key === currentStepKey);
  const resolvedStepIndex =
    run.status === "completed"
      ? progressSteps.length - 1
      : Math.max(0, currentStepIndex);
  const activeStep = progressSteps[resolvedStepIndex];
  const previewImagesJson = JSON.stringify(run.previewImagePaths ?? []);
  const filmImages = useMemo(
    () => buildFilmStripFrames(JSON.parse(previewImagesJson) as string[]),
    [previewImagesJson],
  );

  useEffect(() => {
    if (run.status !== "completed" || redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;
    const notice = resolveAiNoticeFromWarnings({
      warnings: run.warnings,
      city: run.inputSummary?.city ?? run.generateInput?.city ?? "",
    });
    if (notice) {
      persistAiNotice(notice);
    }

    router.replace(`/confirm/${run.mapId}`);
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
          throw new Error(payload.error ?? "读取生成状态失败");
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

    const timer = window.setInterval(() => {
      void refreshRun();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [run.runId, run.status]);

  async function handleRetry() {
    if (!run.generateInput || retrying) {
      return;
    }

    try {
      setRetrying(true);
      setError("");
      const response = await fetch("/api/maps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(run.generateInput),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "重新发起生成失败");
      }

      router.replace(payload.waitPath ?? `/workspace/generating/${payload.runId}`);
    } catch (requestError) {
      setError((requestError as Error).message);
      setRetrying(false);
    }
  }

  return (
    <>
      <SiteShell
        title="正在生成旅行海报"
        eyebrow="生成中"
        description="生成完成后会自动跳转到二次确认页。保持当前页面即可。"
        activeHref="/workspace"
        datasetKey={run.datasetKey}
        actions={<StatusPill status={run.status} />}
      >
        <div className="mx-auto grid max-w-[980px] gap-6">
          <section className="rounded-[34px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_292px]">
              <div className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,245,239,0.92))] p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs tracking-[0.12em] text-[var(--text-muted)]">
                  <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                    {run.inputSummary?.mapName ?? "未命名地图"}
                  </span>
                  <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                    {run.inputSummary?.city ?? run.generateInput?.city ?? "未填写目的地"}
                  </span>
                  <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                    Run {run.runId}
                  </span>
                </div>

                <div className="mt-8 rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-page)] p-6">
                  <div className="rounded-[24px] border border-dashed border-[color:var(--line-subtle)] bg-[rgba(255,255,255,0.84)] p-6">
                    <div className="mx-auto flex aspect-[16/10] max-w-[560px] items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,rgba(247,241,227,0.92),rgba(255,253,248,0.98))] shadow-[inset_0_0_0_1px_rgba(218,209,198,0.35)]">
                      <div className="grid gap-4 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]">
                          <LoaderCircle className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
                        </div>
                        <div>
                          <p className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                            {run.status === "failed"
                              ? "生成失败"
                              : run.status === "incomplete"
                                ? "生成已中断"
                                : activeStep.label}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                            {run.status === "failed" || run.status === "incomplete"
                              ? run.errorMessage || "本次生成未正常完成，请重试。"
                              : activeStep.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {progressSteps.map((step, index) => {
                      const completed = index < resolvedStepIndex;
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
                </div>
              </div>

              <aside className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-5">
                <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">本次评论图片</p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  胶片带中的图片来自这次选中的评论素材，用来提示当前生成上下文。
                </p>
                {error ? (
                  <div className="mt-4 rounded-[18px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
                    {error}
                  </div>
                ) : null}

                <div className="mt-5 overflow-hidden rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] py-4">
                  {filmImages.length ? (
                    <div className="film-strip-track flex min-w-max gap-3 px-4">
                      {filmImages.map((imagePath, index) => (
                        <div
                          key={`${imagePath}-${index}`}
                          className="w-[110px] flex-none rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-page)] p-2 shadow-[var(--shadow-soft)]"
                        >
                          <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-[var(--bg-soft)]">
                            <Image
                              src={imagePath}
                              alt="本次评论素材预览"
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 px-4">
                      {Array.from({ length: 4 }, (_, index) => (
                        <div
                          key={index}
                          className="h-[140px] w-[110px] rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-page)]"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {run.status === "failed" || run.status === "incomplete" ? (
                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={!run.generateInput || retrying}
                      className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)] disabled:opacity-60"
                    >
                      {retrying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      重试本次输入
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/workspace?dataset=${run.datasetKey}`)}
                      disabled={retrying}
                      className="inline-flex items-center justify-center rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-page)] disabled:opacity-60"
                    >
                      返回工作台
                    </button>
                  </div>
                ) : (
                  <p className="mt-5 text-sm leading-7 text-[var(--text-muted)]">
                    生成会在后台继续执行。完成后将自动跳转，不需要再次点击。
                  </p>
                )}
              </aside>
            </div>
          </section>
        </div>
      </SiteShell>

      <style jsx>{`
        .film-strip-track {
          animation: film-strip-scroll 24s linear infinite;
        }

        @keyframes film-strip-scroll {
          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-40%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .film-strip-track {
            animation: none;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
