"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import type { RawDatasetSnapshot } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { useWorkspaceStore } from "@/src/store/workspace-store";

type WorkspacePageProps = {
  rawDataset: RawDatasetSnapshot;
};

export function WorkspacePage(props: WorkspacePageProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const mapName = useWorkspaceStore((state) => state.mapName);
  const selectedCommentIds = useWorkspaceStore((state) => state.selectedCommentIds);
  const initialize = useWorkspaceStore((state) => state.initialize);
  const setMapName = useWorkspaceStore((state) => state.setMapName);
  const toggleComment = useWorkspaceStore((state) => state.toggleComment);
  const selectAll = useWorkspaceStore((state) => state.selectAll);

  useEffect(() => {
    initialize({
      mapName: "广州两日行",
      city: "广州",
      style: "young-cartoon",
      selectedCommentIds: props.rawDataset.reviews.map((review) => review.recordId),
    });
  }, [initialize, props.rawDataset.reviews]);

  const totalPictures = useMemo(
    () => props.rawDataset.reviews.reduce((sum, review) => sum + review.attachments.length, 0),
    [props.rawDataset.reviews],
  );

  async function handleGenerate() {
    try {
      setSubmitting(true);
      setError("");
      const response = await fetch("/api/maps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapName,
          city: "广州",
          style: "young-cartoon",
          selectedCommentIds,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "生成失败");
      }

      router.push(`/confirm/${payload.mapId}`);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreprocess() {
    try {
      setSyncing(true);
      setError("");
      const response = await fetch("/api/preprocess/guangzhou", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "预处理失败");
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SiteShell
      title="作者工作台"
      eyebrow="生成入口"
      description="左侧配置这次地图，右侧直接挑选广州 11 条评论。今天只做本地 JSON 与文件目录，不接飞书运行链路。"
      actions={
        <>
          <button
            type="button"
            onClick={handlePreprocess}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--blue)] transition hover:shadow-md"
          >
            {syncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            重跑 Part1
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting || !selectedCommentIds.length}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            一键生成旅行地图
          </button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[32px] border border-[color:var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_40px_rgba(23,63,122,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--blue)]/60">
            当前配置
          </p>
          <label className="mt-5 block text-sm font-semibold text-[var(--ink)]">
            地图名称
            <input
              value={mapName}
              onChange={(event) => setMapName(event.target.value)}
              className="mt-2 w-full rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--cyan)]"
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: "目的地", value: "广州" },
              { label: "风格", value: "年轻卡通" },
              { label: "样本评论", value: `${props.rawDataset.reviews.length} 条` },
              { label: "本地图片", value: `${totalPictures} 张` },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--blue)]/60">{item.label}</p>
                <p className="mt-2 text-lg font-black text-[var(--blue)]">{item.value}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => selectAll(props.rawDataset.reviews.map((review) => review.recordId))}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--blue)] transition hover:shadow-md"
          >
            <ImagePlus className="h-4 w-4" />
            全选广州 11 条评论
          </button>

          <p className="mt-4 text-sm text-[var(--ink)]/68">
            已选 <span className="font-black text-[var(--blue)]">{selectedCommentIds.length}</span> /
            {props.rawDataset.reviews.length}
          </p>

          {error ? (
            <div className="mt-4 rounded-[20px] bg-[rgba(180,56,56,0.08)] px-4 py-3 text-sm text-[#9f1d1d]">
              {error}
            </div>
          ) : null}
        </aside>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {props.rawDataset.reviews.map((review) => {
            const selected = selectedCommentIds.includes(review.recordId);
            return (
              <button
                type="button"
                key={review.recordId}
                onClick={() => toggleComment(review.recordId)}
                className={`rounded-[28px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selected
                    ? "border-[var(--cyan)] bg-[rgba(116,215,247,0.16)]"
                    : "border-[color:var(--line)] bg-white/90"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]/60">
                    {review.sourceDay || "?"} / {review.sourceTime || "?"}
                  </p>
                  <span className="rounded-full bg-[rgba(23,63,122,0.08)] px-2 py-1 text-xs font-semibold text-[var(--blue)]">
                    {selected ? "已选" : "未选"}
                  </span>
                </div>
                <p className="text-lg font-black text-[var(--ink)]">{review.poiName}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--ink)]/72">
                  {review.commentText}
                </p>
                <div className="mt-4 flex gap-2 overflow-hidden">
                  {review.attachments.slice(0, 3).map((attachment) => (
                    <Image
                      key={attachment.fileToken}
                      src={attachment.publicPath}
                      alt={attachment.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </section>
      </div>
    </SiteShell>
  );
}
