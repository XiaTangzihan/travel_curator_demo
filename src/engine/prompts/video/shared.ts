import type { StylePromptPreset } from "@/src/engine/prompts/shared";

export type VideoStylePromptPreset = StylePromptPreset;

export const supportedVideoDurationSeconds = [5, 7, 9] as const;

export type SupportedVideoDurationSeconds = (typeof supportedVideoDurationSeconds)[number];

export type CommonVideoPromptInput = {
  durationSeconds: number;
};

export function normalizeVideoDurationSeconds(durationSeconds: number): SupportedVideoDurationSeconds {
  if ((supportedVideoDurationSeconds as readonly number[]).includes(durationSeconds)) {
    return durationSeconds as SupportedVideoDurationSeconds;
  }

  return 5;
}

export function buildCommonVideoPrompt(params: CommonVideoPromptInput) {
  const durationSeconds = normalizeVideoDurationSeconds(params.durationSeconds);

  return [
    `基于输入的旅行地图插画生成一段 ${durationSeconds} 秒短视频。`,
    "保持原图的画风、配色、笔触、版式、路线走向、地点文字、编号、图例和装饰元素不变。",
    "所有文字必须保持清晰可读，不得改字、错字、丢字、模糊、漂移或重排。",
    "不要新增原图中不存在的大型建筑、人物、动物或交通工具，不要把插画改成写实照片、3D 渲染或广告片质感。",
    "镜头只允许极缓慢推进，必要时伴随极轻微平移，整体运动稳定柔和，不要切镜头，不要快摇，不要大幅变焦，不要闪烁，不要撕裂。",
    "路线可以有轻微流动感，水面、云朵、草木、船只、热气等环境元素可以做弱动态，但幅度必须克制。",
    "如果画面中有人物，只允许自然的小幅动作或轻微位移，不要夸张表演。",
    "生成自然环境音，优先使用风、水、船行、城市远景或生活氛围声，不要加入旁白、对白、歌词、强节奏鼓点或突兀音效。",
  ].join("\n");
}
