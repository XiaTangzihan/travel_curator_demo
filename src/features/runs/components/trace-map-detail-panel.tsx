"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatDateTimeLabel,
  formatDurationSecondsLabel,
} from "@/src/features/runs/presentation";
import {
  TraceAssetStatePill,
  TraceIssueChip,
  TraceMapStatusPill,
  TraceProviderModePill,
  TraceRunStatusPill,
  TraceStageChip,
} from "@/src/features/runs/components/trace-badges";
import type {
  TraceMapDetailViewModel,
  TraceRunSummary,
} from "@/src/server/trace-diagnostics/types";

type TraceMapDetailPanelProps = {
  detail: TraceMapDetailViewModel | null;
  loading: boolean;
  error: string;
};

type CopyButtonProps = {
  text: string;
  label: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => Promise<void>;
};

type CurrentArtifactCardProps = {
  title: string;
  subtitle: string;
  detailLines: string[];
  publicPath?: string | null;
  exists?: boolean;
  error?: string;
};

type RunSnapshotCardProps = {
  title: string;
  run: TraceRunSummary | null;
};

function DetailActionButton(props: CopyButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void props.onCopy(props.label, props.text)}
      className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-strong)]"
    >
      {props.copiedKey === props.label ? "已复制" : `复制 ${props.label}`}
    </button>
  );
}

function CurrentArtifactCard(props: CurrentArtifactCardProps) {
  return (
    <article className="rounded-[22px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{props.title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{props.subtitle}</p>
        </div>
        {typeof props.exists === "boolean" ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
              props.exists
                ? "border-transparent bg-[var(--success-tint)] text-[var(--success-ink)]"
                : "border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-muted)]"
            }`}
          >
            {props.exists ? "存在" : "缺失"}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
        {props.detailLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {props.error ? (
          <p className="rounded-[14px] bg-[var(--danger-tint)] px-3 py-2 text-[var(--danger-ink)]">
            {props.error}
          </p>
        ) : null}
      </div>

      {props.publicPath ? (
        <div className="mt-4">
          <a
            href={props.publicPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-strong)]"
          >
            打开文件
          </a>
        </div>
      ) : null}
    </article>
  );
}

function RunSnapshotCard(props: RunSnapshotCardProps) {
  if (!props.run) {
    return (
      <article className="rounded-[24px] border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-5">
        <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{props.title}</p>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">未找到对应 run。</p>
      </article>
    );
  }

  return (
    <article className="rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{props.title}</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{props.run.runId}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {formatDateTimeLabel(props.run.startedAt)} · {formatDurationSecondsLabel(props.run.durationSeconds)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <TraceRunStatusPill status={props.run.status} />
          <TraceStageChip stage={props.run.stage} />
          <TraceProviderModePill mode={props.run.providerMode} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm leading-6 text-[var(--text-muted)]">
        <p>Prompt 版本：{props.run.promptVersion ?? "未记录"}</p>
        <p>Style Key：{props.run.styleKey ?? "未记录"}</p>
        <p>参考图：{props.run.referenceIds.length ? props.run.referenceIds.join("；") : "未记录"}</p>
        {props.run.errorMessage ? (
          <p className="rounded-[14px] bg-[var(--danger-tint)] px-3 py-2 text-[var(--danger-ink)]">
            {props.run.errorMessage}
          </p>
        ) : null}
        {props.run.warnings.length ? (
          <p className="rounded-[14px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-2">
            {props.run.warnings.join("；")}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function buildRouteSubtitle(entry: TraceMapDetailViewModel["currentArtifacts"]["route"]) {
  if (!entry.exists) {
    return "route.md 缺失";
  }
  if (!entry.parsed) {
    return "route.md 存在，但解析失败";
  }
  return "route.md 已解析，可对照 AI Contract";
}

function buildKnowledgeSubtitle(entry: TraceMapDetailViewModel["currentArtifacts"]["knowledge"]) {
  if (!entry.exists) {
    return "knowledge.json 缺失";
  }
  return `knowledge.json 共 ${entry.count ?? "?"} 条`;
}

function buildMapViewSubtitle(entry: TraceMapDetailViewModel["currentArtifacts"]["mapView"]) {
  if (!entry.exists) {
    return "map.view.json 缺失";
  }
  return `map.view.json 共 ${entry.nodeCount ?? "?"} 个节点`;
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return;
  }
  await navigator.clipboard.writeText(value);
}

export function TraceMapDetailPanel(props: TraceMapDetailPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedKey(null);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  async function handleCopy(key: string, value: string) {
    await copyToClipboard(value);
    setCopiedKey(key);
  }

  if (!props.detail && props.loading) {
    return (
      <section className="rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-[var(--text-muted)]">正在加载追踪详情…</p>
      </section>
    );
  }

  if (!props.detail) {
    return (
      <section className="rounded-[30px] border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-soft)]">
        <p className="text-lg font-semibold text-[var(--text-strong)]">暂无作品详情</p>
        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
          先在左侧选择一个作品，再查看当前态、AI Contract 和 run 时间线。
        </p>
        {props.error ? (
          <p className="mt-4 rounded-[16px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
            {props.error}
          </p>
        ) : null}
      </section>
    );
  }

  const detail = props.detail;

  return (
    <section className="grid gap-4">
      {props.error ? (
        <div className="rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
          {props.error}
        </div>
      ) : null}

      {props.loading ? (
        <div className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
          正在刷新当前作品详情…
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前态身份卡</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                {detail.mapName}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {detail.city} · {detail.datasetKey}
              </p>
            </div>
            <TraceMapStatusPill status={detail.mapStatus} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "mapId", value: detail.mapId },
              { label: "eventCount", value: String(detail.eventCount) },
              { label: "updatedAt", value: formatDateTimeLabel(detail.updatedAt) },
              { label: "currentRunIdRaw", value: detail.currentRunIdRaw || "未记录" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3"
              >
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{item.label}</p>
                <p className="mt-2 break-all text-sm font-medium text-[var(--text-strong)]">{item.value}</p>
              </div>
            ))}
          </div>

          {detail.integrityIssues.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {detail.integrityIssues.map((issue) => (
                <TraceIssueChip key={`${issue.code}-${issue.message}`} code={issue.code} severity={issue.severity} />
              ))}
            </div>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">版本与来源</p>
          <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            <p>当前版本：{detail.selectedPosterVersion?.versionId ?? "未识别"}</p>
            <p>候选版本数：{detail.selectedPosterVersion ? "已识别" : "未识别"}</p>
            <p>海报来源：{detail.selectedPosterSourceRun?.runId ?? "缺失"}</p>
            <p>Lifecycle：{detail.latestLifecycleRun?.runId ?? "缺失"}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {detail.selectedPosterSourceRun ? (
              <TraceRunStatusPill status={detail.selectedPosterSourceRun.status} />
            ) : null}
            {detail.latestLifecycleRun ? (
              <TraceStageChip stage={detail.latestLifecycleRun.stage} />
            ) : null}
            {detail.selectedPosterSourceRun ? (
              <TraceProviderModePill mode={detail.selectedPosterSourceRun.providerMode} />
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/maps/${detail.mapId}`}
              className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-strong)]"
            >
              打开作品页
            </Link>
            <DetailActionButton text={detail.mapId} label="mapId" copiedKey={copiedKey} onCopy={handleCopy} />
            {detail.selectedPosterSourceRun ? (
              <DetailActionButton
                text={detail.selectedPosterSourceRun.runId}
                label="sourceRun"
                copiedKey={copiedKey}
                onCopy={handleCopy}
              />
            ) : null}
            {detail.latestLifecycleRun ? (
              <DetailActionButton
                text={detail.latestLifecycleRun.runId}
                label="lifecycleRun"
                copiedKey={copiedKey}
                onCopy={handleCopy}
              />
            ) : null}
          </div>
        </article>
      </div>

      <article className="overflow-hidden rounded-[30px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前主图</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              当前选中版本：{detail.currentArtifacts.poster.selectedVersionId ?? "未识别"} · 来源 run：
              {detail.currentArtifacts.poster.sourceRunId ?? "缺失"}
            </p>
          </div>
          {detail.currentArtifacts.poster.exists ? (
            <span className="inline-flex items-center rounded-full border border-transparent bg-[var(--success-tint)] px-3 py-1 text-xs text-[var(--success-ink)]">
              当前海报存在
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
              当前海报缺失
            </span>
          )}
        </div>

        {detail.currentArtifacts.poster.publicPath ? (
          <div className="mt-4 overflow-hidden rounded-[24px] bg-[var(--bg-soft)]">
            <Image
              src={detail.currentArtifacts.poster.publicPath}
              alt={detail.mapName}
              width={1600}
              height={1100}
              unoptimized
              className="max-h-[640px] w-full object-contain"
            />
          </div>
        ) : (
          <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-[24px] bg-[var(--bg-soft)] text-sm text-[var(--text-muted)]">
            当前没有可预览海报
          </div>
        )}
      </article>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid gap-4">
          <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前产物摘要</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CurrentArtifactCard
                title="raw"
                subtitle={`来源：${detail.currentArtifacts.raw.source}`}
                publicPath={detail.currentArtifacts.raw.publicPath}
                detailLines={[
                  `路径：${detail.currentArtifacts.raw.publicPath}`,
                  `评论数：${detail.currentArtifacts.raw.count ?? "未记录"}`,
                ]}
              />
              <CurrentArtifactCard
                title="events"
                subtitle={`来源：${detail.currentArtifacts.events.source}`}
                publicPath={detail.currentArtifacts.events.publicPath}
                detailLines={[
                  `路径：${detail.currentArtifacts.events.publicPath}`,
                  `事件数：${detail.currentArtifacts.events.count ?? "未记录"}`,
                ]}
              />
              <CurrentArtifactCard
                title="route.md"
                subtitle={buildRouteSubtitle(detail.currentArtifacts.route)}
                publicPath={detail.currentArtifacts.route.publicPath}
                exists={detail.currentArtifacts.route.exists}
                error={detail.currentArtifacts.route.error}
                detailLines={
                  detail.currentArtifacts.route.previewLines.length
                    ? detail.currentArtifacts.route.previewLines
                    : ["当前没有 route 预览内容"]
                }
              />
              <CurrentArtifactCard
                title="knowledge.json"
                subtitle={buildKnowledgeSubtitle(detail.currentArtifacts.knowledge)}
                publicPath={detail.currentArtifacts.knowledge.publicPath}
                exists={detail.currentArtifacts.knowledge.exists}
                error={detail.currentArtifacts.knowledge.error}
                detailLines={[
                  `条目数：${detail.currentArtifacts.knowledge.count ?? "未记录"}`,
                  ...detail.currentArtifacts.knowledge.previewItems.map(
                    (item) => `${item.name}：${item.visual}`,
                  ),
                ]}
              />
              <CurrentArtifactCard
                title="map.view.json"
                subtitle={buildMapViewSubtitle(detail.currentArtifacts.mapView)}
                publicPath={detail.currentArtifacts.mapView.publicPath}
                exists={detail.currentArtifacts.mapView.exists}
                error={detail.currentArtifacts.mapView.error}
                detailLines={[
                  `节点数：${detail.currentArtifacts.mapView.nodeCount ?? "未记录"}`,
                  `selectedEventId：${detail.currentArtifacts.mapView.selectedEventId ?? "未记录"}`,
                ]}
              />
              <CurrentArtifactCard
                title="poster"
                subtitle="当前选中的海报版本"
                publicPath={detail.currentArtifacts.poster.publicPath}
                exists={detail.currentArtifacts.poster.exists}
                detailLines={[
                  `路径：${detail.currentArtifacts.poster.publicPath ?? "未记录"}`,
                  `来源 run：${detail.currentArtifacts.poster.sourceRunId ?? "缺失"}`,
                ]}
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">当前评论卡</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  当前作品实际使用的评论与 event 绑定。
                </p>
              </div>
              <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                {detail.commentCards.length} 张
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {detail.commentCards.map((card) => (
                <article
                  key={card.eventId}
                  className="rounded-[22px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-strong)]">{card.poiName}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {card.commentId} · {card.eventId}
                      </p>
                    </div>
                    {card.thumbnail ? (
                      <a href={card.thumbnail} target="_blank" rel="noreferrer" className="shrink-0 overflow-hidden rounded-[14px] border border-[color:var(--line-subtle)]">
                        <Image
                          src={card.thumbnail}
                          alt={card.poiName}
                          width={88}
                          height={88}
                          unoptimized
                          className="h-[72px] w-[72px] object-cover"
                        />
                      </a>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.excerpt}</p>

                  {(card.subject || card.avoid?.length) ? (
                    <div className="mt-3 rounded-[16px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs leading-6 text-[var(--text-muted)]">
                      {card.subject ? <p>subject：{card.subject}</p> : null}
                      {card.avoid?.length ? <p>avoid：{card.avoid.join("，")}</p> : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <DetailActionButton text={card.commentId} label={`comment-${card.commentId}`} copiedKey={copiedKey} onCopy={handleCopy} />
                    <DetailActionButton text={card.eventId} label={`event-${card.eventId}`} copiedKey={copiedKey} onCopy={handleCopy} />
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">AI Contract</p>
          {detail.aiContract.available ? (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.aiContract.frontMatter
                  ? [
                      ["mapName", detail.aiContract.frontMatter.mapName],
                      ["city", detail.aiContract.frontMatter.city],
                      ["style", detail.aiContract.frontMatter.styleLabel],
                      ["days", String(detail.aiContract.frontMatter.days)],
                      ["events", String(detail.aiContract.frontMatter.eventCount)],
                      ["knowledge", String(detail.aiContract.frontMatter.knowledgeCount)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-[18px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-4 py-3"
                      >
                        <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
                        <p className="mt-2 text-sm font-medium text-[var(--text-strong)]">{value}</p>
                      </div>
                    ))
                  : null}
              </div>

              <div>
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">Important Rules</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                  {detail.aiContract.importantRules.map((rule) => (
                    <li key={rule} className="rounded-[16px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-2">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">Event Contract</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                    <thead className="text-[var(--text-muted)]">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">shortName</th>
                        <th className="px-3 py-2 font-medium">subject</th>
                        <th className="px-3 py-2 font-medium">avoid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.aiContract.events.map((event) => (
                        <tr key={`${event.sequence}-${event.poi}`}>
                          <td className="rounded-l-[16px] border border-r-0 border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-3 text-[var(--text-strong)]">
                            {event.sequence}
                          </td>
                          <td className="border-y border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-3 text-[var(--text-strong)]">
                            <p className="font-medium">{event.shortName}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{event.poi}</p>
                          </td>
                          <td className="border-y border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-3 text-[var(--text-strong)]">
                            {event.subject}
                          </td>
                          <td className="rounded-r-[16px] border border-l-0 border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-3 text-[var(--text-strong)]">
                            {event.avoid.join("，")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-xs tracking-[0.12em] text-[var(--text-muted)]">Knowledge 摘要</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                  {detail.aiContract.knowledge.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-[16px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-2"
                    >
                      <p className="font-medium text-[var(--text-strong)]">{item.name}</p>
                      <p className="mt-1">{item.visual}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger-ink)]">
              {detail.aiContract.error ?? "当前 AI Contract 不可用"}
            </div>
          )}
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RunSnapshotCard title="当前选中海报来源 run" run={detail.selectedPosterSourceRun} />
        <RunSnapshotCard title="最近生命周期 run" run={detail.latestLifecycleRun} />
      </div>

      <article className="rounded-[28px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">run 时间线</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              历史 run 产物路径仅表示当前可定位文件，不代表历史快照。
            </p>
          </div>
          <span className="rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {detail.runHistory.length} 条
          </span>
        </div>

        <div className="mt-4 grid gap-4">
          {detail.runHistory.map((run) => (
            <article
              key={run.runId}
              className="rounded-[22px] border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[var(--text-strong)]">{run.runId}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {formatDateTimeLabel(run.startedAt)} · {formatDurationSecondsLabel(run.durationSeconds)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {run.isSelectedPosterSource ? (
                    <span className="inline-flex items-center rounded-full border border-transparent bg-[var(--accent-tint)] px-3 py-1 text-xs text-[var(--accent-primary-strong)]">
                      selected source
                    </span>
                  ) : null}
                  {run.isLatestLifecycle ? (
                    <span className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-strong)]">
                      latest lifecycle
                    </span>
                  ) : null}
                  <TraceRunStatusPill status={run.status} />
                  <TraceStageChip stage={run.stage} />
                  <TraceProviderModePill mode={run.providerMode} />
                  {run.posterAssetState ? <TraceAssetStatePill state={run.posterAssetState} /> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm leading-6 text-[var(--text-muted)]">
                <p>Style Key：{run.styleKey ?? "未记录"}</p>
                <p>Prompt 版本：{run.promptVersion ?? "未记录"}</p>
                <p>route：{run.artifacts.routePath ?? "未记录"}</p>
                <p>poster：{run.artifacts.posterPath ?? "未记录"}</p>
                {run.errorMessage ? (
                  <p className="rounded-[14px] bg-[var(--danger-tint)] px-3 py-2 text-[var(--danger-ink)]">
                    {run.errorMessage}
                  </p>
                ) : null}
                {run.warnings.length ? (
                  <p className="rounded-[14px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                    {run.warnings.join("；")}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
