"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { MapViewModel } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";

type DynamicMapPageProps = {
  map: MapViewModel;
};

export function DynamicMapPage(props: DynamicMapPageProps) {
  const [selectedEventId, setSelectedEventId] = useState(props.map.selectedEventId);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () =>
      props.map.events.find((event) => event.eventId === selectedEventId) ?? props.map.events[0],
    [props.map.events, selectedEventId],
  );

  return (
    <SiteShell
      title="动态地图页"
      eyebrow="P5 确定性绑定"
      description="底图只做展示；真正的交互发生在底部旅程轴与右侧常驻评论卡之间，节点和评论通过 event_id 一对一绑定。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[36px] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[0_20px_50px_rgba(23,63,122,0.08)]">
          <div className="overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-white">
            <Image
              src={props.map.posterPath}
              alt={props.map.mapName}
              width={1600}
              height={1100}
              unoptimized
              className="max-h-[680px] w-full object-contain"
            />
          </div>

          <div className="mt-5 rounded-[28px] border border-[color:var(--line)] bg-white px-4 py-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--blue)]/60">
                  底部旅程轴
                </p>
                <p className="text-sm text-[var(--ink)]/70">
                  节点数 = {props.map.nodes.length}，所有节点都由 event_id 与评论卡绑定。
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
                      className={`w-[220px] rounded-[24px] border p-3 text-left transition ${
                        selected
                          ? "border-[var(--orange)] bg-[rgba(255,122,69,0.12)] shadow-md"
                          : "border-[color:var(--line)] bg-[var(--paper)] hover:border-[var(--cyan)]"
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--blue)] text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[var(--ink)]">{node.title}</p>
                          <p className="text-xs font-semibold text-[var(--blue)]/70">
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
                          className="mb-3 h-28 w-full rounded-[18px] object-cover"
                        />
                      ) : null}
                      <p className="text-sm leading-6 text-[var(--ink)]/72">{node.excerpt}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-[32px] border border-[color:var(--line)] bg-white p-6 shadow-[0_20px_50px_rgba(23,63,122,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--orange)]">
            右侧常驻评论卡
          </p>
          <h2 className="mt-3 text-2xl font-black text-[var(--blue)]">{selectedEvent.poiName}</h2>
          <p className="mt-1 text-sm font-semibold text-[var(--blue)]/70">
            {selectedEvent.day} · {selectedEvent.time}
          </p>
          <p className="mt-4 text-sm leading-7 text-[var(--ink)]/78">{selectedEvent.commentText}</p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--blue)]">
            {[selectedEvent.categoryL1, selectedEvent.categoryL2, selectedEvent.categoryL3]
              .filter(Boolean)
              .map((item) => (
                <span key={item} className="rounded-full bg-[rgba(23,63,122,0.08)] px-3 py-1">
                  {item}
                </span>
              ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {selectedEvent.commentPictures.map((picture) => (
              <button
                type="button"
                key={picture.url}
                onClick={() => setPreviewImage(picture.url)}
                className="overflow-hidden rounded-[20px] border border-[color:var(--line)]"
              >
                <Image
                  src={picture.url}
                  alt={picture.name ?? selectedEvent.poiName}
                  width={320}
                  height={240}
                  unoptimized
                  className="h-36 w-full object-cover"
                />
              </button>
            ))}
          </div>
        </aside>
      </div>

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,32,42,0.8)] p-6">
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-6 top-6 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--blue)]"
          >
            关闭
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-[28px] border border-white/20 bg-white p-4 shadow-2xl">
            <Image
              src={previewImage}
              alt="评论原图预览"
              width={1600}
              height={1200}
              unoptimized
              className="max-h-[82vh] rounded-[20px] object-contain"
            />
          </div>
        </div>
      ) : null}
    </SiteShell>
  );
}
