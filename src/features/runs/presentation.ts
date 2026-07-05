import type { RunTrace } from "@/src/contracts/domain";
import type {
  TraceAssetState,
  TraceIntegrityIssueCode,
  TraceMapListItem,
  TraceRunStatusValue,
} from "@/src/server/trace-diagnostics/types";

export const stageLabels: Record<RunTrace["stage"], string> = {
  preprocess: "素材准备",
  generate: "首次生成",
  regenerate: "重新生成",
  confirm: "确认保存",
};

export const runStatusLabels: Record<TraceRunStatusValue, string> = {
  running: "进行中",
  completed: "已完成",
  failed: "失败",
  incomplete: "未完成",
  missing: "缺失",
};

export const providerModeLabels: Record<RunTrace["providerMode"] | "missing", string> = {
  live: "实时模型",
  fallback: "本地回退",
  missing: "未记录",
};

export const assetStateLabels: Record<TraceAssetState, string> = {
  present: "存在",
  pruned: "已裁剪",
  unknown: "未知",
};

export const integrityIssueLabels: Record<TraceIntegrityIssueCode, string> = {
  selected_poster_version_missing: "当前版本缺失",
  selected_poster_source_run_missing: "来源 run 缺失",
  route_missing: "route 缺失",
  route_parse_failed: "route 解析失败",
  knowledge_missing: "knowledge 缺失",
  knowledge_parse_failed: "knowledge 解析失败",
  current_poster_missing: "当前海报缺失",
  map_view_missing: "map.view 缺失",
  map_view_parse_failed: "map.view 解析失败",
  selected_comments_mismatch: "评论映射漂移",
  orphan_run: "孤儿 run",
};

export function formatDateTimeLabel(value?: string | null) {
  if (!value) {
    return "未记录";
  }

  return value.replace("T", " ").slice(0, 16);
}

export function formatDurationSecondsLabel(value: number | null) {
  if (value === null) {
    return "未记录";
  }

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function formatPercentLabel(value: number | null) {
  if (value === null) {
    return "未记录";
  }

  return `${Math.round(value * 100)}%`;
}

export function summarizeIssueCodes(issueCodes: TraceIntegrityIssueCode[]) {
  return issueCodes.slice(0, 3).map((code) => integrityIssueLabels[code]);
}

export function matchesMapSearch(item: TraceMapListItem, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const tokens = [
    item.mapName,
    item.mapId,
    item.city,
    item.datasetKey,
    item.currentRunIdRaw,
    item.selectedPosterVersionId ?? "",
    item.selectedPosterSourceRunId ?? "",
    item.latestLifecycleRunId ?? "",
    ...item.posterVersionIds,
    ...item.relatedRunIds,
    ...item.selectedCommentIds,
  ];

  return tokens.some((token) => token.toLowerCase().includes(query));
}
