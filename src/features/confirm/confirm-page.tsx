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
      title="二次确认页"
      eyebrow="P4 重生成"
      description="左侧看底片，右侧给自然语言修改意见。确认后直接进入动态地图页。"
      actions={<StatusPill status={props.mapRecord.status} />}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-[36px] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_42px_rgba(23,63,122,0.08)]">
          <div className="overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-white">
            <Image
              src={props.mapViewModel.posterPath}
              alt={props.mapViewModel.mapName}
              width={1600}
              height={1100}
              unoptimized
              className="max-h-[760px] w-full object-contain"
            />
          </div>
        </section>

        <aside className="rounded-[32px] border border-[color:var(--line)] bg-white p-6 shadow-[0_18px_42px_rgba(23,63,122,0.08)]">
          <h2 className="text-2xl font-black text-[var(--blue)]">{props.mapRecord.mapName}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--ink)]/70">
            当前已绑定 {props.mapRecord.eventCount} 个 event。默认会尽量保留已有构图；取消勾选后，会按你的新要求整体重绘。
          </p>

          <label className="mt-6 block text-sm font-semibold text-[var(--ink)]">
            修改 Prompt
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={7}
              placeholder="例如：让广州塔更突出，右上角增加珠江夜景氛围，整体路线更清晰。"
              className="mt-2 w-full rounded-[24px] border border-[color:var(--line)] bg-[var(--paper)] px-4 py-3 text-sm outline-none transition focus:border-[var(--cyan)]"
            />
          </label>

          <label className="mt-4 flex items-center gap-3 rounded-[20px] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={basedOnExistingImage}
              onChange={(event) => setBasedOnExistingImage(event.target.checked)}
              className="h-4 w-4 accent-[var(--orange)]"
            />
            是否基于旧图修改
          </label>

          {error ? (
            <div className="mt-4 rounded-[20px] bg-[rgba(180,56,56,0.08)] px-4 py-3 text-sm text-[#9f1d1d]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--blue)] transition hover:shadow-md"
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
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[var(--blue)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--blue-strong)]"
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
