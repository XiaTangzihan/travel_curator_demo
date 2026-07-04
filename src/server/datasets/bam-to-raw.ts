import { toCanonicalCreatedAt } from "@/src/lib/raw-created-at";
import {
  findColumnKey,
  getCellValue,
  type BamSheetSnapshot,
} from "@/src/server/datasets/bam-reader";
import { localizeAttachments } from "@/src/server/datasets/localize-attachments";

const fieldMap = {
  createdAt: "评价创建时间",
  sourceReviewId: "评价 id",
  commentText: "评价文本",
  poiName: "poi 名称",
  poiLocation: "poi 所在地址",
  poiProvince: "poi 所在省份",
  poiCity: "poi 所在城市",
  poiDistrict: "poi 所在区",
  categoryL1: "抖音后台一级新类目 name",
  categoryL2: "抖音后台二级新类目 name",
  categoryL3: "抖音后台三级新类目 name",
} as const;

export async function buildCanonicalRawSnapshot(snapshot: BamSheetSnapshot) {
  const columnKeys = Object.fromEntries(
    Object.entries(fieldMap).map(([field, headerName]) => [
      field,
      findColumnKey(snapshot.columns, headerName),
    ]),
  ) as Record<keyof typeof fieldMap, string | undefined>;

  const reviews = [];

  for (const row of snapshot.rows) {
    const sourceReviewId = getCellValue(row, columnKeys.sourceReviewId) || `${row.rowNumber}`;
    const recordId = `sheet_${snapshot.dataset.key}_${sourceReviewId}`;
    const sourceUrls = snapshot.imageColumnKeys
      .map((columnKey) => getCellValue(row, columnKey))
      .filter(Boolean);
    const attachments = await localizeAttachments({
      recordId,
      sourceUrls,
    });

    reviews.push({
      recordId,
      sourceReviewId,
      sourceRowNumber: row.rowNumber,
      createdAt: toCanonicalCreatedAt(getCellValue(row, columnKeys.createdAt)),
      commentText: getCellValue(row, columnKeys.commentText),
      poiName: getCellValue(row, columnKeys.poiName),
      poiLocation: getCellValue(row, columnKeys.poiLocation),
      poiProvince: getCellValue(row, columnKeys.poiProvince),
      poiCity: getCellValue(row, columnKeys.poiCity),
      poiDistrict: getCellValue(row, columnKeys.poiDistrict),
      categoryL1: getCellValue(row, columnKeys.categoryL1),
      categoryL2: getCellValue(row, columnKeys.categoryL2),
      categoryL3: getCellValue(row, columnKeys.categoryL3),
      attachments,
    });
  }

  return {
    datasetKey: snapshot.dataset.key,
    datasetId: snapshot.dataset.datasetId,
    authorName: snapshot.dataset.authorName,
    source: snapshot.dataset.source,
    syncedAt: new Date().toISOString(),
    reviews,
  };
}
