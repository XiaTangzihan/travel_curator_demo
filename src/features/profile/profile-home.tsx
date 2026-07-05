"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CheckSquare, LoaderCircle, Trash2, X } from "lucide-react";
import type { MapRecord } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";
import type {
  ProfileImageModelFilter,
  ProfileDatasetFilter,
  ProfileStyleFilter,
} from "@/src/features/profile/profile-home-filters";

type ProfileHomeProps = {
  maps: MapRecord[];
  rawCount: number;
  activeDatasetKey: ProfileDatasetFilter;
  activeImageModel: ProfileImageModelFilter;
  activeStyle: ProfileStyleFilter;
  datasetOptions: Array<{
    key: string;
    city: string;
  }>;
  imageModelOptions: Array<{
    key: string;
    label: string;
  }>;
  styleOptions: Array<{
    key: string;
    label: string;
  }>;
};

export function ProfileHome(props: ProfileHomeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const hasActiveCardFilters =
    props.activeDatasetKey !== "all" ||
    props.activeImageModel !== "all" ||
    props.activeStyle !== "all";

  function replaceFilters(nextFilters: {
    datasetKey: ProfileDatasetFilter;
    imageModel: ProfileImageModelFilter;
    style: ProfileStyleFilter;
  }) {
    const nextSearchParams = new URLSearchParams();
    if (nextFilters.datasetKey !== "all") {
      nextSearchParams.set("dataset", nextFilters.datasetKey);
    }

    if (nextFilters.imageModel !== "all") {
      nextSearchParams.set("imageModel", nextFilters.imageModel);
    }

    if (nextFilters.style !== "all") {
      nextSearchParams.set("style", nextFilters.style);
    }

    const queryString = nextSearchParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  function toggleMapSelection(mapId: string) {
    setSelectedMapIds((current) =>
      current.includes(mapId) ? current.filter((id) => id !== mapId) : [...current, mapId],
    );
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedMapIds([]);
    setError("");
  }

  async function handleDeleteSelected() {
    if (!selectedMapIds.length) {
      return;
    }

    const confirmed = window.confirm(`确认删除选中的 ${selectedMapIds.length} 张地图吗？删除后无法恢复。`);
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      const response = await fetch("/api/maps", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapIds: selectedMapIds }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "批量删除失败");
      }

      exitSelectionMode();
      router.refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SiteShell
      title="个人主页"
      eyebrow="旅行作品集"
      description="把一次次出发整理成可以回看的路线、地图和画面。"
      activeHref="/"
      datasetKey={props.activeDatasetKey === "all" ? undefined : props.activeDatasetKey}
      actions={
        <>
          {selectionMode ? (
            <>
              <button
                type="button"
                onClick={exitSelectionMode}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
              >
                <X className="h-4 w-4" />
                取消选择
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleting || !selectedMapIds.length}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)] disabled:opacity-60"
              >
                {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                删除选中 ({selectedMapIds.length})
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-soft)]"
            >
              <CheckSquare className="h-4 w-4" />
              批量删除
            </button>
          )}
          <Link
            href={
              props.activeDatasetKey === "all"
                ? "/workspace"
                : `/workspace?dataset=${props.activeDatasetKey}`
            }
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)]"
          >
            进入工作台
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      }
    >
      {error ? (
        <div className="mb-6 rounded-[24px] bg-[var(--danger-tint)] px-5 py-4 text-sm text-[var(--danger-ink)]">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <section className="sticky top-4 z-20 bg-[var(--bg-page)] pb-2">
          <section className="rounded-[32px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#e9c9b4,#d86d5e)] text-2xl font-semibold text-white shadow-[0_14px_28px_rgba(95,61,45,0.18)]">
                  小夏
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">你的旅行，值得一场展览。</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                    旅行者小夏
                  </h2>
                  <p className="mt-3 max-w-[560px] text-sm leading-7 text-[var(--text-muted)]">
                    在这里保存去过的城市、停留过的时刻，以及那些值得反复回看的旅程片段。
                  </p>
                  <div className="mt-5 grid gap-3 xl:grid-cols-3">
                    <label className="block text-sm font-medium text-[var(--text-strong)]">
                      目的地
                      <select
                        value={props.activeDatasetKey}
                        onChange={(event) =>
                          replaceFilters({
                            datasetKey: event.target.value as ProfileDatasetFilter,
                            imageModel: props.activeImageModel,
                            style: props.activeStyle,
                          })
                        }
                        className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] text-[var(--text-strong)] outline-none transition"
                      >
                        <option value="all">全部目的地</option>
                        {props.datasetOptions.map((dataset) => (
                          <option key={dataset.key} value={dataset.key}>
                            {dataset.city}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-[var(--text-strong)]">
                      生图模型
                      <select
                        value={props.activeImageModel}
                        onChange={(event) =>
                          replaceFilters({
                            datasetKey: props.activeDatasetKey,
                            imageModel: event.target.value as ProfileImageModelFilter,
                            style: props.activeStyle,
                          })
                        }
                        className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] text-[var(--text-strong)] outline-none transition"
                      >
                        <option value="all">全部模型</option>
                        {props.imageModelOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-[var(--text-strong)]">
                      地图风格
                      <select
                        value={props.activeStyle}
                        onChange={(event) =>
                          replaceFilters({
                            datasetKey: props.activeDatasetKey,
                            imageModel: props.activeImageModel,
                            style: event.target.value as ProfileStyleFilter,
                          })
                        }
                        className="mt-2 w-full rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[15px] text-[var(--text-strong)] outline-none transition"
                      >
                        <option value="all">全部风格</option>
                        {props.styleOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <article className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "旅行作品", value: props.maps.length },
                  { label: "当前素材", value: props.rawCount },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="min-w-[132px] rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-4"
                  >
                    <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </article>
            </div>
          </section>
        </section>

        <section className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">地图作品</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                按当前筛选结果浏览你的旅行地图
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                目的地、生图模型和地图风格共用同一套筛选口径，顶部统计会同步变化。
              </p>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              当前结果 <span className="font-semibold text-[var(--text-strong)]">{props.maps.length}</span> 张
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {props.maps.length ? (
              props.maps.map((map) => (
            selectionMode ? (
              <button
                type="button"
                key={map.mapId}
                onClick={() => toggleMapSelection(map.mapId)}
                className={`group overflow-hidden rounded-[28px] border bg-[var(--bg-surface)] text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-1 ${
                  selectedMapIds.includes(map.mapId)
                    ? "border-[var(--accent-primary)]"
                    : "border-[color:var(--line-subtle)]"
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-soft)]">
                  {map.posterPath ? (
                    <Image
                      src={map.posterPath}
                      alt={map.mapName}
                      fill
                      unoptimized
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-end bg-[linear-gradient(135deg,#f4e7d8,#e6d6c3)] p-6">
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                        {map.city}
                      </p>
                    </div>
                  )}
                  <span
                    className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-medium ${
                      selectedMapIds.includes(map.mapId)
                        ? "bg-[var(--accent-primary)] text-white"
                        : "bg-white/92 text-[var(--text-strong)]"
                    }`}
                  >
                    {selectedMapIds.includes(map.mapId) ? "已选中" : "点击选择"}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(32,27,23,0.58))] p-5 text-white">
                    <p className="text-xs tracking-[0.16em] text-white/76">{map.city}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{map.mapName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-base font-semibold text-[var(--text-strong)]">{map.mapName}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{map.eventCount} 个足迹</p>
                  </div>
                  <StatusPill status={map.status} />
                </div>
              </button>
            ) : (
              <Link
                key={map.mapId}
                href={`/maps/${map.mapId}`}
                className="group overflow-hidden rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition hover:-translate-y-1"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-soft)]">
                  {map.posterPath ? (
                    <Image
                      src={map.posterPath}
                      alt={map.mapName}
                      fill
                      unoptimized
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-end bg-[linear-gradient(135deg,#f4e7d8,#e6d6c3)] p-6">
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                        {map.city}
                      </p>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(32,27,23,0.58))] p-5 text-white">
                    <p className="text-xs tracking-[0.16em] text-white/76">{map.city}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{map.mapName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-base font-semibold text-[var(--text-strong)]">{map.mapName}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{map.eventCount} 个足迹</p>
                  </div>
                  <StatusPill status={map.status} />
                </div>
              </Link>
            )
              ))
            ) : (
              <article className="col-span-full rounded-[28px] border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-10 text-center">
                <p className="text-lg font-semibold text-[var(--text-strong)]">
                  {hasActiveCardFilters ? "当前筛选条件下暂无作品" : "还没有作品"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                  {hasActiveCardFilters
                    ? "试试切换生图模型或地图风格，或者先回到全部筛选查看已有作品。"
                    : "先去工作台整理一次旅程，这里就会出现新的地图卡片。"}
                </p>
              </article>
            )}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
