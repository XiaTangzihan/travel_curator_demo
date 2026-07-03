export const datasetRegistry = {
  guangzhou: {
    datasetKey: "guangzhou",
    datasetId: "guangzhou-golden",
    authorName: "旅行者小夏",
    city: "广州",
    rawFileName: "guangzhou.raw.json",
    eventsFileName: "guangzhou.events.json",
    source: {
      type: "base",
      baseToken: "Qkj4bs0zoawVfxsiqZuczylCnSy",
      tableId: "tblriXmgzeiEEp56",
      viewId: "vewOamfc7D",
    },
  },
  hangzhou: {
    datasetKey: "hangzhou",
    datasetId: "hangzhou-bam",
    authorName: "旅行者小夏",
    city: "杭州",
    rawFileName: "hangzhou.raw.json",
    eventsFileName: "hangzhou.events.json",
    source: {
      type: "sheet",
      spreadsheetToken: "L9BrskJM3hPcpwt3jeFcylSpnWh",
      sheetId: "4ARbMs",
      sheetName: "【BAM规范】杭州市",
      url: "https://bytedance.larkoffice.com/sheets/L9BrskJM3hPcpwt3jeFcylSpnWh?sheet=4ARbMs",
    },
  },
};

export function getDatasetConfig(datasetKey) {
  const resolvedKey = datasetKey && datasetRegistry[datasetKey] ? datasetKey : "hangzhou";
  return datasetRegistry[resolvedKey];
}
