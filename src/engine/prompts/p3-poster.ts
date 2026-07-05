import type { Landmark, ParsedRoute, ParsedRouteEvent } from "@/src/contracts/domain";
import { commonPosterPrompt } from "@/src/engine/prompts/shared";
import { getStylePreset } from "@/src/engine/prompts/styles";

export type PosterPromptInput = {
  styleKey: string;
  route: ParsedRoute;
  knowledge: Landmark[];
  instruction?: string;
  basedOnExistingImage?: boolean;
};

function displayName(event: ParsedRouteEvent) {
  return event.shortName.trim();
}

export function buildPosterPrompt(params: PosterPromptInput) {
  const stylePreset = getStylePreset(params.styleKey);
  const pointOrder = params.route.events
    .map((event) => `${event.sequence}. ${displayName(event)}`)
    .join("；");
  const pointNameRules = params.route.events
    .map((event) => `${event.sequence}号点固定展示名「${displayName(event)}」`)
    .join("；");
  const eventVisualRules = params.route.events
    .map(
      (event) =>
        `${event.sequence}号点「${displayName(event)}」画面要求：${event.subject}；避免意象：${event.avoid.join("、")}`,
    )
    .join("\n");
  const base = [
    "重要事项：",
    ...params.route.importantRules.map((rule) => `- ${rule}`),
    commonPosterPrompt,
    `风格：${stylePreset.label}`,
    stylePreset.prompt,
    `风格参考图：${stylePreset.referenceId}；参考图是 16:9 杭州示例，只用于学习画风、笔触、配色、标题装饰与版式密度。`,
    `城市：${params.route.city}`,
    `路线点位顺序：${pointOrder}`,
    `名称约束：${pointNameRules}；这些展示名已经由系统做过机械截断，画面只能使用给定展示名，禁止改写为新的概念名称；点位名称和编号只能作为节点外部标注，不能写进主体图标内部。`,
    "event 画面语义：",
    eventVisualRules,
    `背景地标视觉参考：${params.knowledge
      .slice(0, 6)
      .map((item) => item.visual)
      .join("；")}`,
    "必须依赖模型泛化能力，只迁移参考图的风格语言、版式密度与横向阅读节奏，不得复用参考图中的杭州、West Lake、Leifeng Pagoda、河坊街、钱塘江、具体点位内容、具体路径细节或任何示例文字。",
    `参考图中的左上角艺术字只用于学习标题位置、字体气质与装饰手法；若画面需要标题，左上角艺术字只能写当前目的地名称「${params.route.city}」，禁止出现地图标题、几日行、自定义测试名或任何其他自定义标题，绝不能保留杭州字样。`,
    "主路径应以左到右为主阅读轴，从 1 号点依次延伸到最后一个点；节点空间位置必须与编号阅读顺序一致。",
    "允许路径轻微上下起伏，但节点中心点横向位置必须随编号递增，不允许回头路、环形主路径或纵向堆叠成为主顺序。",
    "若 event 场景天然包含店招、菜单、路牌、电子屏或海报字样，请简化为无字形状，不要生成可读字符。",
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
