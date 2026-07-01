import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MapRecord } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";

type ProfileHomeProps = {
  maps: MapRecord[];
  rawCount: number;
};

export function ProfileHome(props: ProfileHomeProps) {
  const totalFootprints = props.maps.reduce((sum, map) => sum + map.eventCount, 0);

  return (
    <SiteShell
      title="个人主页"
      eyebrow="旅行作品集"
      description="把一次次出发整理成可以回看的路线、地图和画面。"
      activeHref="/"
      actions={
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-primary-strong)]"
        >
          进入工作台
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <section className="mb-8 rounded-[32px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
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
            </div>
          </div>

          <article className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "旅行作品", value: props.maps.length },
            { label: "旅程足迹", value: totalFootprints },
            { label: "素材数量", value: props.rawCount },
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

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {props.maps.length ? (
          props.maps.map((map) => (
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
          ))
        ) : (
          <article className="col-span-full rounded-[28px] border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-10 text-center">
            <p className="text-lg font-semibold text-[var(--text-strong)]">还没有作品</p>
            <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
              先去工作台整理一次旅程，这里就会出现新的地图卡片。
            </p>
          </article>
        )}
      </section>
    </SiteShell>
  );
}
