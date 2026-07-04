export const demoConfig = {
  defaultDatasetKey: "hangzhou",
  styleLabel: "年轻卡通风",
  styleKey: "young-cartoon",
  datasets: {
    guangzhou: {
      datasetId: "guangzhou-golden",
      authorName: "旅行者小夏",
      city: "广州",
      defaultMapName: "广州两日行",
      rawFileName: "guangzhou.raw.json",
      eventsFileName: "guangzhou.events.json",
    },
    hangzhou: {
      datasetId: "hangzhou-bam",
      authorName: "旅行者小夏",
      city: "杭州",
      defaultMapName: "杭州一日漫游",
      rawFileName: "hangzhou.raw.json",
      eventsFileName: "hangzhou.events.json",
    },
  },
} as const;

export type DemoDatasetKey = keyof typeof demoConfig.datasets;

export const supportedDatasetKeys = Object.keys(demoConfig.datasets) as DemoDatasetKey[];

export function resolveDatasetKey(datasetKey?: string | null) {
  if (datasetKey && datasetKey in demoConfig.datasets) {
    return datasetKey as DemoDatasetKey;
  }

  return demoConfig.defaultDatasetKey;
}

export function getDemoDataset(datasetKey?: string | null) {
  const key = resolveDatasetKey(datasetKey);
  return {
    key,
    ...demoConfig.datasets[key],
  };
}

export const designTokens = {
  ink: "#16202A",
  paper: "#F7F1E3",
  surface: "#FFFDF8",
  blue: "#173F7A",
  cyan: "#74D7F7",
  orange: "#FF7A45",
} as const;
