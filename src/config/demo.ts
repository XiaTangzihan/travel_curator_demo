export const demoConfig = {
  datasetId: "guangzhou-golden",
  authorName: "旅行者小夏",
  city: "广州",
  styleLabel: "年轻卡通",
  styleKey: "young-cartoon",
  baseToken: "Qkj4bs0zoawVfxsiqZuczylCnSy",
  tableId: "tblriXmgzeiEEp56",
  viewId: "vewOamfc7D",
  defaultMapName: "广州两日行",
} as const;

export const promptLibrary = {
  common: [
    "你是一名专业的旅行地图插画师。",
    "请绘制一张手绘风格的旅行地图。",
    "采用俯视或微等距视角，以地标建筑为锚点。",
    "用一条连续路线把各打卡点按顺序串联。",
    "每个打卡点必须呈现数字、名称和主体图标。",
    "全图视觉语言统一，信息可读，避免文字遮挡。",
  ].join("\n"),
  youngCartoon:
    "画面使用明亮饱和配色、圆润 Q 版图标、清晰描边，整体年轻、活泼、适合社交分享。",
  p1System:
    "你是一名熟悉中国城市旅行信息的助手，只能使用公开、非敏感、常识级信息。",
  p2System:
    "你是一名旅行路线编排助手。请把输入的事件按 day 和 time 组织成 route.md，严格输出 Markdown。",
} as const;

export const designTokens = {
  ink: "#16202A",
  paper: "#F7F1E3",
  surface: "#FFFDF8",
  blue: "#173F7A",
  cyan: "#74D7F7",
  orange: "#FF7A45",
} as const;
