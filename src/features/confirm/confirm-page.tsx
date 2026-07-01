"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Save } from "lucide-react";
import type { MapRecord, MapViewModel } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";

type ConfirmPageProps = {
  mapRecord: MapRecord;
  mapViewModel: MapViewModel;
};

export function ConfirmPage(props: ConfirmPageProps) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [basedOnExistingImage, setBasedOnExistingImage] = useState(true);
  const [pending, setPending] = useState<"regenerate" | "confirm" | null>(null);
  const [error, setError] = useState("");

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
    <SiteShell
      title={props.mapRecord.mapName}
      eyebrow="静态图确认"
      description="检查这张地图的画面和细节，确认后保存为正式作品。"
      activeHref="/workspace"
      actions={<StatusPill status={props.mapRecord.status} />}
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
              className="h-4 w-4 accent-[var(--accent-primary)]"
            />
            是否基于旧图修改
          </label>

          {error ? (
            <div className="mt-4 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
            >
              {pending === "regenerate" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              重新生成
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)]"
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
  );
}
