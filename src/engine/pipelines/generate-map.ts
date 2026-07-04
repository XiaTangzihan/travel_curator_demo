import {
  type GenerateRunInput,
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type Landmark,
  type MapRecord,
  type RawDatasetSnapshot,
  type RunTrace,
} from "@/src/contracts/domain";
import { getDemoDataset } from "@/src/config/demo";
import {
  buildLandmarkPrompt,
  buildPosterPrompt,
  buildRegeneratePosterPrompt,
  getStylePreset,
} from "@/src/engine/prompts";
import { buildMechanicalShortName } from "@/src/engine/prompts/shared";
import { buildRegenerateImagePublicPaths } from "@/src/engine/pipelines/model-image-inputs";
import { preprocessDataset } from "@/src/engine/preprocess/raw_to_events";
import { runDoubaoChat, runSeedreamImage } from "@/src/engine/providers/ark-provider";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import { getFallbackKnowledge } from "@/src/server/datasets/fallback-knowledge";
import { createFallbackPosterSvg } from "@/src/engine/renderers/fallback-poster";
import { createDeterministicRouteMarkdown } from "@/src/engine/renderers/route-markdown";
import { createMapId, createRunId } from "@/src/lib/ids";
import {
  getEventsDataset,
  getKnowledge,
  getRawDataset,
  getRunTrace,
  posterOutputPath,
  posterPublicPath,
  saveEventsDataset,
  saveKnowledge,
  saveMapRecord,
  saveRenderedMap,
  saveRouteMarkdown,
  saveRunTrace,
  updateRunTrace,
} from "@/src/server/repositories/demo-repository";
import { fromPublicPath, writeBinaryFile, writeTextFile } from "@/src/server/utils/storage";

type GenerateMapInput = GenerateRunInput;

type GenerateMapExecutionContext = {
  runId: string;
  mapId: string;
  startedAt: string;
  onProgress?: (patch: Partial<RunTrace>) => Promise<unknown> | unknown;
};

function buildRunInputSummary(params: {
  datasetKey: string;
  mapName: string;
  city: string;
  selectedCommentCount: number;
}) {
  return {
    datasetKey: params.datasetKey,
    mapName: params.mapName,
    city: params.city,
    selectedCommentCount: params.selectedCommentCount,
  };
}

function buildWaitPath(runId: string) {
  return `/workspace/generating/${runId}`;
}

function buildDatasetArtifactPaths(datasetKey: string) {
  const dataset = getDemoDataset(datasetKey);

  return {
    rawPath: `/mock/raw/${dataset.rawFileName}`,
    eventsPath: `/mock/events/${dataset.eventsFileName}`,
  };
}

function buildPreviewImagePaths(params: {
  rawDataset: RawDatasetSnapshot;
  selectedCommentIds: string[];
}) {
  const selectedCommentIdSet = new Set(params.selectedCommentIds);
  const previewImagePaths = params.rawDataset.reviews
    .filter((review) => selectedCommentIdSet.has(review.recordId))
    .flatMap((review) => review.attachments.map((attachment) => attachment.publicPath.trim()))
    .filter(Boolean);

  return [...new Set(previewImagePaths)].slice(0, 12);
}

function compareEventOrder(left: EventRecord, right: EventRecord) {
  const leftKey = `${left.day} ${left.time}`;
  const rightKey = `${right.day} ${right.time}`;
  return leftKey.localeCompare(rightKey);
}

function normalizeMapEvents(events: EventRecord[]) {
  return [...events].sort(compareEventOrder).map((event, index) => {
    const canonicalName = event.canonicalName?.trim() || event.poiName.trim();
    const shortName = event.shortName?.trim() || buildMechanicalShortName(canonicalName);

    return {
      ...event,
      sequence: index + 1,
      canonicalName,
      shortName,
    };
  });
}

function extractJsonArray(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型输出中未找到 JSON 数组");
  }
  return JSON.parse(text.slice(start, end + 1)) as Landmark[];
}

async function ensureEvents(datasetKey: string) {
  let eventsSnapshot = await getEventsDataset(datasetKey);
  if (eventsSnapshot) {
    return eventsSnapshot;
  }

  const rawDataset = await getRawDataset(datasetKey);
  if (!rawDataset) {
    const dataset = getDemoDataset(datasetKey);
    throw new Error(`本地原始${dataset.city}数据不存在，请先执行对应同步脚本`);
  }

  const generated = preprocessDataset(rawDataset);
  eventsSnapshot = {
    datasetKey: rawDataset.datasetKey,
    datasetId: rawDataset.datasetId,
    generatedAt: generated.report.generatedAt,
    report: generated.report,
    events: generated.events,
  };
  await saveEventsDataset(eventsSnapshot, datasetKey);
  return eventsSnapshot;
}

async function generateKnowledge(city: string) {
  const prompt = buildLandmarkPrompt(city);

  const content = await runDoubaoChat(
    [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    0.2,
  );

  return extractJsonArray(content);
}

async function writePosterFile(params: {
  mapId: string;
  city: string;
  styleKey: string;
  referenceImagePaths: string[];
  events: EventRecord[];
  knowledge: Landmark[];
  instruction?: string;
  basedOnExistingImage?: boolean;
}) {
  const prompt = buildPosterPrompt(params);
  const image = await runSeedreamImage({
    prompt,
    images: params.referenceImagePaths,
  });
  const outputPath = posterOutputPath(params.mapId, "png");
  await writeBinaryFile(outputPath, image);
  return posterPublicPath(params.mapId, "png");
}

async function writeRegeneratedPosterFile(params: {
  mapId: string;
  city: string;
  styleKey: string;
  referenceImagePaths: string[];
  events: EventRecord[];
  knowledge: Landmark[];
  instruction: string;
  basedOnExistingImage: boolean;
}) {
  const prompt = buildRegeneratePosterPrompt(params);
  const image = await runSeedreamImage({
    prompt,
    images: params.referenceImagePaths,
  });
  const outputPath = posterOutputPath(params.mapId, "png");
  await writeBinaryFile(outputPath, image);
  return posterPublicPath(params.mapId, "png");
}

async function generateMapDraftCore(
  input: GenerateMapInput,
  context: GenerateMapExecutionContext,
) {
  const warnings: string[] = [];
  let providerMode: RunTrace["providerMode"] = "live";

  const eventsSnapshot = await ensureEvents(input.datasetKey);
  const selectedEvents = normalizeMapEvents(
    eventsSnapshot.events.filter((event) =>
      input.selectedCommentIds.includes(event.commentId),
    ),
  );

  if (!selectedEvents.length) {
    throw new Error("没有可用于生成地图的事件");
  }

  const stylePreset = getStylePreset(input.style);
  const referenceImagePaths = [fromPublicPath(stylePreset.referencePublicPath)];
  const inputSummary = buildRunInputSummary({
    datasetKey: input.datasetKey,
    mapName: input.mapName,
    city: input.city,
    selectedCommentCount: selectedEvents.length,
  });

  let knowledge: Landmark[];
  try {
    knowledge = await generateKnowledge(input.city);
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P1 已回退：${(error as Error).message}`);
    knowledge = getFallbackKnowledge(input.datasetKey);
  }

  const routeMarkdown = createDeterministicRouteMarkdown({
    mapName: input.mapName,
    city: input.city,
    styleLabel: stylePreset.label,
    events: selectedEvents,
    knowledge,
  });

  const routePath = await saveRouteMarkdown(context.mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(context.mapId, knowledge);

  await context.onProgress?.({
    progressStep: "rendering",
  });

  let posterPath: string;
  try {
    posterPath = await writePosterFile({
      mapId: context.mapId,
      city: input.city,
      styleKey: input.style,
      referenceImagePaths,
      events: selectedEvents,
      knowledge,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P3 已回退：${(error as Error).message}`);
    const svg = createFallbackPosterSvg({
      city: input.city,
      styleLabel: stylePreset.label,
      events: selectedEvents,
    });
    await writeTextFile(posterOutputPath(context.mapId, "svg"), svg);
    posterPath = posterPublicPath(context.mapId, "svg");
  }

  await context.onProgress?.({
    progressStep: "finalizing",
  });

  const mapViewModel = buildMapViewModel({
    mapId: context.mapId,
    datasetKey: input.datasetKey,
    mapName: input.mapName,
    city: input.city,
    style: input.style,
    posterPath,
    routeMarkdown,
    events: selectedEvents,
    knowledge,
  });
  await saveRenderedMap(context.mapId, mapViewModel);

  const mapRecord: MapRecord = mapRecordSchema.parse({
    mapId: context.mapId,
    datasetKey: input.datasetKey,
    mapName: input.mapName,
    city: input.city,
    style: input.style,
    status: "draft",
    eventCount: selectedEvents.length,
    routePath,
    posterPath,
    knowledgePath,
    currentRunId: context.runId,
    selectedCommentIds: selectedEvents.map((event) => event.commentId),
    createdAt: context.startedAt,
    updatedAt: new Date().toISOString(),
  });
  await saveMapRecord(mapRecord);

  const finishedAt = new Date().toISOString();
  const datasetArtifacts = buildDatasetArtifactPaths(input.datasetKey);
  const runTrace = runTraceSchema.parse({
    runId: context.runId,
    mapId: context.mapId,
    datasetKey: input.datasetKey,
    status: "completed",
    stage: "generate",
    progressStep: "finalizing",
    styleKey: input.style,
    promptVersion: stylePreset.promptVersion,
    referenceIds: [stylePreset.referenceId],
    inputSummary,
    warnings,
    artifacts: {
      rawPath: datasetArtifacts.rawPath,
      eventsPath: datasetArtifacts.eventsPath,
      routePath: `/mock/routes/${context.mapId}.route.md`,
      posterPath,
      mapPath: `/mock/maps/${context.mapId}.view.json`,
    },
    providerMode,
    startedAt: context.startedAt,
    updatedAt: finishedAt,
    endedAt: finishedAt,
  });

  return {
    mapId: context.mapId,
    runId: context.runId,
    mapRecord,
    mapViewModel,
    runTrace,
  };
}

async function createInitialGenerateRunTrace(params: {
  input: GenerateMapInput;
  runId: string;
  mapId: string;
  startedAt: string;
}) {
  const rawDataset = await getRawDataset(params.input.datasetKey);
  const previewImagePaths = rawDataset
    ? buildPreviewImagePaths({
        rawDataset,
        selectedCommentIds: params.input.selectedCommentIds,
      })
    : [];
  const inputSummary = buildRunInputSummary({
    datasetKey: params.input.datasetKey,
    mapName: params.input.mapName,
    city: params.input.city,
    selectedCommentCount: params.input.selectedCommentIds.length,
  });
  const datasetArtifacts = buildDatasetArtifactPaths(params.input.datasetKey);

  const runTrace = runTraceSchema.parse({
    runId: params.runId,
    mapId: params.mapId,
    datasetKey: params.input.datasetKey,
    status: "running",
    stage: "generate",
    progressStep: "preparing",
    styleKey: params.input.style,
    previewImagePaths,
    generateInput: params.input,
    inputSummary,
    warnings: [],
    artifacts: {
      rawPath: datasetArtifacts.rawPath,
      eventsPath: datasetArtifacts.eventsPath,
    },
    providerMode: "live",
    startedAt: params.startedAt,
    updatedAt: params.startedAt,
  });
  await saveRunTrace(runTrace);
  return runTrace;
}

async function executeGenerateMapRun(params: {
  input: GenerateMapInput;
  runId: string;
  mapId: string;
}) {
  const initialRunTrace = await getRunTrace(params.runId);
  if (!initialRunTrace) {
    return;
  }

  try {
    const result = await generateMapDraftCore(params.input, {
      runId: params.runId,
      mapId: params.mapId,
      startedAt: initialRunTrace.startedAt,
      onProgress: (patch) => updateRunTrace(params.runId, patch),
    });

    const completedRunTrace = runTraceSchema.parse({
      ...initialRunTrace,
      ...result.runTrace,
      artifacts: {
        ...initialRunTrace.artifacts,
        ...result.runTrace.artifacts,
      },
    });
    await saveRunTrace(completedRunTrace);
  } catch (error) {
    const currentRunTrace = await getRunTrace(params.runId);
    if (!currentRunTrace) {
      return;
    }

    const failedAt = new Date().toISOString();
    await saveRunTrace(
      runTraceSchema.parse({
        ...currentRunTrace,
        status: "failed",
        errorMessage: (error as Error).message || "生成失败",
        updatedAt: failedAt,
        endedAt: failedAt,
      }),
    );
  }
}

export async function startGenerateMapRun(input: GenerateMapInput) {
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const mapId = createMapId();
  await createInitialGenerateRunTrace({
    input,
    runId,
    mapId,
    startedAt,
  });

  setTimeout(() => {
    void executeGenerateMapRun({
      input,
      runId,
      mapId,
    });
  }, 0);

  return {
    runId,
    mapId,
    waitPath: buildWaitPath(runId),
  };
}

export async function generateMapDraft(input: GenerateMapInput) {
  const startedAt = new Date().toISOString();
  const result = await generateMapDraftCore(input, {
    runId: createRunId(),
    mapId: createMapId(),
    startedAt,
  });
  await saveRunTrace(result.runTrace);

  return result;
}

export async function regenerateMapDraft(params: {
  mapRecord: MapRecord;
  events: EventRecord[];
  instruction: string;
  basedOnExistingImage: boolean;
}) {
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const warnings: string[] = [];
  let providerMode: RunTrace["providerMode"] = "live";
  const events = normalizeMapEvents(params.events);
  const stylePreset = getStylePreset(params.mapRecord.style);
  const cachedKnowledge = await getKnowledge(params.mapRecord.mapId);
  let knowledge = cachedKnowledge;
  if (!knowledge.length) {
    providerMode = "fallback";
    warnings.push("P1 已回退：当前地图缺少已缓存的城市地标，已使用本地兜底数据。");
    knowledge = getFallbackKnowledge(params.mapRecord.datasetKey);
    await saveKnowledge(params.mapRecord.mapId, knowledge);
  }

  const referenceImagePublicPaths = buildRegenerateImagePublicPaths({
    styleReferencePublicPath: stylePreset.referencePublicPath,
    existingPosterPublicPath: params.mapRecord.posterPath,
    basedOnExistingImage: params.basedOnExistingImage,
  });
  if (
    params.basedOnExistingImage &&
    !referenceImagePublicPaths.includes(params.mapRecord.posterPath)
  ) {
    warnings.push("P4 提示：当前旧底片不是 PNG/JPG/WebP，已仅使用风格参考图重绘。");
  }

  const referenceImagePaths = referenceImagePublicPaths.map((publicPath) =>
    fromPublicPath(publicPath),
  );
  const inputSummary = buildRunInputSummary({
    datasetKey: params.mapRecord.datasetKey,
    mapName: params.mapRecord.mapName,
    city: params.mapRecord.city,
    selectedCommentCount: events.length,
  });

  const routeMarkdown = createDeterministicRouteMarkdown({
    mapName: params.mapRecord.mapName,
    city: params.mapRecord.city,
    styleLabel: stylePreset.label,
    events,
    knowledge,
  });
  await saveRouteMarkdown(params.mapRecord.mapId, routeMarkdown);

  let posterPath: string;
  try {
    posterPath = await writeRegeneratedPosterFile({
      mapId: params.mapRecord.mapId,
      city: params.mapRecord.city,
      styleKey: params.mapRecord.style,
      referenceImagePaths,
      events,
      knowledge,
      instruction: params.instruction,
      basedOnExistingImage: params.basedOnExistingImage,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P4 已回退：${(error as Error).message}`);
    const svg = createFallbackPosterSvg({
      city: params.mapRecord.city,
      styleLabel: stylePreset.label,
      events,
    });
    await writeTextFile(posterOutputPath(params.mapRecord.mapId, "svg"), svg);
    posterPath = posterPublicPath(params.mapRecord.mapId, "svg");
  }

  const mapViewModel = buildMapViewModel({
    mapId: params.mapRecord.mapId,
    datasetKey: params.mapRecord.datasetKey,
    mapName: params.mapRecord.mapName,
    city: params.mapRecord.city,
    style: params.mapRecord.style,
    posterPath,
    routeMarkdown,
    events,
    knowledge,
  });
  await saveRenderedMap(params.mapRecord.mapId, mapViewModel);

  const updatedMap = mapRecordSchema.parse({
    ...params.mapRecord,
    posterPath,
    currentRunId: runId,
    lastInstruction: params.instruction,
    updatedAt: new Date().toISOString(),
  });
  await saveMapRecord(updatedMap);

  const runTrace = runTraceSchema.parse({
    runId,
    mapId: params.mapRecord.mapId,
    datasetKey: params.mapRecord.datasetKey,
    status: "completed",
    stage: "regenerate",
    basedOnExistingImage: params.basedOnExistingImage,
    promptInstruction: params.instruction,
    styleKey: params.mapRecord.style,
    promptVersion: stylePreset.promptVersion,
    referenceIds: [stylePreset.referenceId],
    inputSummary,
    warnings,
    artifacts: {
      routePath: `/mock/routes/${params.mapRecord.mapId}.route.md`,
      posterPath,
      mapPath: `/mock/maps/${params.mapRecord.mapId}.view.json`,
    },
    providerMode,
    startedAt,
    updatedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
  });
  await saveRunTrace(runTrace);

  return {
    runId,
    mapRecord: updatedMap,
    mapViewModel,
    runTrace,
  };
}
