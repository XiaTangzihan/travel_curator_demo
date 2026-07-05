import {
  type GenerateRunInput,
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type ImageModel,
  type Landmark,
  type MapRecord,
  type ParsedRoute,
  type PosterVersion,
  type RawDatasetSnapshot,
  type RunTrace,
} from "@/src/contracts/domain";
import { getDemoDataset } from "@/src/config/demo";
import { resolveRequestedImageModel } from "@/src/config/image-models";
import {
  buildEventVisualBriefPrompt,
  buildLandmarkPrompt,
  buildPosterPrompt,
  buildRegeneratePosterPrompt,
  getStylePreset,
  parseEventVisualBriefs,
} from "@/src/engine/prompts";
import { resolveShortName } from "@/src/lib/short-name";
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
  getRenderedMap,
  getRouteMarkdown,
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
import {
  deleteFilePaths,
  fromPublicPath,
  writeBinaryFile,
  writeTextFile,
} from "@/src/server/utils/storage";
import { parseRouteMarkdown } from "@/src/engine/parsers/route-markdown";

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

function normalizeGenerateMapInput(input: GenerateMapInput): GenerateMapInput {
  return {
    ...input,
    imageModel: resolveRequestedImageModel(input.imageModel),
  };
}

function buildPosterVersion(params: {
  versionId: string;
  posterPath: string;
  runId: string;
  imageModel?: ImageModel;
  createdAt: string;
  instruction?: string;
  basedOnExistingImage?: boolean;
}): PosterVersion {
  return {
    versionId: params.versionId,
    posterPath: params.posterPath,
    runId: params.runId,
    imageModel: params.imageModel ?? "unknown",
    createdAt: params.createdAt,
    instruction: params.instruction,
    basedOnExistingImage: params.basedOnExistingImage,
  };
}

function ensurePosterVersions(mapRecord: MapRecord): PosterVersion[] {
  if (mapRecord.posterVersions.length) {
    return mapRecord.posterVersions;
  }

  return [
    buildPosterVersion({
      versionId: mapRecord.currentRunId || "initial",
      posterPath: mapRecord.posterPath,
      runId: mapRecord.currentRunId || "initial",
      imageModel: mapRecord.imageModel,
      createdAt: mapRecord.updatedAt || mapRecord.createdAt,
      instruction: mapRecord.lastInstruction,
    }),
  ];
}

function resolveSelectedPosterVersion(params: {
  mapRecord: MapRecord;
  posterVersions: PosterVersion[];
}) {
  return (
    params.posterVersions.find((version) => version.versionId === params.mapRecord.selectedPosterVersionId) ??
    params.posterVersions.find((version) => version.posterPath === params.mapRecord.posterPath) ??
    params.posterVersions.at(-1) ??
    null
  );
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
    const shortName = resolveShortName({
      canonicalName,
      candidate: event.shortName,
    });

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

async function generateEventVisualBriefs(params: {
  styleLabel: string;
  events: EventRecord[];
}) {
  const prompt = buildEventVisualBriefPrompt(params);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const content = await runDoubaoChat(
        [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        0.2,
      );
      const briefs = parseEventVisualBriefs(content);

      if (briefs.length !== params.events.length) {
        throw new Error("event visual brief 数量与输入事件数量不一致");
      }

      return params.events.map((event, index) => {
        const canonicalName = event.canonicalName?.trim() || event.poiName.trim();

        return {
          ...event,
          canonicalName,
          shortName: resolveShortName({
            canonicalName,
            candidate: briefs[index].shortName,
          }),
          subject: briefs[index].subject,
          avoid: briefs[index].avoid,
        };
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`${error}`);
      if (attempt >= 2) {
        break;
      }
    }
  }

  throw new Error(`P2 失败（已重试 1 次）：${lastError?.message ?? "未知错误"}`);
}

async function writePosterFile(params: {
  mapId: string;
  styleKey: string;
  imageModel: ImageModel;
  referenceImagePaths: string[];
  parsedRoute: ParsedRoute;
  knowledge: Landmark[];
  instruction?: string;
  basedOnExistingImage?: boolean;
}) {
  const prompt = buildPosterPrompt({
    styleKey: params.styleKey,
    route: params.parsedRoute,
    knowledge: params.knowledge,
    instruction: params.instruction,
    basedOnExistingImage: params.basedOnExistingImage,
  });
  const image = await runSeedreamImage({
    prompt,
    images: params.referenceImagePaths,
    imageModel: params.imageModel === "unknown" ? undefined : params.imageModel,
  });
  const outputPath = posterOutputPath(params.mapId, "png");
  await writeBinaryFile(outputPath, image);
  return posterPublicPath(params.mapId, "png");
}

async function writeRegeneratedPosterFile(params: {
  mapId: string;
  runId: string;
  styleKey: string;
  imageModel: ImageModel;
  referenceImagePaths: string[];
  parsedRoute: ParsedRoute;
  knowledge: Landmark[];
  instruction: string;
  basedOnExistingImage: boolean;
}) {
  const prompt = buildRegeneratePosterPrompt({
    styleKey: params.styleKey,
    route: params.parsedRoute,
    knowledge: params.knowledge,
    instruction: params.instruction,
    basedOnExistingImage: params.basedOnExistingImage,
  });
  const image = await runSeedreamImage({
    prompt,
    images: params.referenceImagePaths,
    imageModel: params.imageModel === "unknown" ? undefined : params.imageModel,
  });
  const outputPath = posterOutputPath(params.mapId, "png", params.runId);
  await writeBinaryFile(outputPath, image);
  return posterPublicPath(params.mapId, "png", params.runId);
}

async function generateMapDraftCore(
  input: GenerateMapInput,
  context: GenerateMapExecutionContext,
) {
  const warnings: string[] = [];
  let providerMode: RunTrace["providerMode"] = "live";
  const imageModel = resolveRequestedImageModel(input.imageModel);

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
  const selectedEventsWithVisualBriefs = await generateEventVisualBriefs({
    styleLabel: stylePreset.label,
    events: selectedEvents,
  });
  const inputSummary = buildRunInputSummary({
    datasetKey: input.datasetKey,
    mapName: input.mapName,
    city: input.city,
    selectedCommentCount: selectedEventsWithVisualBriefs.length,
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
    events: selectedEventsWithVisualBriefs,
    knowledge,
  });
  const parsedRoute = parseRouteMarkdown(routeMarkdown);

  const routePath = await saveRouteMarkdown(context.mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(context.mapId, knowledge);

  await context.onProgress?.({
    progressStep: "rendering",
  });

  let posterPath: string;
  try {
    posterPath = await writePosterFile({
      mapId: context.mapId,
      styleKey: input.style,
      imageModel,
      referenceImagePaths,
      parsedRoute,
      knowledge,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P3 已回退：${(error as Error).message}`);
    const svg = createFallbackPosterSvg({
      city: input.city,
      styleLabel: stylePreset.label,
      events: selectedEventsWithVisualBriefs,
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
    imageModel,
    posterPath,
    routeMarkdown,
    events: selectedEventsWithVisualBriefs,
    knowledge,
  });
  await saveRenderedMap(context.mapId, mapViewModel);

  const mapRecord: MapRecord = mapRecordSchema.parse({
    mapId: context.mapId,
    datasetKey: input.datasetKey,
    mapName: input.mapName,
    city: input.city,
    style: input.style,
    imageModel,
    status: "draft",
    eventCount: selectedEvents.length,
    routePath,
    posterPath,
    knowledgePath,
    currentRunId: context.runId,
    posterVersions: [
      buildPosterVersion({
        versionId: context.runId,
        posterPath,
        runId: context.runId,
        imageModel,
        createdAt: context.startedAt,
      }),
    ],
    selectedPosterVersionId: context.runId,
    selectedCommentIds: selectedEventsWithVisualBriefs.map((event) => event.commentId),
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
    imageModel,
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
    imageModel: resolveRequestedImageModel(params.input.imageModel),
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
  const normalizedInput = normalizeGenerateMapInput(input);
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const mapId = createMapId();
  await createInitialGenerateRunTrace({
    input: normalizedInput,
    runId,
    mapId,
    startedAt,
  });

  setTimeout(() => {
    void executeGenerateMapRun({
      input: normalizedInput,
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
  const normalizedInput = normalizeGenerateMapInput(input);
  const startedAt = new Date().toISOString();
  const result = await generateMapDraftCore(normalizedInput, {
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
  imageModel?: GenerateMapInput["imageModel"];
}) {
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const warnings: string[] = [];
  let providerMode: RunTrace["providerMode"] = "live";
  const imageModel = resolveRequestedImageModel(params.imageModel ?? params.mapRecord.imageModel);
  const events = normalizeMapEvents(params.events);
  const stylePreset = getStylePreset(params.mapRecord.style);
  const normalizedInstruction = params.instruction.trim();
  const effectiveBasedOnExistingImage = normalizedInstruction
    ? params.basedOnExistingImage
    : false;
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
    basedOnExistingImage: effectiveBasedOnExistingImage,
  });
  if (
    effectiveBasedOnExistingImage &&
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

  const routeMarkdown = await getRouteMarkdown(params.mapRecord.mapId);
  if (!routeMarkdown) {
    throw new Error("当前地图缺少 route.md，无法执行 route-driven 重生成");
  }
  const parsedRoute = parseRouteMarkdown(routeMarkdown);

  let posterPath: string;
  try {
    posterPath = await writeRegeneratedPosterFile({
      mapId: params.mapRecord.mapId,
      runId,
      styleKey: params.mapRecord.style,
      imageModel,
      referenceImagePaths,
      parsedRoute,
      knowledge,
      instruction: normalizedInstruction,
      basedOnExistingImage: effectiveBasedOnExistingImage,
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
    imageModel,
    posterPath,
    routeMarkdown,
    events,
    knowledge,
  });
  await saveRenderedMap(params.mapRecord.mapId, mapViewModel);

  const updatedMap = mapRecordSchema.parse({
    ...params.mapRecord,
    imageModel,
    posterVersions: [
      ...ensurePosterVersions(params.mapRecord),
      buildPosterVersion({
        versionId: runId,
        posterPath,
        runId,
        imageModel,
        createdAt: startedAt,
        instruction: normalizedInstruction || undefined,
        basedOnExistingImage: normalizedInstruction ? effectiveBasedOnExistingImage : undefined,
      }),
    ],
    selectedPosterVersionId: runId,
    posterPath,
    currentRunId: runId,
    lastInstruction: normalizedInstruction,
    updatedAt: new Date().toISOString(),
  });
  await saveMapRecord(updatedMap);

  const runTrace = runTraceSchema.parse({
    runId,
    mapId: params.mapRecord.mapId,
    datasetKey: params.mapRecord.datasetKey,
    status: "completed",
    stage: "regenerate",
    imageModel,
    basedOnExistingImage: effectiveBasedOnExistingImage,
    promptInstruction: normalizedInstruction,
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

export async function selectMapPosterVersion(params: { mapRecord: MapRecord; versionId: string }) {
  const posterVersions = ensurePosterVersions(params.mapRecord);
  const selectedVersion = posterVersions.find((version) => version.versionId === params.versionId);
  if (!selectedVersion) {
    throw new Error("指定的海报版本不存在");
  }
  const renderedMap = await getRenderedMap(params.mapRecord.mapId);
  if (!renderedMap) {
    throw new Error("当前地图视图不存在，无法切换海报版本");
  }

  const nextMapRecord = mapRecordSchema.parse({
    ...params.mapRecord,
    posterVersions,
    selectedPosterVersionId: selectedVersion.versionId,
    posterPath: selectedVersion.posterPath,
    currentRunId: selectedVersion.runId,
    imageModel: selectedVersion.imageModel,
    updatedAt: new Date().toISOString(),
  });
  await saveMapRecord(nextMapRecord);

  const nextMapViewModel = {
    ...renderedMap,
    imageModel: selectedVersion.imageModel,
    posterPath: selectedVersion.posterPath,
    generatedAt: new Date().toISOString(),
  };
  await saveRenderedMap(params.mapRecord.mapId, nextMapViewModel);

  return {
    mapRecord: nextMapRecord,
    mapViewModel: nextMapViewModel,
  };
}

export async function prunePosterVersionsForConfirm(params: { mapRecord: MapRecord }) {
  const posterVersions = ensurePosterVersions(params.mapRecord);
  const selectedVersion = resolveSelectedPosterVersion({
    mapRecord: params.mapRecord,
    posterVersions,
  });
  if (!selectedVersion) {
    throw new Error("当前没有可确认的海报版本");
  }

  const discardedPaths = posterVersions
    .filter((version) => version.versionId !== selectedVersion.versionId)
    .map((version) => fromPublicPath(version.posterPath))
    .filter((filePath, index, list) => list.indexOf(filePath) === index);
  if (discardedPaths.length) {
    await deleteFilePaths(discardedPaths);
  }

  const renderedMap = await getRenderedMap(params.mapRecord.mapId);
  const nextMapRecord = mapRecordSchema.parse({
    ...params.mapRecord,
    posterVersions: [selectedVersion],
    selectedPosterVersionId: selectedVersion.versionId,
    posterPath: selectedVersion.posterPath,
    currentRunId: selectedVersion.runId,
    imageModel: selectedVersion.imageModel,
    updatedAt: new Date().toISOString(),
  });
  await saveMapRecord(nextMapRecord);

  if (renderedMap) {
    await saveRenderedMap(params.mapRecord.mapId, {
      ...renderedMap,
      imageModel: selectedVersion.imageModel,
      posterPath: selectedVersion.posterPath,
      generatedAt: new Date().toISOString(),
    });
  }

  return nextMapRecord;
}
