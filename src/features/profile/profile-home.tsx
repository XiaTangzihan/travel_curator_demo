import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { MapRecord } from "@/src/contracts/domain";
import { SiteShell } from "@/src/components/site-shell";
import { StatusPill } from "@/src/components/status-pill";

type ProfileHomeProps = {
  maps: MapRecord[];
  rawCount: number;
};

export function ProfileHome(props: ProfileHomeProps) {
  return (
    <SiteShell
      title="个人主页"
      eyebrow="作品集入口"
      description="用广州两日行黄金评论把 AI 生成的底片图、旅程轴和原始评论卡绑成一个可追溯作品。"
      actions={
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-strong)]"
        >
          进入工作台
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[32px] border border-[color:var(--line)] bg-[var(--surface)] p-6 shadow-[0_20px_50px_rgba(23,63,122,0.08)]">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[rgba(255,122,69,0.14)] px-3 py-1 text-xs font-semibold text-[var(--orange)]">
            <Sparkles className="h-4 w-4" />
            本地闭环演示
          </p>
          <h2 className="text-3xl font-black text-[var(--blue)]">旅行者小夏</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink)]/72">
            当前作品集只围绕“广州两日行”黄金样本运行，但工程边界已经为未来飞书 Maps / Events / Files /
            Runs 接入预留了替换面。
          </p>
        </article>

        <article className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
          {[
            { label: "原始评论", value: props.rawCount },
            { label: "已生成地图", value: props.maps.length },
            { label: "当前风格", value: "年轻卡通" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[28px] border border-[color:var(--line)] bg-white/80 p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--blue)]/60">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-black text-[var(--blue)]">{item.value}</p>
            </div>
          ))}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {props.maps.length ? (
          props.maps.map((map) => (
            <Link
              key={map.mapId}
              href={`/maps/${map.mapId}`}
              className="group rounded-[32px] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[0_16px_40px_rgba(23,63,122,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(23,63,122,0.12)]"
            >
              <div className="mb-4 h-44 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(23,63,122,0.92),rgba(116,215,247,0.85))] p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  {map.city}
                </p>
                <div className="mt-12">
                  <p className="text-2xl font-black">{map.mapName}</p>
                  <p className="mt-2 text-sm text-white/80">{map.eventCount} 个 event 已绑定</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-[var(--ink)]">{map.mapName}</p>
                  <p className="text-sm text-[var(--ink)]/60">{map.city}</p>
                </div>
                <StatusPill status={map.status} />
              </div>
            </Link>
          ))
        ) : (
          <article className="col-span-full rounded-[32px] border border-dashed border-[color:var(--line)] bg-white/70 p-8 text-center">
            <p className="text-lg font-bold text-[var(--blue)]">还没有生成地图</p>
            <p className="mt-2 text-sm text-[var(--ink)]/70">
              先进入工作台跑一次 `P1 → P5`，这里就会出现首张地图卡片。
            </p>
          </article>
        )}
      </section>
    </SiteShell>
  );
}
