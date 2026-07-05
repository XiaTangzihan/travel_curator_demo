import { StatusPill } from "@/src/components/status-pill";
import type { RunTrace } from "@/src/contracts/domain";
import {
  assetStateLabels,
  integrityIssueLabels,
  providerModeLabels,
  runStatusLabels,
  stageLabels,
} from "@/src/features/runs/presentation";
import type {
  TraceAssetState,
  TraceIntegrityIssueCode,
  TraceRunStatusValue,
} from "@/src/server/trace-diagnostics/types";

type TraceRunStatusPillProps = {
  status: TraceRunStatusValue;
};

const runStatusStyles: Record<TraceRunStatusValue, string> = {
  running: "border-transparent bg-[var(--accent-tint)] text-[var(--accent-primary-strong)]",
  completed: "border-transparent bg-[var(--success-tint)] text-[var(--success-ink)]",
  failed: "border-transparent bg-[var(--danger-tint)] text-[var(--danger-ink)]",
  incomplete: "border-[color:var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  missing: "border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-muted)]",
};

const providerModeStyles: Record<RunTrace["providerMode"] | "missing", string> = {
  live: "border-transparent bg-[var(--accent-tint)] text-[var(--accent-primary-strong)]",
  fallback: "border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-strong)]",
  missing: "border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-muted)]",
};

const assetStateStyles: Record<TraceAssetState, string> = {
  present: "border-transparent bg-[var(--success-tint)] text-[var(--success-ink)]",
  pruned: "border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-strong)]",
  unknown: "border-dashed border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-muted)]",
};

type TraceProviderModePillProps = {
  mode: RunTrace["providerMode"] | "missing";
};

type TraceAssetStatePillProps = {
  state: TraceAssetState;
};

type TraceIssueChipProps = {
  code: TraceIntegrityIssueCode;
  severity?: "error" | "warning";
};

type TraceStageChipProps = {
  stage: RunTrace["stage"];
};

export function TraceMapStatusPill(props: { status: "draft" | "confirmed" | "failed" }) {
  return <StatusPill status={props.status} />;
}

export function TraceRunStatusPill(props: TraceRunStatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.08em] ${runStatusStyles[props.status]}`}
    >
      {runStatusLabels[props.status]}
    </span>
  );
}

export function TraceProviderModePill(props: TraceProviderModePillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.08em] ${providerModeStyles[props.mode]}`}
    >
      {providerModeLabels[props.mode]}
    </span>
  );
}

export function TraceAssetStatePill(props: TraceAssetStatePillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.08em] ${assetStateStyles[props.state]}`}
    >
      {assetStateLabels[props.state]}
    </span>
  );
}

export function TraceIssueChip(props: TraceIssueChipProps) {
  const tone =
    props.severity === "warning"
      ? "border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-strong)]"
      : "border-transparent bg-[var(--danger-tint)] text-[var(--danger-ink)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tone}`}>
      {integrityIssueLabels[props.code]}
    </span>
  );
}

export function TraceStageChip(props: TraceStageChipProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-soft)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
      {stageLabels[props.stage]}
    </span>
  );
}
