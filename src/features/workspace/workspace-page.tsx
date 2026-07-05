"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import type { RawDatasetSnapshot } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { stylePromptLibrary, type SupportedStyleKey } from "@/src/engine/prompts";
import { formatCreatedAtDay, formatCreatedAtTime } from "@/src/lib/raw-created-at";
import { useWorkspaceStore } from "@/src/store/workspace-store";

type WorkspacePageProps = {
  rawDataset: RawDatasetSnapshot;
  activeDatasetKey: string;
  datasetOptions: Array<{
    key: string;
    city: string;
    defaultMapName: string;
  }>;
};

export function shouldShowSelectionRiskWarning(selectedCount: number) {
  return selectedCount > 8;
}

export function WorkspacePage(props: WorkspacePageProps) {
  const router = useRouter();
  const actionLockRef = useRef<"generate" | "preprocess" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const mapName = useWorkspaceStore((state) => state.mapName);
  const currentCity = useWorkspaceStore((state) => state.city);
  const currentStyle = useWorkspaceStore((state) => state.style);
  const selectedCommentIds = useWorkspaceStore((state) => state.selectedCommentIds);
  const initialize = useWorkspaceStore((state) => state.initialize);
  const setMapName = useWorkspaceStore((state) => state.setMapName);
  const setCity = useWorkspaceStore((state) => state.setCity);
  const setStyle = useWorkspaceStore((state) => state.setStyle);
  const toggleComment = useWorkspaceStore((state) => state.toggleComment);
  const selectAll = useWorkspaceStore((state) => state.selectAll);

  useEffect(() => {
    initialize({
      mapName: "",
      city: "",
      style: "",
      selectedCommentIds: props.rawDataset.reviews.map((review) => review.recordId),
    });
  }, [initialize, props.rawDataset.reviews]);

  const totalPictures = useMemo(
    () => props.rawDataset.reviews.reduce((sum, review) => sum + review.attachments.length, 0),
    [props.rawDataset.reviews],
  );
  const activeDataset = useMemo(
    () =>
      props.datasetOptions.find((dataset) => dataset.key === props.activeDatasetKey) ??
      props.datasetOptions[0],
    [props.activeDatasetKey, props.datasetOptions],
  );
  const selectedSummary = `${selectedCommentIds.length}/${props.rawDataset.reviews.length}个`;
  const showSelectionRiskWarning = shouldShowSelectionRiskWarning(selectedCommentIds.length);
  const hasSelectedStyle = currentStyle.trim().length > 0;
  const actionsLocked = submitting || syncing;
  const stylePreview = hasSelectedStyle
    ? stylePromptLibrary[currentStyle as SupportedStyleKey]
    : null;

  async function handleGenerate() {
    if (actionLockRef.current) {
      return;
    }

    const trimmedMapName = mapName.trim();
    const trimmedCity = currentCity.trim();
    const trimmedStyle = currentStyle.trim();

    if (!trimmedMapName || !trimmedCity || !trimmedStyle || !selectedCommentIds.length) {
      setError("请先填写地图名称、目的地、选择风格，并至少选择 1 条评论。");
      return;
    }

    try {
      actionLockRef.current = "generate";
      setSubmitting(true);
      setError("");
      const response = await fetch("/api/maps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetKey: props.activeDatasetKey,
          mapName: trimmedMapName,
          city: trimmedCity,
          style: trimmedStyle,
          selectedCommentIds,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "生成失败");
      }
      router.push(payload.waitPath ?? `/workspace/generating/${payload.runId}`);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      actionLockRef.current = null;
      setSubmitting(false);
    }
  }

  async function handlePreprocess() {
    if (actionLockRef.current) {
      return;
    }

    try {
      actionLockRef.current = "preprocess";
      setSyncing(true);
      setError("");
      const response = await fetch("/api/preprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetKey: props.activeDatasetKey,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "预处理失败");
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      actionLockRef.current = null;
      setSyncing(false);
    }
  }

  return (
    <SiteShell
      title="作者工作台"
      eyebrow="旅行地图制作"
      description="确认这张地图的名称、风格和评论素材，再生成新的旅行作品。"
      activeHref="/workspace"
      datasetKey={props.activeDatasetKey}
    >
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex h-fit flex-col gap-5 rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div>
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前配置</p>
            <div className="mt-5">
              <p className="text-sm font-medium text-[var(--text-strong)]">素材城市</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {props.datasetOptions.map((dataset) => (
                  <Link
                    key={dataset.key}
                    href={`/workspace?dataset=${dataset.key}`}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      dataset.key === props.activeDatasetKey
                        ? "bg-[var(--accent-primary)] text-white"
                        : "border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text-strong)]"
                    }`}
                  >
                    {dataset.city}
                  </Link>
                ))}
              </div>
            </div>
            <label className="mt-5 block text-sm font-medium text-[var(--text-strong)]">
              地图名称
              <input
                value={mapName}
                onChange={(event) => setMapName(event.target.value)}
                placeholder={`例如：${activeDataset?.defaultMapName ?? "杭州一日漫游"}`}
                className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] outline-none transition"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-[var(--text-strong)]">
              目的地
              <input
                value={currentCity}
                onChange={(event) => setCity(event.target.value)}
                placeholder={`例如：${activeDataset?.city ?? "杭州"}`}
                className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] outline-none transition"
              />
            </label>
            <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
              当前正在使用 {activeDataset?.city ?? "当前"} 素材。切换上方城市标签会重载评论源；这里只影响地图名称与目的地文案。
            </p>
            <label className="mt-4 block text-sm font-medium text-[var(--text-strong)]">
              风格
              <select
                value={currentStyle}
                onChange={(event) => setStyle(event.target.value as SupportedStyleKey | "")}
                className={`mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] outline-none transition ${
                  hasSelectedStyle ? "text-[var(--text-strong)]" : "text-[var(--text-muted)]"
                }`}
              >
                <option value="" disabled>
                  请选择风格
                </option>
                {Object.entries(stylePromptLibrary).map(([styleKey, option]) => (
                  <option key={styleKey} value={styleKey}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "选中评论数", value: selectedSummary },
              { label: "本地图片", value: `${totalPictures} 张` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-4"
              >
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{item.value}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => selectAll(props.rawDataset.reviews.map((review) => review.recordId))}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
          >
            <CheckCheck className="h-4 w-4" />
            全选当前评论
          </button>

          <button
            type="button"
            onClick={handlePreprocess}
            disabled={actionsLocked}
            className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-soft-strong)] disabled:opacity-60"
          >
            {syncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            更新素材列表
          </button>

          <div className="overflow-hidden rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)]">
            <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-soft)]">
              {stylePreview ? (
                <Image src={stylePreview.previewImage} alt={stylePreview.label} fill unoptimized className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-7 text-[var(--text-muted)]">
                  选择风格后，这里会显示对应的参考图预览。
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-[var(--text-strong)]">
                {stylePreview ? stylePreview.label : "未选择风格"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {stylePreview
                  ? stylePreview.description
                  : "先选择风格，再查看对应的画风说明和参考图。"}
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-[18px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
              {error}
            </div>
          ) : null}
        </aside>

        <section className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">评论素材</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                选择想放进这张地图的内容
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                单屏默认展示 8 张，更多卡片向下滚动继续查看。
              </p>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              已选 <span className="font-semibold text-[var(--text-strong)]">{selectedSummary}</span>
            </p>
          </div>

          {showSelectionRiskWarning ? (
            <div className="mb-5 rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm leading-7 text-[var(--text-muted)]">
              当前选中了 {selectedCommentIds.length} 条评论。超过 8 条后，静态图的编号稳定性和画面质量风险会明显升高；你仍然可以继续生成。
            </div>
          ) : null}

          <div className="max-h-[780px] overflow-y-auto pr-2">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {props.rawDataset.reviews.map((review) => {
                const selected = selectedCommentIds.includes(review.recordId);
                const cover = review.attachments[0];
                const displayDay = formatCreatedAtDay(review.createdAt);
                const displayTime = formatCreatedAtTime(review.createdAt);

                return (
                  <button
                    type="button"
                    key={review.recordId}
                    onClick={() => toggleComment(review.recordId)}
                    className={`group flex min-h-[320px] flex-col overflow-hidden rounded-[24px] border text-left transition ${
                      selected
                        ? "border-[var(--accent-primary)] bg-[var(--accent-tint)]"
                        : "border-[color:var(--line-subtle)] bg-[var(--bg-surface)] hover:border-[var(--bg-soft-strong)]"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-soft)]">
                      {cover ? (
                        <Image
                          src={cover.publicPath}
                          alt={cover.name}
                          fill
                          unoptimized
                          className="object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                          暂无图片
                        </div>
                      )}
                      <span
                        className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium ${
                          selected
                            ? "bg-[var(--accent-primary)] text-white"
                            : "bg-[rgba(255,255,255,0.92)] text-[var(--text-strong)]"
                        }`}
                      >
                        {selected ? "已选" : "选择"}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-3">
                        <p className="text-lg font-semibold text-[var(--text-strong)]">{review.poiName}</p>
                        <p className="mt-1 text-xs tracking-[0.12em] text-[var(--text-muted)]">
                          {displayDay || "未标注日期"} · {displayTime || "未标注时间"}
                        </p>
                      </div>
                      <p className="line-clamp-4 text-sm leading-6 text-[var(--text-muted)]">
                        {review.commentText || "暂时没有文字描述。"}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-[var(--text-muted)]">
                        <span>{review.attachments.length} 张图片</span>
                        <span>{selected ? "已加入地图" : "点击加入"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-[color:var(--line-subtle)] pt-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              选出最能代表这趟行程的片段，再生成整张地图。
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={actionsLocked || !selectedCommentIds.length || !mapName.trim() || !currentCity.trim() || !hasSelectedStyle}
              className="inline-flex items-center justify-center gap-2 self-end rounded-full bg-[var(--accent-primary)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)] disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              一键生成旅行地图
            </button>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
