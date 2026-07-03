import type { RunTrace } from "@/src/contracts/domain";

export function formatRunDurationLabel(params: {
  startedAt: string;
  endedAt?: string;
}) {
  if (!params.endedAt) {
    return null;
  }

  const startedAt = Date.parse(params.startedAt);
  const endedAt = Date.parse(params.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function isTerminalRunStatus(status: RunTrace["status"]) {
  return status === "completed" || status === "failed" || status === "incomplete";
}
