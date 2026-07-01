import {
  mapRecordSchema,
  runTraceSchema,
  type EventRecord,
  type Landmark,
  type MapRecord,
  type RunTrace,
} from "@/src/contracts/domain";
import { demoConfig, promptLibrary } from "@/src/config/demo";
import { runDoubaoChat, runSeedreamImage } from "@/src/engine/providers/ark-provider";
import { preprocessDataset } from "@/src/engine/preprocess/part1";
import { buildMapViewModel } from "@/src/engine/renderers/build-map-view-model";
import { createFallbackPosterSvg } from "@/src/engine/renderers/fallback-poster";
import { createDeterministicRouteMarkdown } from "@/src/engine/renderers/route-markdown";
import { createMapId, createRunId } from "@/src/lib/ids";
import {
  getEventsDataset,
  getRawDataset,
  getRouteMarkdown,
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
  const system = promptLibrary.p1System;
  const user = [
    `请基于公开、非敏感信息，列出 ${city} 最具代表性的地标与景点。`,
    "按知名度排序，输出 8 到 12 个。",
    '每个对象包含 name 和 visual 两个字段，严格输出 JSON 数组。',
  ].join("\n");

  const content = await runDoubaoChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    0.2,
  );

  return extractJsonArray(content);
}

async function generateRouteMarkdown(params: {
  mapName: string;
  city: string;
  styleLabel: string;
  events: EventRecord[];
}) {
  const prompt = [
    "请把下面事件列表整理成 route.md。",
    "要求：先按 day 升序，再按 time 升序；输出 YAML front matter 与 Day/Event 分层；每个 event 都要有 event标志生图提示。",
    JSON.stringify(params.events, null, 2),
  ].join("\n\n");

  return runDoubaoChat(
    [
      { role: "system", content: promptLibrary.p2System },
      { role: "user", content: prompt },
    ],
    0.2,
  );
}

function buildPosterPrompt(params: {
  mapName: string;
  city: string;
  styleLabel: string;
  events: EventRecord[];
  knowledge: Landmark[];
  instruction?: string;
  basedOnExistingImage?: boolean;
}) {
  const safePointLabel = (event: EventRecord) => {
    const name = event.poiName.replace(/\(.*?\)/g, "").trim();

    if (/(按摩|spa|足疗)/i.test(event.poiName)) {
      return "舒缓放松站";
    }

    if (/(酒吧|啤酒)/i.test(event.poiName) || /(酒吧|清吧)/.test(event.categoryL2 + event.categoryL3)) {
      return "夜间氛围站";
    }

    if (/(酒店|宾馆|万豪)/i.test(event.poiName)) {
      return "住宿休整站";
    }

    return name.slice(0, 18);
  };

  const base = [
    promptLibrary.common,
    promptLibrary.youngCartoon,
    `城市：${params.city}`,
    `地图名称：${params.mapName}`,
    `路线点位：${params.events
      .map((event, index) => `${index + 1}. ${safePointLabel(event)} / ${event.time}`)
      .join("；")}`,
    `城市地标参考：${params.knowledge
      .slice(0, 6)
      .map((item) => `${item.name}（${item.visual}）`)
      .join("；")}`,
    "不要在画面中输出可能触发内容审核的成人或酒精字样；若存在此类点位，请用中性旅行标签表达。",
  ];

  if (params.instruction) {
    base.push(
      params.basedOnExistingImage
        ? `请尽量保留原有整体构图，只按这条意见调整：${params.instruction}`
        : `请按这条意见重新组织画面：${params.instruction}`,
    );
  }

  return base.join("\n");
}

async function writePosterFile(params: {
  mapId: string;
  mapName: string;
  city: string;
  styleLabel: string;
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

export async function generateMapDraft(input: GenerateMapInput) {
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const mapId = createMapId();
  const warnings: string[] = [];
  let providerMode: RunTrace["providerMode"] = "live";

  const eventsSnapshot = await ensureEvents();
  const selectedEvents = eventsSnapshot.events.filter((event) =>
    input.selectedCommentIds?.length
      ? input.selectedCommentIds.includes(event.commentId)
      : true,
  );

  if (!selectedEvents.length) {
    throw new Error("没有可用于生成地图的事件");
  }

  let knowledge: Landmark[];
  try {
    knowledge = await generateKnowledge(input.city);
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P1 已回退：${(error as Error).message}`);
    knowledge = fallbackKnowledge(input.city);
  }

  let routeMarkdown: string;
  try {
    routeMarkdown = await generateRouteMarkdown({
      mapName: input.mapName,
      city: input.city,
      styleLabel: demoConfig.styleLabel,
      events: selectedEvents,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P2 已回退：${(error as Error).message}`);
    routeMarkdown = createDeterministicRouteMarkdown({
      mapName: input.mapName,
      city: input.city,
      styleLabel: demoConfig.styleLabel,
      events: selectedEvents,
      knowledge,
    });
  }

  const routePath = await saveRouteMarkdown(mapId, routeMarkdown);
  const knowledgePath = await saveKnowledge(mapId, knowledge);

  let posterPath: string;
  try {
    posterPath = await writePosterFile({
      mapId,
      mapName: input.mapName,
      city: input.city,
      styleLabel: demoConfig.styleLabel,
      events: selectedEvents,
      knowledge,
    });
  } catch (error) {
    providerMode = "fallback";
    warnings.push(`P3 已回退：${(error as Error).message}`);
    const svg = createFallbackPosterSvg({
      mapName: input.mapName,
      city: input.city,
      styleLabel: demoConfig.styleLabel,
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

  const routeMarkdown =
    (await getRouteMarkdown(params.mapRecord.mapId)) ??
    createDeterministicRouteMarkdown({
      mapName: params.mapRecord.mapName,
      city: params.mapRecord.city,
      styleLabel: demoConfig.styleLabel,
      events: params.events,
      knowledge,
    });

  let posterPath: string;
  try {
    posterPath = await writePosterFile({
      mapId: params.mapRecord.mapId,
      mapName: params.mapRecord.mapName,
      city: params.mapRecord.city,
      styleLabel: demoConfig.styleLabel,
      events: params.events,
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
      styleLabel: demoConfig.styleLabel,
      events: params.events,
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
    events: params.events,
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
