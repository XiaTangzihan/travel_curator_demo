import type { DemoDatasetKey } from "@/src/config/demo";
import type {
  Landmark,
  PosterVersion,
  RunTrace,
} from "@/src/contracts/domain";

export type TraceAssetState = "present" | "pruned" | "unknown";

export type TraceRunStatusValue = RunTrace["status"] | "missing";

export type TraceIntegrityIssueCode =
  | "selected_poster_version_missing"
  | "selected_poster_source_run_missing"
  | "route_missing"
  | "route_parse_failed"
  | "knowledge_missing"
  | "knowledge_parse_failed"
  | "current_poster_missing"
  | "map_view_missing"
  | "map_view_parse_failed"
  | "selected_comments_mismatch"
  | "orphan_run";

export type TraceIntegrityIssue = {
  code: TraceIntegrityIssueCode;
  severity: "error" | "warning";
  message: string;
  relatedRunId?: string;
};

export type TraceGlobalStats = {
  totalMapCount: number;
  totalRunCount: number;
  completedRunCount: number;
  failedRunCount: number;
  incompleteRunCount: number;
  fallbackRunCount: number;
  fallbackRate: number | null;
  averageDurationSeconds: number | null;
  orphanRunCount: number;
  latestUpdatedAt: string | null;
};

export type TraceDatasetStats = {
  datasetKey: DemoDatasetKey;
  mapCount: number;
  runCount: number;
  completedRunCount: number;
  failedRunCount: number;
  incompleteRunCount: number;
  fallbackRunCount: number;
  fallbackRate: number | null;
  averageDurationSeconds: number | null;
  orphanRunCount: number;
  latestUpdatedAt: string | null;
};

export type TraceMapListItem = {
  mapId: string;
  mapName: string;
  city: string;
  datasetKey: DemoDatasetKey;
  mapStatus: "draft" | "confirmed" | "failed";
  eventCount: number;
  updatedAt: string;
  currentRunIdRaw: string;
  posterVersionCount: number;
  selectedPosterVersionId: string | null;
  currentPosterPath: string;
  selectedPosterSourceRunId: string | null;
  selectedPosterSourceRunStatus: TraceRunStatusValue;
  selectedPosterSourceRunProviderMode: RunTrace["providerMode"] | "missing";
  latestLifecycleRunId: string | null;
  latestLifecycleRunStatus: TraceRunStatusValue;
  latestLifecycleRunStage: RunTrace["stage"] | null;
  posterVersionIds: string[];
  relatedRunIds: string[];
  selectedCommentIds: string[];
  issueCodes: TraceIntegrityIssueCode[];
};

export type TraceRunSummary = {
  runId: string;
  mapId: string;
  datasetKey: DemoDatasetKey;
  status: RunTrace["status"];
  stage: RunTrace["stage"];
  providerMode: RunTrace["providerMode"];
  styleKey?: string;
  promptVersion?: string;
  referenceIds: string[];
  warnings: string[];
  errorMessage?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number | null;
  artifacts: RunTrace["artifacts"];
  isSelectedPosterSource: boolean;
  isLatestLifecycle: boolean;
  posterAssetState: TraceAssetState | null;
};

export type TracePosterVersionInfo = {
  versionId: string;
  posterPath: string;
  runId: string;
  createdAt: string;
  instruction?: string;
  basedOnExistingImage?: boolean;
};

export type TraceCurrentArtifactEntry = {
  filePath: string | null;
  publicPath: string | null;
  exists: boolean;
  error?: string;
};

export type TraceDatasetArtifactEntry = {
  publicPath: string;
  count: number | null;
  source: "selected_run" | "dataset_inferred";
};

export type TraceRouteArtifactEntry = TraceCurrentArtifactEntry & {
  previewLines: string[];
  parsed: boolean;
};

export type TraceKnowledgeArtifactEntry = TraceCurrentArtifactEntry & {
  count: number | null;
  previewItems: Array<Pick<Landmark, "name" | "visual">>;
};

export type TraceMapViewArtifactEntry = TraceCurrentArtifactEntry & {
  nodeCount: number | null;
  selectedEventId: string | null;
};

export type TracePosterArtifactEntry = {
  publicPath: string | null;
  exists: boolean;
  sourceRunId: string | null;
  selectedVersionId: string | null;
};

export type TraceCurrentArtifacts = {
  raw: TraceDatasetArtifactEntry;
  events: TraceDatasetArtifactEntry;
  route: TraceRouteArtifactEntry;
  knowledge: TraceKnowledgeArtifactEntry;
  mapView: TraceMapViewArtifactEntry;
  poster: TracePosterArtifactEntry;
};

export type TraceAiContractEvent = {
  sequence: number;
  shortName: string;
  poi: string;
  imagePath: string;
  subject: string;
  avoid: string[];
};

export type TraceAiContract = {
  available: boolean;
  error?: string;
  frontMatter: {
    mapName: string;
    city: string;
    styleLabel: string;
    days: number;
    eventCount: number;
    knowledgeCount: number;
  } | null;
  importantRules: string[];
  events: TraceAiContractEvent[];
  knowledge: Array<Pick<Landmark, "name" | "visual">>;
};

export type TraceCommentCard = {
  commentId: string;
  eventId: string;
  poiName: string;
  excerpt: string;
  thumbnail: string | null;
  subject?: string;
  avoid?: string[];
};

export type TraceMapDetailViewModel = {
  mapId: string;
  mapName: string;
  city: string;
  datasetKey: DemoDatasetKey;
  mapStatus: "draft" | "confirmed" | "failed";
  eventCount: number;
  posterVersionCount: number;
  updatedAt: string;
  currentRunIdRaw: string;
  selectedPosterVersion: TracePosterVersionInfo | null;
  selectedPosterSourceRun: TraceRunSummary | null;
  latestLifecycleRun: TraceRunSummary | null;
  currentArtifacts: TraceCurrentArtifacts;
  aiContract: TraceAiContract;
  commentCards: TraceCommentCard[];
  runHistory: TraceRunSummary[];
  integrityIssues: TraceIntegrityIssue[];
};

export type TraceOverviewViewModel = {
  globalStats: TraceGlobalStats;
  datasetStats: TraceDatasetStats[];
  mapItems: TraceMapListItem[];
};

export function createPosterVersionInfo(version: PosterVersion): TracePosterVersionInfo {
  return {
    versionId: version.versionId,
    posterPath: version.posterPath,
    runId: version.runId,
    createdAt: version.createdAt,
    instruction: version.instruction,
    basedOnExistingImage: version.basedOnExistingImage,
  };
}
