import {
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type Landmark,
  type MapRecord,
  type RunTrace,
} from "@/src/contracts/domain";
import {
  buildLandmarkPrompt,
  buildPosterPrompt,
  buildRegeneratePosterPrompt,
  getStylePreset,
} from "@/src/engine/prompts";
import { buildMechanicalShortName } from "@/src/engine/prompts/shared";
import { runDoubaoChat, runSeedreamImage } from "@/src/engine/providers/ark-provider";
import { preprocessDataset } from "@/src/engine/preprocess/part1";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import { createFallbackPosterSvg } from "@/src/engine/renderers/fallback-poster";
import { createDeterministicRouteMarkdown } from "@/src/engine/renderers/route-markdown";
import { createMapId, createRunId } from "@/src/lib/ids";
import {
  getEventsDataset,
  getRawDataset,
  posterOutputPath,
  posterPublicPath,
  saveEventsDataset,
  saveKnowledge,
  saveMapRecord,
  saveRenderedMap,
  saveRouteMarkdown,
  saveRunTrace,
} from "@/src/server/repositories/demo-repository";
import { writeBinaryFile, writeTextFile } from "@/src/server/utils/storage";

type GenerateMapInput = {
  mapName: string;
  city: string;
  style: string;
  selectedCommentIds?: string[];
};

function buildRunInputSummary(params: {
  mapName: string;
  city: string;
  selectedCommentCount: number;
}) {
  return {
    mapName: params.mapName,
    city: params.city,
    selectedCommentCount: params.selectedCommentCount,
  };
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

function fallbackKnowledge(city: string): Landmark[] {
  if (city !== "广州") {
    return [];
  }

  return [
    { name: "广州塔", visual: "修长塔身与夜景灯光" },
    { name: "珠江", visual: "穿城而过的江面与游船" },
    { name: "永庆坊", visual: "骑楼街巷与岭南旧城肌理" },
    { name: "白云山", visual: "城市边缘的山体与绿意" },
    { name: "沙面", visual: "欧式建筑群与树荫街道" },
    { name: "北京路", visual: "步行街与城市烟火" },
    { name: "陈家祠", visual: "岭南木雕与灰塑屋檐" },
    { name: "上下九", visual: "老广骑楼商业街" },
  ];
}

async function ensureEvents() {
  let eventsSnapshot = await getEventsDataset();
  if (eventsSnapshot) {
    return eventsSnapshot;
  }

  const rawDataset = await getRawDataset();
  if (!rawDataset) {
    throw new Error("本地原始广州数据不存在，请先执行 sync:guangzhou");
  }

  const generated = preprocessDataset(rawDataset);
  eventsSnapshot = {
    datasetId: rawDataset.datasetId,
    generatedAt: generated.report.generatedAt,
    report: generated.report,
    events: generated.events,
  };
  await saveEventsDataset(eventsSnapshot);
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
  mapName: string;
  city: string;
  styleKey: string;
  events: EventRecord[];
  knowledge: Landmark[];
  instruction?: string;
  basedOnExistingImage?: boolean;
}) {
  const prompt = buildPosterPrompt(params);
  const image = await runSeedreamImage(prompt);
  const outputPath = posterOutputPath(params.mapId, "png");
  await writeBinaryFile(outputPath, image);
  return posterPublicPath(params.mapId, "png");
}

async function writeRegeneratedPosterFile(params: {
  mapId: string;
  mapName: string;
  city: string;
  styleKey: string;
  events: EventRecord[];
  knowledge: Landmark[];
  instruction: string;
  basedOnExistingImage: boolean;
}) {
  const prompt = buildRegeneratePosterPrompt(params);
  const image = await runSeedreamImage(prompt);
  const outputPath = posterOutputPath(params.mapId, "png");
  await writeBinaryFile(outputPath, image);
  return posterPublicPath(params.mapId, "png");
}

export async function generateMapDraft(input: GenerateMapInput) {
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const mapId = createMapId();
  const warnings: string[] = [];
  let providerMode: RunTrace["providerMode"] = "live";

  const eventsSnapshot = await ensureEvents();
  const selectedEvents = normalizeMapEvents(
    eventsSnapshot.events.filter((event) =>
      input.selectedCommentIds?.length
        ? input.selectedCommentIds.includes(event.commentId)
        : true,
    ),
  );

  if (!selectedEvents.length) {
    throw new Error("没有可用于生成地图的事件");
  }

  const stylePreset = getStylePreset(input.style);
  const inputSummary = buildRunInputSummary({
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
    knowledge = fallbackKnowledge(input.city);
  }

  const routeMarkdown = createDeterministicRouteMarkdown({
    mapName: input.mapName,
    city: input.city,
    styleLabel: stylePreset.label,
    events: selectedEvents,
    knowledge,
  });

  const routePath = await saveRouteMarkdown(mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(mapId, knowledge);

  let posterPath: string;
  try {
    posterPath = await writePosterFile({
      mapId,
      mapName: input.mapName,
      city: input.city,
      styleKey: input.style,
      events: selectedEvents,
      knowledge,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P3 已回退：${(error as Error).message}`);
    const svg = createFallbackPosterSvg({
      mapName: input.mapName,
      city: input.city,
      styleLabel: stylePreset.label,
      events: selectedEvents,
    });
    await writeTextFile(posterOutputPath(mapId, "svg"), svg);
    posterPath = posterPublicPath(mapId, "svg");
  }

  const mapViewModel = buildMapViewModel({
    mapId,
    mapName: input.mapName,
    city: input.city,
    style: input.style,
    posterPath,
    routeMarkdown,
    events: selectedEvents,
    knowledge,
  });
  await saveRenderedMap(mapId, mapViewModel);

  const mapRecord: MapRecord = mapRecordSchema.parse({
    mapId,
    mapName: input.mapName,
    city: input.city,
    style: input.style,
    status: "draft",
    eventCount: selectedEvents.length,
    routePath,
    posterPath,
    knowledgePath,
    currentRunId: runId,
    selectedCommentIds: selectedEvents.map((event) => event.commentId),
    createdAt: startedAt,
    updatedAt: new Date().toISOString(),
  });
  await saveMapRecord(mapRecord);

  const runTrace = runTraceSchema.parse({
    runId,
    mapId,
    status: "completed",
    stage: "generate",
    styleKey: input.style,
    inputSummary,
    warnings,
    artifacts: {
      rawPath: "/mock/raw/guangzhou.raw.json",
      eventsPath: "/mock/events/guangzhou.events.json",
      routePath: `/mock/routes/${mapId}.route.md`,
      posterPath,
      mapPath: `/mock/maps/${mapId}.view.json`,
    },
    providerMode,
    startedAt,
    endedAt: new Date().toISOString(),
  });
  await saveRunTrace(runTrace);

  return {
    mapId,
    runId,
    mapRecord,
    mapViewModel,
    runTrace,
  };
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
  const knowledge = fallbackKnowledge(params.mapRecord.city);
  const events = normalizeMapEvents(params.events);
  const stylePreset = getStylePreset(params.mapRecord.style);
  const inputSummary = buildRunInputSummary({
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
      mapName: params.mapRecord.mapName,
      city: params.mapRecord.city,
      styleKey: params.mapRecord.style,
      events,
      knowledge,
      instruction: params.instruction,
      basedOnExistingImage: params.basedOnExistingImage,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P4 已回退：${(error as Error).message}`);
    const svg = createFallbackPosterSvg({
      mapName: params.mapRecord.mapName,
      city: params.mapRecord.city,
      styleLabel: stylePreset.label,
      events,
    });
    await writeTextFile(posterOutputPath(params.mapRecord.mapId, "svg"), svg);
    posterPath = posterPublicPath(params.mapRecord.mapId, "svg");
  }

  const mapViewModel = buildMapViewModel({
    mapId: params.mapRecord.mapId,
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
    status: "completed",
    stage: "regenerate",
    basedOnExistingImage: params.basedOnExistingImage,
    promptInstruction: params.instruction,
    styleKey: params.mapRecord.style,
    inputSummary,
    warnings,
    artifacts: {
      routePath: `/mock/routes/${params.mapRecord.mapId}.route.md`,
      posterPath,
      mapPath: `/mock/maps/${params.mapRecord.mapId}.view.json`,
    },
    providerMode,
    startedAt,
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
