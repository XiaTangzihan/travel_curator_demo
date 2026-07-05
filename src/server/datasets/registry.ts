import { demoConfig, resolveDatasetKey, type DemoDatasetKey } from "@/src/config/demo";

export const bamDatasetRegistry = {
  guangzhou: {
    ...demoConfig.datasets.guangzhou,
    source: {
      type: "sheet" as const,
      spreadsheetToken: "L9BrskJM3hPcpwt3jeFcylSpnWh",
      sheetId: "a4gEuJ",
      sheetName: "【BAM规范】广州市",
      url: "https://bytedance.larkoffice.com/sheets/L9BrskJM3hPcpwt3jeFcylSpnWh?sheet=a4gEuJ",
      adapterVersion: "canonical-raw-v2",
    },
  },
  hangzhou: {
    ...demoConfig.datasets.hangzhou,
    source: {
      type: "sheet" as const,
      spreadsheetToken: "L9BrskJM3hPcpwt3jeFcylSpnWh",
      sheetId: "4ARbMs",
      sheetName: "【BAM规范】杭州市",
      url: "https://bytedance.larkoffice.com/sheets/L9BrskJM3hPcpwt3jeFcylSpnWh?sheet=4ARbMs",
      adapterVersion: "canonical-raw-v2",
    },
  },
  meishan: {
    ...demoConfig.datasets.meishan,
    source: {
      type: "sheet" as const,
      spreadsheetToken: "L9BrskJM3hPcpwt3jeFcylSpnWh",
      sheetId: "13mhdS",
      sheetName: "【BAM规范】眉山市",
      url: "https://bytedance.larkoffice.com/sheets/L9BrskJM3hPcpwt3jeFcylSpnWh?sheet=13mhdS",
      adapterVersion: "canonical-raw-v2",
    },
  },
} as const satisfies Record<DemoDatasetKey, unknown>;

export type BamDatasetKey = keyof typeof bamDatasetRegistry;
export type BamDatasetConfig = (typeof bamDatasetRegistry)[BamDatasetKey];

export function getBamDatasetConfig(datasetKey?: string | null) {
  const key = resolveDatasetKey(datasetKey) as BamDatasetKey;
  return {
    key,
    ...bamDatasetRegistry[key],
  };
}
