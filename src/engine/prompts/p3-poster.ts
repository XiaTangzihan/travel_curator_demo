import type { EventRecord, Landmark } from "@/src/contracts/domain";
import { buildMechanicalShortName, commonPosterPrompt } from "@/src/engine/prompts/shared";
import { getStylePreset } from "@/src/engine/prompts/styles";

export type PosterPromptInput = {
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
      (event, index) => `${event.sequence ?? index + 1}号点固定展示名「${displayName(event)}」`,
    )
    .join("；");
  const base = [
    commonPosterPrompt,
    `风格：${stylePreset.label}`,
    stylePreset.prompt,
    `风格参考图：${stylePreset.referenceId}；参考图是 16:9 杭州示例，只用于学习画风、笔触、配色、标题装饰与版式密度。`,
    `城市：${params.city}`,
    `路线点位顺序：${pointOrder}`,
    `名称约束：${pointNameRules}；这些展示名已经由系统做过机械截断，画面只能使用给定展示名，禁止改写为新的概念名称。`,
    `背景地标视觉参考：${params.knowledge
      .slice(0, 6)
      .map((item) => item.visual)
      .join("；")}`,
    "必须依赖模型泛化能力，只迁移参考图的风格语言，不得复用参考图中的杭州、West Lake、Leifeng Pagoda、河坊街、钱塘江、路线编号、地图布局或任何示例文字。",
    `参考图中的左上角艺术字只用于学习标题位置、字体气质与装饰手法；若画面需要标题，左上角艺术字只能写当前目的地名称「${params.city}」，禁止出现地图标题、几日行、自定义测试名或任何其他自定义标题，绝不能保留杭州字样。`,
    "路线节点必须按给定顺序连续编号，禁止重排、跳号、合并或交换顺序。",
    "画面中不要出现任何时间信息、日期、时分秒或时间戳。",
    "AI 补充地标只作为背景图形参考，不要输出这些地标的名字文字。",
    "对容易触发审核的地点，只保留当前给定展示名，不要补充额外的场景解释或延伸描述。",
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
