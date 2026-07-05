import path from "node:path";
import { getDemoDataset, type DemoDatasetKey, supportedDatasetKeys } from "@/src/config/demo";
import type {
  Landmark,
  MapRecord,
  MapViewModel,
  ParsedRoute,
  PosterVersion,
  RunTrace,
} from "@/src/contracts/domain";
import { parseRouteMarkdown } from "@/src/engine/parsers/route-markdown";
import {
  getEventsDataset,
  getRawDataset,
  getRenderedMap,
  listMapRecords,
  listRunTraces,
} from "@/src/server/repositories/demo-repository";
import {
  fromPublicPath,
  pathExists,
  readJsonFile,
  readTextFile,
  storagePaths,
  toPublicPath,
} from "@/src/server/utils/storage";
import {
  createPosterVersionInfo,
  type TraceAiContract,
  type TraceCommentCard,
  type TraceCurrentArtifacts,
  type TraceDatasetArtifactEntry,
  type TraceDatasetStats,
  type TraceGlobalStats,
  type TraceIntegrityIssue,
  type TraceIntegrityIssueCode,
  type TraceMapDetailViewModel,
  type TraceMapListItem,
  type TraceOverviewViewModel,
  type TracePosterVersionInfo,
  type TraceRouteArtifactEntry,
  type TraceKnowledgeArtifactEntry,
  type TraceMapViewArtifactEntry,
  type TraceRunSummary,
} from "@/src/server/trace-diagnostics/types";

function compareIsoDesc(left?: string, right?: string) {
  const leftValue = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightValue = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  return rightValue - leftValue;
}

function sortRunsByStartedAtDesc(runs: RunTrace[]) {
  return [...runs].sort((left, right) =>
    compareIsoDesc(left.startedAt ?? left.updatedAt, right.startedAt ?? right.updatedAt),
  );
}

function calculateDurationSeconds(startedAt: string, endedAt?: string) {
  if (!endedAt) {
    return null;
  }

  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return null;
  }

  return Math.max(1, Math.round((ended - started) / 1000));
}

function averageDurationSeconds(runs: RunTrace[]) {
  const durations = runs
    .map((run) => calculateDurationSeconds(run.startedAt, run.endedAt))
    .filter((duration): duration is number => duration !== null);

  if (!durations.length) {
    return null;
  }

  return Math.round((durations.reduce((sum, duration) => sum + duration, 0) / durations.length) * 10) / 10;
}

function latestTimestamp(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort(compareIsoDesc)[0] ?? null;
}

function isImageProducingRun(run: RunTrace) {
  return run.stage === "generate" || run.stage === "regenerate";
}

function normalizePosterVersions(mapRecord: MapRecord): PosterVersion[] {
  if (mapRecord.posterVersions.length) {
    return mapRecord.posterVersions;
  }

  return [
    {
      versionId: mapRecord.selectedPosterVersionId ?? mapRecord.currentRunId ?? "current",
      posterPath: mapRecord.posterPath,
      runId: mapRecord.currentRunId || "current",
      createdAt: mapRecord.updatedAt || mapRecord.createdAt,
      instruction: mapRecord.lastInstruction,
    },
  ];
}

function resolveSelectedPosterVersion(mapRecord: MapRecord): PosterVersion | null {
  const posterVersions = normalizePosterVersions(mapRecord);

  return (
    posterVersions.find((version) => version.versionId === mapRecord.selectedPosterVersionId) ??
    posterVersions.find((version) => version.posterPath === mapRecord.posterPath) ??
    posterVersions.at(-1) ??
    null
  );
}

function resolveSelectedPosterSourceRun(params: {
  mapRecord: MapRecord;
  selectedPosterVersion: PosterVersion | null;
  relatedRuns: RunTrace[];
}) {
  const sortedRuns = sortRunsByStartedAtDesc(params.relatedRuns);

  return (
    (params.selectedPosterVersion
      ? sortedRuns.find((run) => run.runId === params.selectedPosterVersion?.runId)
      : null) ??
    sortedRuns.find(
      (run) =>
        isImageProducingRun(run) && run.artifacts.posterPath === params.mapRecord.posterPath,
    ) ??
    null
  );
}

function resolveLatestLifecycleRun(relatedRuns: RunTrace[]) {
  return sortRunsByStartedAtDesc(relatedRuns)[0] ?? null;
}

async function resolveHistoryPosterState(params: {
  run: RunTrace;
  mapRecord: MapRecord;
  selectedPosterSourceRunId: string | null;
  latestLifecycleRun: RunTrace | null;
}) {
  if (!params.run.artifacts.posterPath) {
    return "unknown" as const;
  }

  const fileExists = await pathExists(fromPublicPath(params.run.artifacts.posterPath));
  if (fileExists) {
    return "present" as const;
  }

  const shouldTreatAsPruned =
    isImageProducingRun(params.run) &&
    params.run.runId !== params.selectedPosterSourceRunId &&
    (params.mapRecord.status === "confirmed" || params.latestLifecycleRun?.stage === "confirm");

  if (shouldTreatAsPruned) {
    return "pruned" as const;
  }

  return "unknown" as const;
}

function buildRunSummary(params: {
  run: RunTrace;
  isSelectedPosterSource: boolean;
  isLatestLifecycle: boolean;
  posterAssetState: TraceRunSummary["posterAssetState"];
}): TraceRunSummary {
  return {
    runId: params.run.runId,
    mapId: params.run.mapId,
    datasetKey: params.run.datasetKey,
    status: params.run.status,
    stage: params.run.stage,
    providerMode: params.run.providerMode,
    styleKey: params.run.styleKey,
    promptVersion: params.run.promptVersion,
    referenceIds: params.run.referenceIds ?? [],
    warnings: params.run.warnings,
    errorMessage: params.run.errorMessage,
    startedAt: params.run.startedAt,
    endedAt: params.run.endedAt,
    durationSeconds: calculateDurationSeconds(params.run.startedAt, params.run.endedAt),
    artifacts: params.run.artifacts,
    isSelectedPosterSource: params.isSelectedPosterSource,
    isLatestLifecycle: params.isLatestLifecycle,
    posterAssetState: params.posterAssetState,
  };
}

function excerpt(text: string) {
  if (text.length <= 48) {
    return text;
  }

  return `${text.slice(0, 48)}...`;
}

async function buildDatasetArtifactEntry(params: {
  datasetKey: DemoDatasetKey;
  selectedRunPath?: string;
  kind: "raw" | "events";
}): Promise<TraceDatasetArtifactEntry> {
  const dataset = getDemoDataset(params.datasetKey);
  const publicPath =
    params.selectedRunPath ??
    (params.kind === "raw"
      ? `/mock/raw/${dataset.rawFileName}`
      : `/mock/events/${dataset.eventsFileName}`);

  const snapshot =
    params.kind === "raw"
      ? await getRawDataset(params.datasetKey)
      : await getEventsDataset(params.datasetKey);

  return {
    publicPath,
    count:
      params.kind === "raw"
        ? snapshot?.reviews.length ?? null
        : snapshot?.events.length ?? null,
    source: params.selectedRunPath ? "selected_run" : "dataset_inferred",
  };
}

async function buildRouteArtifactEntry(mapRecord: MapRecord): Promise<{
  entry: TraceRouteArtifactEntry;
  parsedRoute: ParsedRoute | null;
  error: string | null;
}> {
  const markdown = await readTextFile(mapRecord.routePath);
  if (!markdown) {
    return {
      entry: {
        filePath: mapRecord.routePath,
        publicPath: toPublicPath(mapRecord.routePath),
        exists: false,
        parsed: false,
        previewLines: [],
      },
      parsedRoute: null,
      error: "当前地图缺少 route.md",
    };
  }

  try {
    const parsedRoute = parseRouteMarkdown(markdown);
    return {
      entry: {
        filePath: mapRecord.routePath,
        publicPath: toPublicPath(mapRecord.routePath),
        exists: true,
        parsed: true,
        previewLines: markdown
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .slice(0, 8),
      },
      parsedRoute,
      error: null,
    };
  } catch (error) {
    return {
      entry: {
        filePath: mapRecord.routePath,
        publicPath: toPublicPath(mapRecord.routePath),
        exists: true,
        parsed: false,
        previewLines: markdown
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .slice(0, 8),
        error: (error as Error).message,
      },
      parsedRoute: null,
      error: (error as Error).message,
    };
  }
}

async function buildKnowledgeArtifactEntry(mapRecord: MapRecord): Promise<{
  entry: TraceKnowledgeArtifactEntry;
  knowledge: Landmark[];
  error: string | null;
}> {
  try {
    const content = await readJsonFile<Landmark[]>(mapRecord.knowledgePath);
    if (!content) {
      return {
        entry: {
          filePath: mapRecord.knowledgePath,
          publicPath: toPublicPath(mapRecord.knowledgePath),
          exists: false,
          count: null,
          previewItems: [],
        },
        knowledge: [],
        error: "当前地图缺少 knowledge.json",
      };
    }

    return {
      entry: {
        filePath: mapRecord.knowledgePath,
        publicPath: toPublicPath(mapRecord.knowledgePath),
        exists: true,
        count: content.length,
        previewItems: content.slice(0, 5).map((item) => ({
          name: item.name,
          visual: item.visual,
        })),
      },
      knowledge: content,
      error: null,
    };
  } catch (error) {
    return {
      entry: {
        filePath: mapRecord.knowledgePath,
        publicPath: toPublicPath(mapRecord.knowledgePath),
        exists: true,
        count: null,
        previewItems: [],
        error: (error as Error).message,
      },
      knowledge: [],
      error: (error as Error).message,
    };
  }
}

async function buildMapViewArtifactEntry(mapId: string): Promise<{
  entry: TraceMapViewArtifactEntry;
  mapView: MapViewModel | null;
  error: string | null;
}> {
  const mapViewFilePath = path.join(storagePaths.maps, `${mapId}.view.json`);

  try {
    const mapView = await getRenderedMap(mapId);
    if (!mapView) {
      return {
        entry: {
          filePath: mapViewFilePath,
          publicPath: `/mock/maps/${mapId}.view.json`,
          exists: false,
          nodeCount: null,
          selectedEventId: null,
        },
        mapView: null,
        error: "当前地图缺少 map.view.json",
      };
    }

    return {
      entry: {
        filePath: mapViewFilePath,
        publicPath: `/mock/maps/${mapId}.view.json`,
        exists: true,
        nodeCount: mapView.nodes.length,
        selectedEventId: mapView.selectedEventId,
      },
      mapView,
      error: null,
    };
  } catch (error) {
    return {
      entry: {
        filePath: mapViewFilePath,
        publicPath: `/mock/maps/${mapId}.view.json`,
        exists: true,
        nodeCount: null,
        selectedEventId: null,
        error: (error as Error).message,
      },
      mapView: null,
      error: (error as Error).message,
    };
  }
}

function buildAiContract(params: {
  parsedRoute: ParsedRoute | null;
  parsedRouteError: string | null;
  knowledge: Landmark[];
}): TraceAiContract {
  if (!params.parsedRoute) {
    return {
      available: false,
      error: params.parsedRouteError ?? "当前 route 合同不可用",
      frontMatter: null,
      importantRules: [],
      events: [],
      knowledge: params.knowledge.slice(0, 5).map((item) => ({
        name: item.name,
        visual: item.visual,
      })),
    };
  }

  return {
    available: true,
    frontMatter: {
      mapName: params.parsedRoute.mapName,
      city: params.parsedRoute.city,
      styleLabel: params.parsedRoute.styleLabel,
      days: params.parsedRoute.days,
      eventCount: params.parsedRoute.eventCount,
      knowledgeCount: params.parsedRoute.knowledgeCount,
    },
    importantRules: params.parsedRoute.importantRules,
    events: params.parsedRoute.events.map((event) => ({
      sequence: event.sequence,
      shortName: event.shortName,
      poi: event.poi,
      imagePath: event.imagePath,
      subject: event.subject,
      avoid: event.avoid,
    })),
    knowledge: params.knowledge.slice(0, 5).map((item) => ({
      name: item.name,
      visual: item.visual,
    })),
  };
}

function buildCommentCards(mapView: MapViewModel | null): TraceCommentCard[] {
  if (!mapView) {
    return [];
  }

  return mapView.events.map((event) => ({
    commentId: event.commentId,
    eventId: event.eventId,
    poiName: event.poiName,
    excerpt: excerpt(event.commentText || event.poiName),
    thumbnail: event.commentPictures[0]?.url ?? null,
    subject: event.subject,
    avoid: event.avoid,
  }));
}

function buildSelectedCommentMismatchIssue(mapRecord: MapRecord, mapView: MapViewModel | null) {
  if (!mapView) {
    return null;
  }

  const expected = [...mapRecord.selectedCommentIds].sort();
  const actual = [...new Set(mapView.events.map((event) => event.commentId))].sort();
  if (expected.length === actual.length && expected.every((item, index) => item === actual[index])) {
    return null;
  }

  return {
    code: "selected_comments_mismatch",
    severity: "warning",
    message: "MapRecord.selectedCommentIds 与当前 map.view events 不一致",
  } satisfies TraceIntegrityIssue;
}

async function buildIntegrityIssues(params: {
  mapRecord: MapRecord;
  selectedPosterVersion: PosterVersion | null;
  selectedPosterSourceRun: RunTrace | null;
  routeMissingOrError: string | null;
  knowledgeMissingOrError: string | null;
  currentPosterExists: boolean;
  mapViewMissingOrError: string | null;
  mapView: MapViewModel | null;
}): Promise<TraceIntegrityIssue[]> {
  const issues: TraceIntegrityIssue[] = [];

  if (!params.selectedPosterVersion) {
    issues.push({
      code: "selected_poster_version_missing",
      severity: "error",
      message: "当前作品无法解析出选中的海报版本",
    });
  }

  if (!params.selectedPosterSourceRun) {
    issues.push({
      code: "selected_poster_source_run_missing",
      severity: "error",
      message: "当前作品无法定位当前选中海报的来源 run",
    });
  }

  if (params.routeMissingOrError) {
    issues.push({
      code: params.routeMissingOrError === "当前地图缺少 route.md" ? "route_missing" : "route_parse_failed",
      severity: "error",
      message: params.routeMissingOrError,
    });
  }

  if (params.knowledgeMissingOrError) {
    issues.push({
      code:
        params.knowledgeMissingOrError === "当前地图缺少 knowledge.json"
          ? "knowledge_missing"
          : "knowledge_parse_failed",
      severity: "error",
      message: params.knowledgeMissingOrError,
    });
  }

  if (!params.currentPosterExists) {
    issues.push({
      code: "current_poster_missing",
      severity: "error",
      message: "当前选中的海报文件不存在",
    });
  }

  if (params.mapViewMissingOrError) {
    issues.push({
      code:
        params.mapViewMissingOrError === "当前地图缺少 map.view.json"
          ? "map_view_missing"
          : "map_view_parse_failed",
      severity: "error",
      message: params.mapViewMissingOrError,
    });
  }

  const selectedCommentsMismatch = buildSelectedCommentMismatchIssue(params.mapRecord, params.mapView);
  if (selectedCommentsMismatch) {
    issues.push(selectedCommentsMismatch);
  }

  return issues;
}

async function buildMapListItem(params: {
  mapRecord: MapRecord;
  relatedRuns: RunTrace[];
}) {
  const selectedPosterVersion = resolveSelectedPosterVersion(params.mapRecord);
  const selectedPosterSourceRun = resolveSelectedPosterSourceRun({
    mapRecord: params.mapRecord,
    selectedPosterVersion,
    relatedRuns: params.relatedRuns,
  });
  const latestLifecycleRun = resolveLatestLifecycleRun(params.relatedRuns);
  const currentPosterExists = await pathExists(fromPublicPath(params.mapRecord.posterPath));

  const issueCodes: TraceIntegrityIssueCode[] = [];
  if (!selectedPosterVersion) {
    issueCodes.push("selected_poster_version_missing");
  }
  if (!selectedPosterSourceRun) {
    issueCodes.push("selected_poster_source_run_missing");
  }
  if (!currentPosterExists) {
    issueCodes.push("current_poster_missing");
  }

  return {
    mapId: params.mapRecord.mapId,
    mapName: params.mapRecord.mapName,
    city: params.mapRecord.city,
    datasetKey: params.mapRecord.datasetKey,
    mapStatus: params.mapRecord.status,
    eventCount: params.mapRecord.eventCount,
    updatedAt: params.mapRecord.updatedAt,
    currentRunIdRaw: params.mapRecord.currentRunId,
    posterVersionCount: normalizePosterVersions(params.mapRecord).length,
    selectedPosterVersionId: selectedPosterVersion?.versionId ?? null,
    currentPosterPath: params.mapRecord.posterPath,
    selectedPosterSourceRunId: selectedPosterSourceRun?.runId ?? null,
    selectedPosterSourceRunStatus: selectedPosterSourceRun?.status ?? "missing",
    latestLifecycleRunId: latestLifecycleRun?.runId ?? null,
    latestLifecycleRunStatus: latestLifecycleRun?.status ?? "missing",
    latestLifecycleRunStage: latestLifecycleRun?.stage ?? null,
    issueCodes,
  } satisfies TraceMapListItem;
}

function buildGlobalStats(params: { mapRecords: MapRecord[]; runs: RunTrace[] }): TraceGlobalStats {
  const mapIdSet = new Set(params.mapRecords.map((record) => record.mapId));
  const orphanRunCount = params.runs.filter((run) => !mapIdSet.has(run.mapId)).length;
  const completedRuns = params.runs.filter((run) => run.status === "completed");
  const failedRuns = params.runs.filter((run) => run.status === "failed");
  const incompleteRuns = params.runs.filter((run) => run.status === "incomplete");
  const fallbackRuns = params.runs.filter((run) => run.providerMode === "fallback");

  return {
    totalMapCount: params.mapRecords.length,
    totalRunCount: params.runs.length,
    completedRunCount: completedRuns.length,
    failedRunCount: failedRuns.length,
    incompleteRunCount: incompleteRuns.length,
    fallbackRunCount: fallbackRuns.length,
    fallbackRate: params.runs.length ? Number((fallbackRuns.length / params.runs.length).toFixed(3)) : null,
    averageDurationSeconds: averageDurationSeconds(params.runs),
    orphanRunCount,
    latestUpdatedAt: latestTimestamp([
      ...params.mapRecords.map((record) => record.updatedAt),
      ...params.runs.map((run) => run.updatedAt ?? run.endedAt ?? run.startedAt),
    ]),
  };
}

function buildDatasetStats(params: { datasetKey: DemoDatasetKey; mapRecords: MapRecord[]; runs: RunTrace[] }): TraceDatasetStats {
  const mapIdSet = new Set(params.mapRecords.map((record) => record.mapId));
  const orphanRunCount = params.runs.filter((run) => !mapIdSet.has(run.mapId)).length;
  const completedRuns = params.runs.filter((run) => run.status === "completed");
  const failedRuns = params.runs.filter((run) => run.status === "failed");
  const incompleteRuns = params.runs.filter((run) => run.status === "incomplete");
  const fallbackRuns = params.runs.filter((run) => run.providerMode === "fallback");

  return {
    datasetKey: params.datasetKey,
    mapCount: params.mapRecords.length,
    runCount: params.runs.length,
    completedRunCount: completedRuns.length,
    failedRunCount: failedRuns.length,
    incompleteRunCount: incompleteRuns.length,
    fallbackRunCount: fallbackRuns.length,
    fallbackRate: params.runs.length ? Number((fallbackRuns.length / params.runs.length).toFixed(3)) : null,
    averageDurationSeconds: averageDurationSeconds(params.runs),
    orphanRunCount,
    latestUpdatedAt: latestTimestamp([
      ...params.mapRecords.map((record) => record.updatedAt),
      ...params.runs.map((run) => run.updatedAt ?? run.endedAt ?? run.startedAt),
    ]),
  };
}

export async function getTraceOverviewViewModel(): Promise<TraceOverviewViewModel> {
  const [mapRecords, runs] = await Promise.all([listMapRecords(), listRunTraces()]);

  const mapItems = await Promise.all(
    mapRecords.map(async (mapRecord) =>
      buildMapListItem({
        mapRecord,
        relatedRuns: runs.filter((run) => run.mapId === mapRecord.mapId),
      }),
    ),
  );

  const datasetStats = supportedDatasetKeys.map((datasetKey) =>
    buildDatasetStats({
      datasetKey,
      mapRecords: mapRecords.filter((record) => record.datasetKey === datasetKey),
      runs: runs.filter((run) => run.datasetKey === datasetKey),
    }),
  );

  return {
    globalStats: buildGlobalStats({ mapRecords, runs }),
    datasetStats,
    mapItems,
  };
}

export async function getTraceMapDetailViewModel(mapId: string): Promise<TraceMapDetailViewModel | null> {
  const [mapRecords, runs] = await Promise.all([listMapRecords(), listRunTraces()]);
  const mapRecord = mapRecords.find((record) => record.mapId === mapId);
  if (!mapRecord) {
    return null;
  }

  const relatedRuns = sortRunsByStartedAtDesc(runs.filter((run) => run.mapId === mapId));
  const selectedPosterVersion = resolveSelectedPosterVersion(mapRecord);
  const selectedPosterSourceRun = resolveSelectedPosterSourceRun({
    mapRecord,
    selectedPosterVersion,
    relatedRuns,
  });
  const latestLifecycleRun = resolveLatestLifecycleRun(relatedRuns);

  const [rawArtifact, eventsArtifact, routeArtifact, knowledgeArtifact, mapViewArtifact] =
    await Promise.all([
      buildDatasetArtifactEntry({
        datasetKey: mapRecord.datasetKey,
        selectedRunPath: selectedPosterSourceRun?.artifacts.rawPath,
        kind: "raw",
      }),
      buildDatasetArtifactEntry({
        datasetKey: mapRecord.datasetKey,
        selectedRunPath: selectedPosterSourceRun?.artifacts.eventsPath,
        kind: "events",
      }),
      buildRouteArtifactEntry(mapRecord),
      buildKnowledgeArtifactEntry(mapRecord),
      buildMapViewArtifactEntry(mapId),
    ]);

  const currentPosterExists = await pathExists(fromPublicPath(mapRecord.posterPath));

  const runHistory = await Promise.all(
    relatedRuns.map(async (run) =>
      buildRunSummary({
        run,
        isSelectedPosterSource: run.runId === selectedPosterSourceRun?.runId,
        isLatestLifecycle: run.runId === latestLifecycleRun?.runId,
        posterAssetState: run.artifacts.posterPath
          ? await resolveHistoryPosterState({
              run,
              mapRecord,
              selectedPosterSourceRunId: selectedPosterSourceRun?.runId ?? null,
              latestLifecycleRun,
            })
          : null,
      }),
    ),
  );

  const integrityIssues = await buildIntegrityIssues({
    mapRecord,
    selectedPosterVersion,
    selectedPosterSourceRun,
    routeMissingOrError: routeArtifact.error,
    knowledgeMissingOrError: knowledgeArtifact.error,
    currentPosterExists,
    mapViewMissingOrError: mapViewArtifact.error,
    mapView: mapViewArtifact.mapView,
  });

  const currentArtifacts: TraceCurrentArtifacts = {
    raw: rawArtifact,
    events: eventsArtifact,
    route: routeArtifact.entry,
    knowledge: knowledgeArtifact.entry,
    mapView: mapViewArtifact.entry,
    poster: {
      publicPath: mapRecord.posterPath,
      exists: currentPosterExists,
      sourceRunId: selectedPosterSourceRun?.runId ?? null,
      selectedVersionId: selectedPosterVersion?.versionId ?? null,
    },
  };

  return {
    mapId: mapRecord.mapId,
    mapName: mapRecord.mapName,
    city: mapRecord.city,
    datasetKey: mapRecord.datasetKey,
    mapStatus: mapRecord.status,
    eventCount: mapRecord.eventCount,
    updatedAt: mapRecord.updatedAt,
    currentRunIdRaw: mapRecord.currentRunId,
    selectedPosterVersion: selectedPosterVersion ? createPosterVersionInfo(selectedPosterVersion) : null,
    selectedPosterSourceRun: selectedPosterSourceRun
      ? buildRunSummary({
          run: selectedPosterSourceRun,
          isSelectedPosterSource: true,
          isLatestLifecycle: selectedPosterSourceRun.runId === latestLifecycleRun?.runId,
          posterAssetState: runHistory.find((item) => item.runId === selectedPosterSourceRun.runId)?.posterAssetState ?? null,
        })
      : null,
    latestLifecycleRun: latestLifecycleRun
      ? buildRunSummary({
          run: latestLifecycleRun,
          isSelectedPosterSource: latestLifecycleRun.runId === selectedPosterSourceRun?.runId,
          isLatestLifecycle: true,
          posterAssetState: runHistory.find((item) => item.runId === latestLifecycleRun.runId)?.posterAssetState ?? null,
        })
      : null,
    currentArtifacts,
    aiContract: buildAiContract({
      parsedRoute: routeArtifact.parsedRoute,
      parsedRouteError: routeArtifact.error,
      knowledge: knowledgeArtifact.knowledge,
    }),
    commentCards: buildCommentCards(mapViewArtifact.mapView),
    runHistory,
    integrityIssues,
  };
}
