"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  LoaderCircle,
  SearchCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  defaultVideoModel,
  type SelectableVideoModel,
  videoModelLabels,
} from "@/src/config/video-models";
import type { MapViewModel } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { getVideoStylePreset } from "@/src/engine/prompts";
import { canUsePublicImageAsModelInput } from "@/src/engine/pipelines/model-image-inputs";

type DynamicMapPageProps = {
  map: MapViewModel;
  initialTab: "map" | "video";
  availableVideoModels: SelectableVideoModel[];
  initialVideoPromptInstruction?: string;
};

const durationOptions = [5, 7, 9] as const;

export function DynamicMapPage(props: DynamicMapPageProps) {
  const router = useRouter();
  const defaultVideoPromptInstruction = useMemo(
    () => getVideoStylePreset(props.map.style).prompt,
    [props.map.style],
  );
  const [selectedEventId, setSelectedEventId] = useState(props.map.selectedEventId);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"map" | "video">(props.initialTab);
  const [selectedDuration, setSelectedDuration] = useState<(typeof durationOptions)[number]>(
    props.map.videoDurationSeconds === 7 || props.map.videoDurationSeconds === 9
      ? props.map.videoDurationSeconds
      : 5,
  );
  const [selectedVideoModel, setSelectedVideoModel] = useState<SelectableVideoModel>(
    props.availableVideoModels.includes(props.map.videoModel as SelectableVideoModel)
      ? (props.map.videoModel as SelectableVideoModel)
      : props.availableVideoModels[0] ?? defaultVideoModel,
  );
  const [videoPromptInstruction, setVideoPromptInstruction] = useState(
    props.initialVideoPromptInstruction ?? defaultVideoPromptInstruction,
  );

  const canDownloadPoster = props.map.posterPath.trim().length > 0;
  const canGenerateFromPoster = canUsePublicImageAsModelInput(props.map.posterPath);
  const hasAvailableVideoModels = props.availableVideoModels.length > 0;
  const canGenerateVideo = canGenerateFromPoster && hasAvailableVideoModels && !generatingVideo;
  const hasGeneratedVideo = Boolean(props.map.videoPath);
  const isUsingDefaultVideoPrompt = videoPromptInstruction === defaultVideoPromptInstruction;
  const videoModelLabel = props.map.videoModel
    && props.availableVideoModels.includes(props.map.videoModel as SelectableVideoModel)
      ? videoModelLabels[props.map.videoModel as SelectableVideoModel]
      : null;
  const posterExtension =
    props.map.posterPath.split(".").pop()?.split("?")[0]?.trim() || "png";
  const posterDownloadFileName = `${props.map.mapName}-${props.map.city}海报.${posterExtension}`;
  const videoDownloadFileName = `${props.map.mapName}-${props.map.city}旅行视频.mp4`;

  const selectedEvent = useMemo(
    () =>
      props.map.events.find((event) => event.eventId === selectedEventId) ?? props.map.events[0],
    [props.map.events, selectedEventId],
  );
  const primaryPicture = selectedEvent.commentPictures[0];
  const galleryPictures = selectedEvent.commentPictures.slice(1);

  function handleTabChange(nextTab: "map" | "video") {
    setActiveTab(nextTab);
    if (nextTab === "video") {
      router.replace(`/maps/${props.map.mapId}?tab=video`);
      return;
    }
    router.replace(`/maps/${props.map.mapId}`);
  }

  async function handleDeleteMap() {
    const confirmed = window.confirm(`确认删除《${props.map.mapName}》吗？删除后无法恢复。`);
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      const response = await fetch(`/api/maps/${props.map.mapId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "删除地图失败");
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleGenerateVideo() {
    try {
      setGeneratingVideo(true);
      setError("");
      const response = await fetch(`/api/maps/${props.map.mapId}/video/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds: selectedDuration,
          videoModel: selectedVideoModel,
          promptInstruction: videoPromptInstruction,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "视频生成失败");
      }

      router.push(payload.waitPath);
    } catch (requestError) {
      setError((requestError as Error).message);
      setGeneratingVideo(false);
    }
  }

  return (
    <SiteShell
      title={props.map.mapName}
      eyebrow="动态地图"
      description="沿着时间顺序浏览这趟旅行，在右侧查看当前地点的图文记录。"
      activeHref="/"
      datasetKey={props.map.datasetKey}
      actions={
        <>
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-soft)]">
            <button
              type="button"
              onClick={() => handleTabChange("map")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "map"
                  ? "bg-[var(--bg-soft)] text-[var(--text-strong)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
              }`}
            >
              地图
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("video")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "video"
                  ? "bg-[var(--bg-soft)] text-[var(--text-strong)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)]"
              }`}
            >
              视频
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--text-muted)] opacity-55"
            >
              图文
            </button>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
          >
            <ArrowLeft className="h-4 w-4" />
            回到主页
          </Link>
          <Link
            href={`/runs?mapId=${props.map.mapId}`}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
          >
            <SearchCheck className="h-4 w-4" />
            查看测试追踪
          </Link>
          <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-muted)]">
            {props.map.city}
          </span>
          <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-muted)]">
            {props.map.nodes.length} 站
          </span>
          {canDownloadPoster ? (
            <a
              href={props.map.posterPath}
              download={posterDownloadFileName}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
            >
              <Download className="h-4 w-4" />
              下载图片
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-muted)] opacity-60"
            >
              <Download className="h-4 w-4" />
              下载图片
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteMap}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)] disabled:opacity-60"
          >
            {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            删除路线
          </button>
        </>
      }
    >
      {error ? (
        <div className="mb-4 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}

      {activeTab === "map" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="overflow-hidden rounded-[24px] bg-[var(--bg-soft)]">
              <Image
                src={props.map.posterPath}
                alt={props.map.mapName}
                width={1600}
                height={1100}
                unoptimized
                className="max-h-[680px] w-full object-contain"
              />
            </div>

            <div className="mt-5 rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="mb-4">
                <div>
                  <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">旅程路线</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    按照时间顺序浏览每一站，点击下方节点切换右侧内容。
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-3 pb-2">
                  {props.map.nodes.map((node, index) => {
                    const selected = node.eventId === selectedEvent.eventId;
                    return (
                      <button
                        type="button"
                        key={node.eventId}
                        onClick={() => setSelectedEventId(node.eventId)}
                        className={`w-[214px] rounded-[22px] border p-3 text-left transition ${
                          selected
                            ? "border-[var(--accent-primary)] bg-[var(--accent-tint)]"
                            : "border-[color:var(--line-subtle)] bg-[var(--bg-soft)] hover:border-[var(--bg-soft-strong)]"
                        }`}
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                              selected
                                ? "bg-[var(--accent-primary)] text-white"
                                : "bg-[var(--bg-surface)] text-[var(--text-strong)]"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-strong)]">{node.title}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {node.day} · {node.time}
                            </p>
                          </div>
                        </div>
                        {node.thumbnail ? (
                          <Image
                            src={node.thumbnail}
                            alt={node.title}
                            width={240}
                            height={120}
                            unoptimized
                            className="mb-3 h-28 w-full rounded-[16px] object-cover"
                          />
                        ) : null}
                        <p className="text-sm leading-6 text-[var(--text-muted)]">{node.excerpt}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)] xl:sticky xl:top-6">
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前地点</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
              {selectedEvent.poiName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{selectedEvent.poiLocation}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              {selectedEvent.day} · {selectedEvent.time}
            </p>

            {primaryPicture ? (
              <button
                type="button"
                onClick={() => setPreviewImage(primaryPicture.url)}
                className="mt-5 overflow-hidden rounded-[22px] border border-[color:var(--line-subtle)]"
              >
                <Image
                  src={primaryPicture.url}
                  alt={primaryPicture.name ?? selectedEvent.poiName}
                  width={560}
                  height={420}
                  unoptimized
                  className="h-[260px] w-full object-cover"
                />
              </button>
            ) : (
              <div className="mt-5 flex h-[260px] items-center justify-center rounded-[22px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-sm text-[var(--text-muted)]">
                暂无地点图片
              </div>
            )}

            <p className="mt-5 text-sm leading-7 text-[var(--text-muted)]">
              {selectedEvent.commentText || "暂时没有文字描述。"}
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              {[selectedEvent.categoryL1, selectedEvent.categoryL2, selectedEvent.categoryL3]
                .filter(Boolean)
                .map((item) => (
                  <span key={item} className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1">
                    {item}
                  </span>
                ))}
            </div>

            {galleryPictures.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {galleryPictures.map((picture) => (
                  <button
                    type="button"
                    key={picture.url}
                    onClick={() => setPreviewImage(picture.url)}
                    className="overflow-hidden rounded-[18px] border border-[color:var(--line-subtle)]"
                  >
                    <Image
                      src={picture.url}
                      alt={picture.name ?? selectedEvent.poiName}
                      width={320}
                      height={240}
                      unoptimized
                      className="h-32 w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="grid gap-6">
              {hasGeneratedVideo ? (
                <div className="grid gap-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs tracking-[0.12em] text-[var(--text-muted)]">
                    {videoModelLabel ? (
                      <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                        {videoModelLabel}
                      </span>
                    ) : null}
                    {props.map.videoDurationSeconds ? (
                      <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
                        {props.map.videoDurationSeconds}s
                      </span>
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-[24px] bg-[var(--bg-soft)]">
                    <video
                      src={props.map.videoPath}
                      controls
                      preload="metadata"
                      className="max-h-[680px] w-full"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">视频生成</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                    把这张旅行地图生成短视频
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    视频会复用当前地图的风格，只对镜头和微动态进行扩展，不改变原图的主要信息结构。
                  </p>
                </div>
              )}

              <div className="rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-[var(--text-strong)]">
                    视频时长
                    <select
                      value={selectedDuration}
                      onChange={(event) => setSelectedDuration(Number(event.target.value) as (typeof durationOptions)[number])}
                      className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] text-[var(--text-strong)] outline-none transition"
                    >
                      {durationOptions.map((duration) => (
                        <option key={duration} value={duration}>
                          {duration} 秒
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-[var(--text-strong)]">
                    视频模型
                    <select
                      value={selectedVideoModel}
                      onChange={(event) => setSelectedVideoModel(event.target.value as SelectableVideoModel)}
                      disabled={!hasAvailableVideoModels}
                      className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] text-[var(--text-strong)] outline-none transition disabled:opacity-60"
                    >
                      {props.availableVideoModels.map((videoModel) => (
                        <option key={videoModel} value={videoModel}>
                          {videoModelLabels[videoModel]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-strong)]">风格提示词</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                        默认提供当前地图风格的系统提示词。你可以删掉后自己写；系统通用护栏仍会保留。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVideoPromptInstruction(defaultVideoPromptInstruction)}
                      disabled={isUsingDefaultVideoPrompt}
                      className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)] disabled:opacity-60"
                    >
                      恢复默认
                    </button>
                  </div>

                  <textarea
                    aria-label="风格提示词"
                    value={videoPromptInstruction}
                    onChange={(event) => setVideoPromptInstruction(event.target.value)}
                    rows={8}
                    spellCheck={false}
                    className="mt-4 w-full rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm leading-7 text-[var(--text-strong)] outline-none transition"
                  />

                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {isUsingDefaultVideoPrompt
                      ? "当前使用系统默认风格提示词。"
                      : "当前使用自定义风格提示词。"}
                  </p>
                </div>

                <div className="mt-4 rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
                  <p className="text-sm font-medium text-[var(--text-strong)]">当前生成规则</p>
                  {!hasAvailableVideoModels ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--danger-ink)]">
                      当前环境没有可用的视频模型配置，请先补齐服务端 env。
                    </p>
                  ) : !canGenerateFromPoster ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--danger-ink)]">
                      当前底片不支持视频生成，请先获得 PNG/JPG/WebP 底片。
                    </p>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                      当前将使用 {videoModelLabels[selectedVideoModel]} 生成 {selectedDuration} 秒视频，并默认生成环境音。
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {hasGeneratedVideo ? (
                    <a
                      href={props.map.videoPath}
                      download={videoDownloadFileName}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)]"
                    >
                      <Download className="h-4 w-4" />
                      下载视频
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleGenerateVideo}
                    disabled={!canGenerateVideo}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-page)] disabled:opacity-60"
                  >
                    {generatingVideo ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {hasGeneratedVideo ? "重新生成视频" : "生成视频"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">视频说明</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-muted)]">
              <p>视频会基于当前海报生成，不会自动改变静态图版本。</p>
              <p>如果后续重新生成成功，当前地图只保留最新的视频产物路径。</p>
              <p>输入框只控制风格提示词；系统通用约束和参考图约束仍会固定保留。</p>
              <p>图文 detab 仍处于占位状态，本轮不会提前实现。</p>
            </div>
          </aside>
        </div>
      )}

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,20,17,0.72)] p-6">
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-6 top-6 rounded-full bg-white/92 px-4 py-2 text-sm font-medium text-[var(--text-strong)]"
          >
            关闭
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-[24px] bg-[var(--bg-surface)] p-4 shadow-2xl">
            <Image
              src={previewImage}
              alt="评论原图预览"
              width={1600}
              height={1200}
              unoptimized
              className="max-h-[82vh] rounded-[18px] object-contain"
            />
          </div>
        </div>
      ) : null}
    </SiteShell>
  );
}
