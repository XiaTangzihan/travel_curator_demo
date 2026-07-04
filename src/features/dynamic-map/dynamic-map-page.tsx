"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { MapViewModel } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";

type DynamicMapPageProps = {
  map: MapViewModel;
};

export function DynamicMapPage(props: DynamicMapPageProps) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState(props.map.selectedEventId);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const selectedEvent = useMemo(
    () =>
      props.map.events.find((event) => event.eventId === selectedEventId) ?? props.map.events[0],
    [props.map.events, selectedEventId],
  );
  const primaryPicture = selectedEvent.commentPictures[0];
  const galleryPictures = selectedEvent.commentPictures.slice(1);

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

  return (
    <SiteShell
      title={props.map.mapName}
      eyebrow="动态地图"
      description="沿着时间顺序浏览这趟旅行，在右侧查看当前地点的图文记录。"
      activeHref="/"
      datasetKey={props.map.datasetKey}
      actions={
        <>
          <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-muted)]">
            {props.map.city}
          </span>
          <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-muted)]">
            {props.map.nodes.length} 站
          </span>
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          {error ? (
            <div className="mb-4 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
              {error}
            </div>
          ) : null}
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
