import path from "node:path";
import { resolveDatasetKey, getDemoDataset } from "@/src/config/demo";
import {
  eventsSnapshotSchema,
  mapRecordSchema,
  mapViewModelSchema,
  rawDatasetSnapshotSchema,
  runTraceSchema,
  type EventsSnapshot,
  type Landmark,
  type MapRecord,
  type MapViewModel,
  type RawDatasetSnapshot,
  type RunTrace,
} from "@/src/contracts/domain";
import {
  deleteFilePaths,
  ensureStorageDirectories,
  fromPublicPath,
  listJsonFiles,
  pathExists,
  readJsonFile,
  readTextFile,
  storagePaths,
  writeJsonFile,
  writeTextFile,
} from "@/src/server/utils/storage";

const runStaleAfterMs = 5 * 60 * 1000;

function rawDatasetFile(datasetKey?: string) {
  const dataset = getDemoDataset(datasetKey);
  return path.join(storagePaths.raw, dataset.rawFileName);
}

function eventDatasetFile(datasetKey?: string) {
  const dataset = getDemoDataset(datasetKey);
  return path.join(storagePaths.events, dataset.eventsFileName);
}

function mapRecordFile(mapId: string) {
  return path.join(storagePaths.maps, `${mapId}.json`);
}

function routeFile(mapId: string) {
  return path.join(storagePaths.routes, `${mapId}.route.md`);
}

function knowledgeFile(mapId: string) {
  return path.join(storagePaths.routes, `${mapId}.knowledge.json`);
}

function renderedMapFile(mapId: string) {
  return path.join(storagePaths.maps, `${mapId}.view.json`);
}

function runFile(runId: string) {
  return path.join(storagePaths.runs, `${runId}.json`);
}

export async function getRawDataset(datasetKey?: string) {
  await ensureStorageDirectories();
  const resolvedDatasetKey = resolveDatasetKey(datasetKey);
  const snapshot = await readJsonFile<RawDatasetSnapshot>(rawDatasetFile(resolvedDatasetKey));
  return snapshot
    ? rawDatasetSnapshotSchema.parse({
        ...snapshot,
        datasetKey: resolvedDatasetKey,
      })
    : null;
}

export async function saveRawDataset(snapshot: RawDatasetSnapshot, datasetKey?: string) {
  await ensureStorageDirectories();
  const resolvedDatasetKey = snapshot.datasetKey ?? resolveDatasetKey(datasetKey);
  await writeJsonFile(
    rawDatasetFile(resolvedDatasetKey),
    rawDatasetSnapshotSchema.parse({
      ...snapshot,
      datasetKey: resolvedDatasetKey,
    }),
  );
}

export async function getEventsDataset(datasetKey?: string) {
  await ensureStorageDirectories();
  const resolvedDatasetKey = resolveDatasetKey(datasetKey);
  const snapshot = await readJsonFile<EventsSnapshot>(eventDatasetFile(resolvedDatasetKey));
  return snapshot
    ? eventsSnapshotSchema.parse({
        ...snapshot,
        datasetKey: resolvedDatasetKey,
      })
    : null;
}

export async function saveEventsDataset(snapshot: EventsSnapshot, datasetKey?: string) {
  await ensureStorageDirectories();
  const resolvedDatasetKey = snapshot.datasetKey ?? resolveDatasetKey(datasetKey);
  await writeJsonFile(
    eventDatasetFile(resolvedDatasetKey),
    eventsSnapshotSchema.parse({
      ...snapshot,
      datasetKey: resolvedDatasetKey,
    }),
  );
}

export async function saveMapRecord(record: MapRecord) {
  await ensureStorageDirectories();
  await writeJsonFile(mapRecordFile(record.mapId), record);
}

export async function getMapRecord(mapId: string) {
  const record = await readJsonFile<MapRecord>(mapRecordFile(mapId));
  return record ? mapRecordSchema.parse(record) : null;
}

export async function listMapRecords() {
  const files = (await listJsonFiles(storagePaths.maps)).filter(
    (fileName) => !fileName.endsWith(".view.json"),
  );
  const records = await Promise.all(
    files.map(async (fileName) => {
      const record = await readJsonFile<MapRecord>(path.join(storagePaths.maps, fileName));
      return record ? mapRecordSchema.parse(record) : null;
    }),
  );

  return records
    .filter((record): record is MapRecord => Boolean(record))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveRouteMarkdown(mapId: string, markdown: string) {
  await ensureStorageDirectories();
  await writeTextFile(routeFile(mapId), markdown);
  return routeFile(mapId);
}

export async function getRouteMarkdown(mapId: string) {
  return readTextFile(routeFile(mapId));
}

export async function saveKnowledge(mapId: string, knowledge: Landmark[]) {
  await ensureStorageDirectories();
  await writeJsonFile(knowledgeFile(mapId), knowledge);
  return knowledgeFile(mapId);
}

export async function getKnowledge(mapId: string) {
  const content = await readJsonFile<Landmark[]>(knowledgeFile(mapId));
  return content ?? [];
}

export async function saveMapViewModel(mapId: string, map: MapViewModel) {
  await ensureStorageDirectories();
  await writeJsonFile(mapRecordFile(mapId), mapRecordSchema.parse({
    mapId: map.mapId,
    datasetKey: map.datasetKey,
    mapName: map.mapName,
    city: map.city,
    style: map.style,
    status: "draft",
    eventCount: map.events.length,
    routePath: routeFile(mapId),
    posterPath: map.posterPath,
    knowledgePath: knowledgeFile(mapId),
    currentRunId: "",
    selectedCommentIds: map.events.map((event) => event.commentId),
    createdAt: map.generatedAt,
    updatedAt: map.generatedAt,
  }));
}

export async function writeMapViewModel(mapId: string, map: MapViewModel) {
  await ensureStorageDirectories();
  await writeJsonFile(mapRecordFile(mapId), mapRecordSchema.parse({
    mapId: map.mapId,
    datasetKey: map.datasetKey,
    mapName: map.mapName,
    city: map.city,
    style: map.style,
    status: "draft",
    eventCount: map.events.length,
    routePath: routeFile(mapId),
    posterPath: map.posterPath,
    knowledgePath: knowledgeFile(mapId),
    currentRunId: "",
    selectedCommentIds: map.events.map((event) => event.commentId),
    createdAt: map.generatedAt,
    updatedAt: map.generatedAt,
  }));
}

export async function saveRenderedMap(mapId: string, map: MapViewModel) {
  await ensureStorageDirectories();
  await writeJsonFile(renderedMapFile(mapId), map);
}

export async function getRenderedMap(mapId: string) {
  const map = await readJsonFile<MapViewModel>(renderedMapFile(mapId));
  return map ? mapViewModelSchema.parse(map) : null;
}

export async function saveRunTrace(trace: RunTrace) {
  await ensureStorageDirectories();
  await writeJsonFile(runFile(trace.runId), trace);
}

export async function getRunTrace(runId: string) {
  const trace = await readJsonFile<RunTrace>(runFile(runId));
  return trace ? runTraceSchema.parse(trace) : null;
}

export async function updateRunTrace(runId: string, patch: Partial<RunTrace>) {
  const current = await getRunTrace(runId);
  if (!current) {
    throw new Error(`run ${runId} 不存在`);
  }

  const nextTrace = runTraceSchema.parse({
    ...current,
    ...patch,
    artifacts: {
      ...current.artifacts,
      ...(patch.artifacts ?? {}),
    },
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  });
  await saveRunTrace(nextTrace);
  return nextTrace;
}

export async function getRunTraceWithRecovery(runId: string) {
  const trace = await getRunTrace(runId);
  if (!trace) {
    return null;
  }

  const lastTick = trace.updatedAt ?? trace.startedAt;
  const isRunningTooLong =
    trace.status === "running" &&
    Date.now() - Date.parse(lastTick) > runStaleAfterMs;

  if (!isRunningTooLong) {
    return trace;
  }

  return updateRunTrace(runId, {
    status: "incomplete",
    errorMessage: trace.errorMessage ?? "本次生成未正常完成，请重试。",
    endedAt: trace.endedAt ?? new Date().toISOString(),
  });
}

export async function listRunTraces() {
  const files = await listJsonFiles(storagePaths.runs);
  const traces = await Promise.all(
    files.map(async (fileName) => {
      const trace = await readJsonFile<RunTrace>(path.join(storagePaths.runs, fileName));
      return trace ? runTraceSchema.parse(trace) : null;
    }),
  );

  return traces
    .filter((trace): trace is RunTrace => Boolean(trace))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function deleteMapArtifacts(mapId: string) {
  await ensureStorageDirectories();
  const defaultArtifactPaths = [
    mapRecordFile(mapId),
    renderedMapFile(mapId),
    routeFile(mapId),
    knowledgeFile(mapId),
    posterOutputPath(mapId, "png"),
    posterOutputPath(mapId, "svg"),
  ];

  const [mapRecord, renderedMap, runTraces] = await Promise.all([
    getMapRecord(mapId),
    getRenderedMap(mapId),
    listRunTraces(),
  ]);
  const relatedRunTraces = runTraces.filter((trace) => trace.mapId === mapId);
  const existingDefaultArtifactPaths = (
    await Promise.all(
      defaultArtifactPaths.map(async (artifactPath) => ((await pathExists(artifactPath)) ? artifactPath : null)),
    )
  ).filter((artifactPath): artifactPath is string => Boolean(artifactPath));

  if (!mapRecord && !renderedMap && !relatedRunTraces.length && !existingDefaultArtifactPaths.length) {
    return null;
  }

  const artifactPathSet = new Set<string>(defaultArtifactPaths);

  if (mapRecord?.routePath) {
    artifactPathSet.add(mapRecord.routePath);
  }

  if (mapRecord?.knowledgePath) {
    artifactPathSet.add(mapRecord.knowledgePath);
  }

  if (mapRecord?.posterPath) {
    artifactPathSet.add(fromPublicPath(mapRecord.posterPath));
  }

  mapRecord?.posterVersions.forEach((version) => {
    artifactPathSet.add(fromPublicPath(version.posterPath));
  });

  if (renderedMap?.posterPath) {
    artifactPathSet.add(fromPublicPath(renderedMap.posterPath));
  }

  relatedRunTraces.forEach((trace) => {
    artifactPathSet.add(runFile(trace.runId));
    if (trace.artifacts.posterPath) {
      artifactPathSet.add(fromPublicPath(trace.artifacts.posterPath));
    }
  });

  const deletedArtifactPaths = [...artifactPathSet];
  await deleteFilePaths(deletedArtifactPaths);

  const remainingArtifactPaths = (
    await Promise.all(
      deletedArtifactPaths.map(async (artifactPath) => ((await pathExists(artifactPath)) ? artifactPath : null)),
    )
  ).filter((artifactPath): artifactPath is string => Boolean(artifactPath));

  const [nextMapRecord, nextRenderedMap, nextRunTraces] = await Promise.all([
    getMapRecord(mapId),
    getRenderedMap(mapId),
    listRunTraces(),
  ]);

  return {
    mapId,
    deletedRunIds: relatedRunTraces.map((trace) => trace.runId),
    deletedArtifactPaths,
    remainingArtifactPaths,
    verified:
      !nextMapRecord &&
      !nextRenderedMap &&
      !nextRunTraces.some((trace) => trace.mapId === mapId) &&
      !remainingArtifactPaths.length,
  };
}

export function posterOutputPath(
  mapId: string,
  extension: "png" | "svg" = "png",
  versionTag?: string,
) {
  const fileName = versionTag ? `${mapId}__${versionTag}.${extension}` : `${mapId}.${extension}`;
  return path.join(storagePaths.posters, fileName);
}

export function posterPublicPath(
  mapId: string,
  extension: "png" | "svg" = "png",
  versionTag?: string,
) {
  const fileName = versionTag ? `${mapId}__${versionTag}.${extension}` : `${mapId}.${extension}`;
  return `/mock/posters/${fileName}`;
}
