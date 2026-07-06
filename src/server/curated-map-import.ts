import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  curatedMapImportEntrySchema,
  curatedMapImportReportSchema,
  mapRecordSchema,
  mapViewModelSchema,
  runTraceSchema,
  type CuratedMapImportAsset,
  type CuratedMapImportEntry,
  type CuratedMapImportMode,
  type CuratedMapImportReport,
  type Landmark,
  type MapRecord,
  type MapViewModel,
  type RunTrace,
} from "@/src/contracts/domain";
import {
  getMapRecord,
  getRenderedMap,
  getRouteMarkdown,
  getRunTrace,
  listMapRecords,
} from "@/src/server/repositories/demo-repository";
import {
  fromPublicPathCandidates,
  pathExists,
  readJsonFile,
  readBinaryFile,
  runtimeAssetPublicPath,
  storagePaths,
  writeBinaryFile,
  writeJsonFile,
  writeTextFile,
} from "@/src/server/utils/storage";

type PrepareCuratedMapImportOptions = {
  mode: CuratedMapImportMode;
  mapIds?: string[];
  dryRun?: boolean;
  expectedCount?: number;
  targetRoot?: string;
};

type ApplyCuratedMapImportOptions = PrepareCuratedMapImportOptions & {
  apply: true;
};

type PreparedAssetCopy = {
  sourcePath: string;
  targetPath: string;
};

type PreparedCuratedMapEntry = {
  entry: CuratedMapImportEntry;
  mapRecord: MapRecord;
  renderedMap: MapViewModel;
  routeMarkdown: string;
  knowledge: Landmark[];
  runTraces: RunTrace[];
  posterCopies: PreparedAssetCopy[];
  videoCopies: PreparedAssetCopy[];
};

type PreparedCuratedMapImport = {
  mode: CuratedMapImportMode;
  dryRun: boolean;
  expectedCount?: number;
  targetRoot?: string;
  report: CuratedMapImportReport;
  preparedEntries: PreparedCuratedMapEntry[];
};

type ImportRuntimePaths = {
  root: string;
  mockRoot: string;
  routes: string;
  posters: string;
  videos: string;
  maps: string;
  runs: string;
  reportFile: string;
  mapRecordFile: (mapId: string) => string;
  renderedMapFile: (mapId: string) => string;
  routeFile: (mapId: string) => string;
  knowledgeFile: (mapId: string) => string;
  runFile: (runId: string) => string;
  posterFile: (fileName: string) => string;
  videoFile: (fileName: string) => string;
};

function buildImportRuntimePaths(root: string): ImportRuntimePaths {
  const mockRoot = path.join(root, "mock");
  return {
    root,
    mockRoot,
    routes: path.join(mockRoot, "routes"),
    posters: path.join(mockRoot, "posters"),
    videos: path.join(mockRoot, "videos"),
    maps: path.join(mockRoot, "maps"),
    runs: path.join(mockRoot, "runs"),
    reportFile: path.join(root, "report.json"),
    mapRecordFile: (mapId) => path.join(mockRoot, "maps", `${mapId}.json`),
    renderedMapFile: (mapId) => path.join(mockRoot, "maps", `${mapId}.view.json`),
    routeFile: (mapId) => path.join(mockRoot, "routes", `${mapId}.route.md`),
    knowledgeFile: (mapId) => path.join(mockRoot, "routes", `${mapId}.knowledge.json`),
    runFile: (runId) => path.join(mockRoot, "runs", `${runId}.json`),
    posterFile: (fileName) => path.join(mockRoot, "posters", fileName),
    videoFile: (fileName) => path.join(mockRoot, "videos", fileName),
  };
}

function createTimestampSlug() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];
  return parts.join("");
}

function buildDefaultTargetRoot(mode: CuratedMapImportMode) {
  const importName = mode === "favorite_preload" ? "favorite-preload" : "manual-curated";
  return path.join(storagePaths.runtimeDir, "imports", `${importName}-${createTimestampSlug()}`);
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function assetLabel(kind: CuratedMapImportAsset["kind"], suffix?: string) {
  if (kind === "map_record") {
    return "mapRecord";
  }
  if (kind === "rendered_map") {
    return "renderedMap";
  }
  if (kind === "route_markdown") {
    return "route.md";
  }
  if (kind === "knowledge") {
    return "knowledge";
  }
  if (kind === "poster") {
    return suffix ? `poster:${suffix}` : "poster";
  }
  if (kind === "video") {
    return suffix ? `video:${suffix}` : "video";
  }
  if (kind === "run") {
    return suffix ? `run:${suffix}` : "run";
  }
  return kind;
}

function buildAsset(params: {
  kind: CuratedMapImportAsset["kind"];
  path: string;
  required: boolean;
  exists: boolean;
  suffix?: string;
}) {
  return {
    kind: params.kind,
    label: assetLabel(params.kind, params.suffix),
    path: params.path,
    required: params.required,
    exists: params.exists,
  } satisfies CuratedMapImportAsset;
}

function extractFileName(value: string) {
  return value.split("/").filter(Boolean).pop() ?? path.basename(value);
}

async function resolveExistingSourcePath(candidates: string[]) {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function resolveExistingPublicAssetSource(publicPath: string) {
  return resolveExistingSourcePath(fromPublicPathCandidates(publicPath));
}

function rewritePosterPublicPath(publicPath: string) {
  return runtimeAssetPublicPath("posters", extractFileName(publicPath));
}

function rewriteVideoPublicPath(publicPath: string) {
  return runtimeAssetPublicPath("videos", extractFileName(publicPath));
}

function rewriteRunForTarget(run: RunTrace) {
  return runTraceSchema.parse({
    ...run,
    artifacts: {
      ...run.artifacts,
      routePath: run.artifacts.routePath
        ? runtimeAssetPublicPath("routes", extractFileName(run.artifacts.routePath))
        : undefined,
      posterPath: run.artifacts.posterPath
        ? rewritePosterPublicPath(run.artifacts.posterPath)
        : undefined,
      videoPath: run.artifacts.videoPath
        ? rewriteVideoPublicPath(run.artifacts.videoPath)
        : undefined,
      mapPath: run.artifacts.mapPath
        ? runtimeAssetPublicPath("maps", extractFileName(run.artifacts.mapPath))
        : undefined,
    },
  });
}

function rewriteMapRecordForTarget(mapRecord: MapRecord) {
  return mapRecordSchema.parse({
    ...mapRecord,
    routePath: runtimeAssetPublicPath("routes", `${mapRecord.mapId}.route.md`),
    knowledgePath: runtimeAssetPublicPath("routes", `${mapRecord.mapId}.knowledge.json`),
    posterPath: rewritePosterPublicPath(mapRecord.posterPath),
    videoPath: mapRecord.videoPath ? rewriteVideoPublicPath(mapRecord.videoPath) : undefined,
    posterVersions: (mapRecord.posterVersions ?? []).map((version) => ({
      ...version,
      posterPath: rewritePosterPublicPath(version.posterPath),
    })),
  });
}

function rewriteRenderedMapForTarget(renderedMap: MapViewModel) {
  return mapViewModelSchema.parse({
    ...renderedMap,
    posterPath: rewritePosterPublicPath(renderedMap.posterPath),
    videoPath: renderedMap.videoPath ? rewriteVideoPublicPath(renderedMap.videoPath) : undefined,
  });
}

async function ensureImportDirectories(targetPaths: ImportRuntimePaths) {
  await Promise.all([
    mkdir(targetPaths.root, { recursive: true }),
    mkdir(targetPaths.routes, { recursive: true }),
    mkdir(targetPaths.posters, { recursive: true }),
    mkdir(targetPaths.videos, { recursive: true }),
    mkdir(targetPaths.maps, { recursive: true }),
    mkdir(targetPaths.runs, { recursive: true }),
  ]);
}

function buildRunIds(mapRecord: MapRecord) {
  return dedupe([
    mapRecord.currentRunId,
    mapRecord.currentVideoRunId,
    ...(mapRecord.posterVersions ?? []).map((version) => version.runId),
  ].filter((value): value is string => Boolean(value)));
}

async function prepareExistingMapEntry(params: {
  mapRecord: MapRecord;
  selectionReason: CuratedMapImportEntry["selectionReason"];
}): Promise<PreparedCuratedMapEntry> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const assets: CuratedMapImportAsset[] = [];
  const posterCopies: PreparedAssetCopy[] = [];
  const videoCopies: PreparedAssetCopy[] = [];
  const dedupedPosterSources = new Set<string>();
  const dedupedVideoSources = new Set<string>();

  const mapRecordPath = path.join(storagePaths.maps, `${params.mapRecord.mapId}.json`);
  const renderedMapPath = path.join(storagePaths.maps, `${params.mapRecord.mapId}.view.json`);
  const routeFileExists = await pathExists(params.mapRecord.routePath);
  const knowledgeFileExists = await pathExists(params.mapRecord.knowledgePath);
  const mapRecordExists = await pathExists(mapRecordPath);
  const renderedMapExists = await pathExists(renderedMapPath);

  assets.push(buildAsset({
    kind: "map_record",
    path: mapRecordPath,
    required: true,
    exists: mapRecordExists,
  }));
  if (!mapRecordExists) {
    errors.push(`地图 ${params.mapRecord.mapId} 缺少 mapRecord 文件。`);
  }

  assets.push(buildAsset({
    kind: "rendered_map",
    path: renderedMapPath,
    required: true,
    exists: renderedMapExists,
  }));
  if (!renderedMapExists) {
    errors.push(`地图 ${params.mapRecord.mapId} 缺少 renderedMap 文件。`);
  }

  assets.push(buildAsset({
    kind: "route_markdown",
    path: params.mapRecord.routePath,
    required: true,
    exists: routeFileExists,
  }));
  if (!routeFileExists) {
    errors.push(`地图 ${params.mapRecord.mapId} 缺少 route.md。`);
  }

  assets.push(buildAsset({
    kind: "knowledge",
    path: params.mapRecord.knowledgePath,
    required: true,
    exists: knowledgeFileExists,
  }));
  if (!knowledgeFileExists) {
    errors.push(`地图 ${params.mapRecord.mapId} 缺少 knowledge 文件。`);
  }

  const renderedMap = await getRenderedMap(params.mapRecord.mapId);
  if (!renderedMap) {
    errors.push(`地图 ${params.mapRecord.mapId} 无法读取 renderedMap 内容。`);
  }
  const routeMarkdown = routeFileExists ? await getRouteMarkdown(params.mapRecord.mapId) : null;
  if (!routeMarkdown) {
    errors.push(`地图 ${params.mapRecord.mapId} route.md 内容为空。`);
  }
  const knowledge = knowledgeFileExists
    ? await readJsonFile<Landmark[]>(params.mapRecord.knowledgePath)
    : null;
  if (!knowledge) {
    errors.push(`地图 ${params.mapRecord.mapId} knowledge 内容为空。`);
  }

  const posterPublicPaths = dedupe([
    params.mapRecord.posterPath,
    renderedMap?.posterPath,
    ...(params.mapRecord.posterVersions ?? []).map((version) => version.posterPath),
  ].filter((value): value is string => Boolean(value)));

  for (const posterPublicPath of posterPublicPaths) {
    const sourcePath = await resolveExistingPublicAssetSource(posterPublicPath);
    assets.push(buildAsset({
      kind: "poster",
      path: posterPublicPath,
      required: true,
      exists: Boolean(sourcePath),
      suffix: extractFileName(posterPublicPath),
    }));
    if (!sourcePath) {
      errors.push(`地图 ${params.mapRecord.mapId} 缺少海报文件 ${posterPublicPath}。`);
      continue;
    }

    if (dedupedPosterSources.has(sourcePath)) {
      continue;
    }

    dedupedPosterSources.add(sourcePath);
    posterCopies.push({
      sourcePath,
      targetPath: buildImportRuntimePaths(storagePaths.runtimeDir).posterFile(extractFileName(posterPublicPath)),
    });
  }

  const videoPublicPaths = dedupe([
    params.mapRecord.videoPath,
    renderedMap?.videoPath,
  ].filter((value): value is string => Boolean(value)));

  if (!videoPublicPaths.length) {
    warnings.push(`地图 ${params.mapRecord.mapId} 当前无视频，将按“地图可导入、视频跳过”处理。`);
  }

  for (const videoPublicPath of videoPublicPaths) {
    const sourcePath = await resolveExistingPublicAssetSource(videoPublicPath);
    assets.push(buildAsset({
      kind: "video",
      path: videoPublicPath,
      required: false,
      exists: Boolean(sourcePath),
      suffix: extractFileName(videoPublicPath),
    }));
    if (!sourcePath) {
      warnings.push(`地图 ${params.mapRecord.mapId} 缺少视频文件 ${videoPublicPath}，导入时将跳过。`);
      continue;
    }

    if (dedupedVideoSources.has(sourcePath)) {
      continue;
    }

    dedupedVideoSources.add(sourcePath);
    videoCopies.push({
      sourcePath,
      targetPath: buildImportRuntimePaths(storagePaths.runtimeDir).videoFile(extractFileName(videoPublicPath)),
    });
  }

  const runIds = buildRunIds(params.mapRecord);
  const requiredRunIds = new Set<string>(
    [params.mapRecord.currentRunId, params.mapRecord.currentVideoRunId].filter(
      (value): value is string => Boolean(value),
    ),
  );
  const runTraces = (
    await Promise.all(
      runIds.map(async (runId) => {
        const run = await getRunTrace(runId);
        const runPath = path.join(storagePaths.runs, `${runId}.json`);
        const required = requiredRunIds.has(runId);
        assets.push(buildAsset({
          kind: "run",
          path: runPath,
          required,
          exists: Boolean(run),
          suffix: runId,
        }));

        if (!run) {
          const message = `地图 ${params.mapRecord.mapId} 缺少 run ${runId}。`;
          if (required) {
            errors.push(message);
          } else {
            warnings.push(`${message} 将跳过该历史 run。`);
          }
          return null;
        }

        return run;
      }),
    )
  ).filter((run): run is RunTrace => Boolean(run));

  const entry = curatedMapImportEntrySchema.parse({
    mapId: params.mapRecord.mapId,
    mapName: params.mapRecord.mapName,
    datasetKey: params.mapRecord.datasetKey,
    selectionReason: params.selectionReason,
    hasVideo: videoCopies.length > 0,
    ready:
      !errors.length &&
      Boolean(renderedMap) &&
      Boolean(routeMarkdown) &&
      Boolean(knowledge),
    runIds,
    warnings,
    errors,
    assets,
  });

  return {
    entry,
    mapRecord: params.mapRecord,
    renderedMap: renderedMap ?? mapViewModelSchema.parse({
      mapId: params.mapRecord.mapId,
      datasetKey: params.mapRecord.datasetKey,
      mapName: params.mapRecord.mapName,
      city: params.mapRecord.city,
      style: params.mapRecord.style,
      isFavorite: params.mapRecord.isFavorite,
      imageModel: params.mapRecord.imageModel,
      currentVideoRunId: params.mapRecord.currentVideoRunId,
      videoPath: params.mapRecord.videoPath,
      videoDurationSeconds: params.mapRecord.videoDurationSeconds,
      videoUpdatedAt: params.mapRecord.videoUpdatedAt,
      videoModel: params.mapRecord.videoModel,
      posterPath: params.mapRecord.posterPath,
      routeMarkdown: routeMarkdown ?? "",
      selectedEventId: "",
      generatedAt: params.mapRecord.updatedAt,
      knowledge: knowledge ?? [],
      nodes: [],
      events: [],
    }),
    routeMarkdown: routeMarkdown ?? "",
    knowledge: knowledge ?? [],
    runTraces,
    posterCopies,
    videoCopies,
  };
}

function buildMissingMapEntry(mapId: string) {
  return curatedMapImportEntrySchema.parse({
    mapId,
    selectionReason: "explicit",
    hasVideo: false,
    ready: false,
    runIds: [],
    warnings: [],
    errors: [`地图 ${mapId} 不存在，无法导入。`],
    assets: [],
  });
}

function buildReport(params: {
  mode: CuratedMapImportMode;
  dryRun: boolean;
  targetRoot?: string;
  expectedCount?: number;
  totalRequested: number;
  entries: CuratedMapImportEntry[];
  warnings: string[];
  errors: string[];
  appliedAt?: string;
}) {
  return curatedMapImportReportSchema.parse({
    mode: params.mode,
    dryRun: params.dryRun,
    targetRoot: params.targetRoot,
    expectedCount: params.expectedCount,
    totalRequested: params.totalRequested,
    totalSelected: params.entries.length,
    readyCount: params.entries.filter((entry) => entry.ready).length,
    mapsWithVideo: params.entries.filter((entry) => entry.hasVideo).length,
    mapsWithoutVideo: params.entries.filter((entry) => !entry.hasVideo).length,
    warnings: params.warnings,
    errors: params.errors,
    entries: params.entries,
    appliedAt: params.appliedAt,
  });
}

export function hasBlockingCuratedMapImportErrors(report: CuratedMapImportReport) {
  return report.errors.length > 0 || report.entries.some((entry) => entry.errors.length > 0);
}

export function formatCuratedMapImportReport(report: CuratedMapImportReport) {
  const lines = [
    `mode: ${report.mode}`,
    `dryRun: ${report.dryRun}`,
    `targetRoot: ${report.targetRoot ?? "(none)"}`,
    `selected: ${report.totalSelected}/${report.totalRequested}`,
    `ready: ${report.readyCount}/${report.totalSelected}`,
    `video: ${report.mapsWithVideo} with video, ${report.mapsWithoutVideo} without video`,
  ];

  if (report.expectedCount !== undefined) {
    lines.push(`expectedCount: ${report.expectedCount}`);
  }

  if (report.warnings.length) {
    lines.push(`warnings: ${report.warnings.length}`);
    for (const warning of report.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (report.errors.length) {
    lines.push(`errors: ${report.errors.length}`);
    for (const error of report.errors) {
      lines.push(`  - ${error}`);
    }
  }

  lines.push("entries:");
  for (const entry of report.entries) {
    lines.push(
      `  - ${entry.mapId} | ${entry.mapName ?? "(unknown)"} | ${entry.ready ? "READY" : "INVALID"} | video=${entry.hasVideo ? "yes" : "no"}`,
    );
    if (entry.warnings.length) {
      for (const warning of entry.warnings) {
        lines.push(`      warning: ${warning}`);
      }
    }
    if (entry.errors.length) {
      for (const error of entry.errors) {
        lines.push(`      error: ${error}`);
      }
    }
  }

  return lines.join("\n");
}

export async function prepareCuratedMapImport(options: PrepareCuratedMapImportOptions) {
  const dryRun = options.dryRun ?? true;
  const globalWarnings: string[] = [];
  const globalErrors: string[] = [];
  const entries: CuratedMapImportEntry[] = [];
  const preparedEntries: PreparedCuratedMapEntry[] = [];

  if (options.mode === "manual") {
    const dedupedMapIds = dedupe(options.mapIds ?? []);
    if (!dedupedMapIds.length) {
      globalErrors.push("manual 导图至少需要 1 个 mapId。");
    }

    if ((options.mapIds ?? []).length !== dedupedMapIds.length) {
      globalWarnings.push("检测到重复 mapId，已按去重后的列表执行。");
    }

    for (const mapId of dedupedMapIds) {
      const mapRecord = await getMapRecord(mapId);
      if (!mapRecord) {
        entries.push(buildMissingMapEntry(mapId));
        continue;
      }

      const preparedEntry = await prepareExistingMapEntry({
        mapRecord,
        selectionReason: "explicit",
      });
      entries.push(preparedEntry.entry);
      preparedEntries.push(preparedEntry);
    }

    const report = buildReport({
      mode: options.mode,
      dryRun,
      targetRoot: options.targetRoot,
      expectedCount: options.expectedCount,
      totalRequested: dedupedMapIds.length,
      entries,
      warnings: globalWarnings,
      errors: globalErrors,
    });

    return {
      mode: options.mode,
      dryRun,
      expectedCount: options.expectedCount,
      targetRoot: options.targetRoot,
      report,
      preparedEntries,
    } satisfies PreparedCuratedMapImport;
  }

  const favoriteMapRecords = (await listMapRecords()).filter((record) => record.isFavorite);
  if (options.expectedCount !== undefined && favoriteMapRecords.length !== options.expectedCount) {
    globalErrors.push(
      `收藏地图数量校验失败：期望 ${options.expectedCount} 张，实际 ${favoriteMapRecords.length} 张。`,
    );
  }

  for (const mapRecord of favoriteMapRecords) {
    const preparedEntry = await prepareExistingMapEntry({
      mapRecord,
      selectionReason: "favorite",
    });
    entries.push(preparedEntry.entry);
    preparedEntries.push(preparedEntry);
  }

  const report = buildReport({
    mode: options.mode,
    dryRun,
    targetRoot: options.targetRoot,
    expectedCount: options.expectedCount,
    totalRequested: favoriteMapRecords.length,
    entries,
    warnings: globalWarnings,
    errors: globalErrors,
  });

  return {
    mode: options.mode,
    dryRun,
    expectedCount: options.expectedCount,
    targetRoot: options.targetRoot,
    report,
    preparedEntries,
  } satisfies PreparedCuratedMapImport;
}

async function copyAssetFile(copyPlan: PreparedAssetCopy) {
  await mkdir(path.dirname(copyPlan.targetPath), { recursive: true });
  if (path.resolve(copyPlan.sourcePath) === path.resolve(copyPlan.targetPath)) {
    return;
  }

  const content = await readBinaryFile(copyPlan.sourcePath);
  if (!content) {
    throw new Error(`缺少待复制文件 ${copyPlan.sourcePath}`);
  }

  await writeBinaryFile(copyPlan.targetPath, content);
}

export async function applyCuratedMapImport(options: ApplyCuratedMapImportOptions) {
  const targetRoot = options.targetRoot ?? buildDefaultTargetRoot(options.mode);
  const prepared = await prepareCuratedMapImport({
    ...options,
    targetRoot,
    dryRun: false,
  });

  if (hasBlockingCuratedMapImportErrors(prepared.report)) {
    return prepared.report;
  }

  const targetPaths = buildImportRuntimePaths(targetRoot);
  await ensureImportDirectories(targetPaths);

  for (const preparedEntry of prepared.preparedEntries) {
    const rewrittenMapRecord = rewriteMapRecordForTarget(preparedEntry.mapRecord);
    const rewrittenRenderedMap = rewriteRenderedMapForTarget(preparedEntry.renderedMap);
    const rewrittenRuns = preparedEntry.runTraces.map((run) => rewriteRunForTarget(run));

    await Promise.all([
      writeJsonFile(targetPaths.mapRecordFile(preparedEntry.mapRecord.mapId), rewrittenMapRecord),
      writeJsonFile(targetPaths.renderedMapFile(preparedEntry.mapRecord.mapId), rewrittenRenderedMap),
      writeTextFile(targetPaths.routeFile(preparedEntry.mapRecord.mapId), preparedEntry.routeMarkdown),
      writeJsonFile(targetPaths.knowledgeFile(preparedEntry.mapRecord.mapId), preparedEntry.knowledge),
      ...rewrittenRuns.map((run) => writeJsonFile(targetPaths.runFile(run.runId), run)),
      ...preparedEntry.posterCopies.map((copyPlan) =>
        copyAssetFile({
          sourcePath: copyPlan.sourcePath,
          targetPath: targetPaths.posterFile(path.basename(copyPlan.targetPath)),
        })
      ),
      ...preparedEntry.videoCopies.map((copyPlan) =>
        copyAssetFile({
          sourcePath: copyPlan.sourcePath,
          targetPath: targetPaths.videoFile(path.basename(copyPlan.targetPath)),
        })
      ),
    ]);
  }

  const appliedReport = buildReport({
    mode: prepared.mode,
    dryRun: false,
    targetRoot,
    expectedCount: prepared.expectedCount,
    totalRequested: prepared.report.totalRequested,
    entries: prepared.report.entries,
    warnings: prepared.report.warnings,
    errors: prepared.report.errors,
    appliedAt: new Date().toISOString(),
  });
  await writeJsonFile(targetPaths.reportFile, appliedReport);

  return appliedReport;
}
