export type StylePromptPreset = {
  key: string;
  label: string;
  description: string;
  promptVersion: string;
  prompt: string;
  previewImage: string;
  referenceId: string;
  referencePublicPath: string;
};

export const commonPosterPrompt = [
  "你是一名专业的旅行地图插画师。",
  "请绘制一张手绘风格的旅行地图。",
  "采用俯视或微等距视角，以地标建筑为锚点。",
  "用一条连续路线把各打卡点按顺序串联。",
  "每个打卡点必须呈现数字、名称和主体图标。",
  "全图视觉语言统一，信息可读，避免文字遮挡。",
].join("\n");

export function buildMechanicalShortName(name: string) {
  const stripped = name
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  const candidate = stripped || name.trim();
  const firstSegment = candidate
    .split(/[·•｜|／/]/)
    .map((segment) => segment.trim())
    .find(Boolean);

  return (firstSegment ?? candidate).slice(0, 18) || candidate.slice(0, 18);
}
