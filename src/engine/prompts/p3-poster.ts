import type { EventRecord, Landmark } from "@/src/contracts/domain";
import { commonPosterPrompt } from "@/src/engine/prompts/shared";
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

function safePointLabel(event: EventRecord) {
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
}

export function buildPosterPrompt(params: PosterPromptInput) {
  const stylePreset = getStylePreset(params.styleKey);
  const base = [
    commonPosterPrompt,
    `风格：${stylePreset.label}`,
    stylePreset.prompt,
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
