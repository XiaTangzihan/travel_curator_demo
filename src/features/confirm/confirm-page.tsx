"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Save } from "lucide-react";
import type { MapRecord, MapViewModel } from "@/src/contracts/domain";
import { EphemeralToast } from "@/src/components/ephemeral-toast";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";
import type { AiNotice } from "@/src/lib/ai-notice";
import {
  consumeAiNotice,
  persistAiNotice,
  resolveAiNoticeFromWarnings,
} from "@/src/lib/ai-notice";

type ConfirmPageProps = {
  mapRecord: MapRecord;
  mapViewModel: MapViewModel;
  runDurationLabel: string | null;
};

export function ConfirmPage(props: ConfirmPageProps) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [basedOnExistingImage, setBasedOnExistingImage] = useState(true);
  const [pending, setPending] = useState<"regenerate" | "select" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<AiNotice | null>(null);
  const actionsLocked = pending !== null;
  const posterVersions = props.mapRecord.posterVersions.length
    ? props.mapRecord.posterVersions
    : [
        {
          versionId: props.mapRecord.currentRunId || "initial",
          posterPath: props.mapRecord.posterPath,
          runId: props.mapRecord.currentRunId,
          createdAt: props.mapRecord.updatedAt,
        },
      ];
  const selectedPosterVersionId =
    props.mapRecord.selectedPosterVersionId ?? posterVersions.at(-1)?.versionId ?? "";
  const instructionReady = Boolean(instruction.trim());

  useEffect(() => {
    const nextNotice = consumeAiNotice();
    if (!nextNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(nextNotice);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  async function handleRegenerate() {
    try {
      setPending("regenerate");
      setError("");
      const response = await fetch(`/api/maps/${props.mapRecord.mapId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          basedOnExistingImage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "重生成失败");
      }

      const nextNotice = resolveAiNoticeFromWarnings({
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        city: props.mapRecord.city,
      });
      if (nextNotice) {
        persistAiNotice(nextNotice);
      }

      router.refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function handleSelectVersion(versionId: string) {
    if (versionId === selectedPosterVersionId) {
      return;
    }

    try {
      setPending("select");
      setError("");
      const response = await fetch(`/api/maps/${props.mapRecord.mapId}/poster-versions/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "切换海报版本失败");
      }
      router.refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function handleConfirm() {
    try {
      setPending("confirm");
      setError("");
      const response = await fetch(`/api/maps/${props.mapRecord.mapId}/confirm`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "确认失败");
      }
      router.push(`/maps/${props.mapRecord.mapId}`);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <EphemeralToast notice={notice} onClose={() => setNotice(null)} />
      <SiteShell
        title={props.mapRecord.mapName}
        eyebrow="静态图确认"
        description="检查这张地图的画面和细节，确认后保存为正式作品。"
        activeHref="/workspace"
        datasetKey={props.mapRecord.datasetKey}
        actions={
          <>
            {props.runDurationLabel ? (
              <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-muted)]">
                本次生图耗时 {props.runDurationLabel}
              </span>
            ) : null}
            <StatusPill status={props.mapRecord.status} />
          </>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="overflow-hidden rounded-[24px] bg-[var(--bg-soft)]">
              <Image
                src={props.mapViewModel.posterPath}
                alt={props.mapViewModel.mapName}
                width={1600}
                height={1100}
                unoptimized
                className="max-h-[800px] w-full object-contain"
              />
            </div>
          </section>

          <aside className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
              调整这张地图
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
              需要时补充修改意见，重新生成满意后再确认保存。
            </p>

            <div className="mt-5 rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-4">
              <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">已选内容</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                {props.mapRecord.eventCount} 个足迹
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                当前共有 {posterVersions.length} 个候选版本，确认保存时仅保留你选中的版本。
              </p>
            </div>

            <div className="mt-4 rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-4">
              <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">候选版本</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {posterVersions.map((version, index) => {
                  const selected = version.versionId === selectedPosterVersionId;
                  return (
                    <button
                      type="button"
                      key={version.versionId}
                      onClick={() => handleSelectVersion(version.versionId)}
                      disabled={actionsLocked}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? "bg-[var(--accent-primary)] text-white"
                          : "border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-strong)] hover:bg-[var(--bg-soft)]"
                      } disabled:opacity-60`}
                    >
                      第 {index + 1} 版
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-6 block text-sm font-medium text-[var(--text-strong)]">
              修改 Prompt
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                rows={7}
                placeholder="例如：让广州塔更突出，右上角增加珠江夜景氛围，整体路线更清晰。"
                className="mt-2 w-full rounded-[22px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm leading-6 outline-none transition"
              />
            </label>

            <label className="mt-4 flex items-center gap-3 rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text-strong)]">
              <input
                type="checkbox"
                checked={basedOnExistingImage}
                onChange={(event) => setBasedOnExistingImage(event.target.checked)}
                disabled={!instructionReady}
                className="h-4 w-4 accent-[var(--accent-primary)]"
              />
              是否基于旧图修改
            </label>
            {!instructionReady ? (
              <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                不填额外提示词时，默认按第一次生成的原始输入重新采样，生成新的候选版本。
              </p>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={actionsLocked}
                className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)] disabled:opacity-60"
              >
                {pending === "regenerate" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                生成新版本
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={actionsLocked}
                className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)] disabled:opacity-60"
              >
                {pending === "confirm" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                确认并保存
              </button>
            </div>
          </aside>
        </div>
      </SiteShell>
    </>
  );
}
