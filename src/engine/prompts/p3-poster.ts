import type { EventRecord, Landmark } from "@/src/contracts/domain";
import { buildMechanicalShortName, commonPosterPrompt } from "@/src/engine/prompts/shared";
import { getStylePreset } from "@/src/engine/prompts/styles";

export type PosterPromptInput = {
  mapName: string;
  city: string;
  styleKey: string;
  events: EventRecord[];
  knowledge: Landmark[];
  instruction?: string;
  basedOnExistingImage?: boolean;
};

function canonicalName(event: EventRecord) {
  return event.canonicalName?.trim() || event.poiName.trim();
}

function displayName(event: EventRecord) {
  return event.shortName?.trim() || buildMechanicalShortName(canonicalName(event));
}

export function buildPosterPrompt(params: PosterPromptInput) {
  const stylePreset = getStylePreset(params.styleKey);
  const pointOrder = params.events
    .map((event, index) => `${event.sequence ?? index + 1}. ${displayName(event)}`)
    .join("；");
  const pointNameRules = params.events
    .map(
      (event, index) =>
        `${event.sequence ?? index + 1}号点展示名「${displayName(event)}」对应原名「${canonicalName(event)}」`,
    )
    .join("；");
  const base = [
    commonPosterPrompt,
    `风格：${stylePreset.label}`,
    stylePreset.prompt,
    `城市：${params.city}`,
    `地图名称：${params.mapName}`,
    `路线点位顺序：${pointOrder}`,
    `名称约束：${pointNameRules}；画面只能使用给定展示名或其等价字符截断版，禁止改写为新的概念名称。`,
    `背景地标视觉参考：${params.knowledge
      .slice(0, 6)
      .map((item) => item.visual)
      .join("；")}`,
    "路线节点必须按给定顺序连续编号，禁止重排、跳号、合并或交换顺序。",
    "画面中不要出现任何时间信息、日期、时分秒或时间戳。",
    "AI 补充地标只作为背景图形参考，不要输出这些地标的名字文字。",
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
