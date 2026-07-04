import {
  type EventRecord,
  type PreprocessReport,
  type RawDatasetSnapshot,
} from "@/src/contracts/domain";
import {
  formatCreatedAtDay,
  formatCreatedAtTime,
  parseRawCreatedAt,
} from "@/src/lib/raw-created-at";

function normalizeText(value: string | undefined) {
  return (value ?? "").trim();
}

function hasVisualContent(pictureCount: number, commentText: string) {
  return pictureCount > 0 || commentText.length > 0;
}

function compareCreatedAt(left: string, right: string) {
  const leftDate = parseRawCreatedAt(left);
  const rightDate = parseRawCreatedAt(right);

  if (!leftDate || !rightDate) {
    return left.localeCompare(right);
  }

  return leftDate.getTime() - rightDate.getTime();
}

export function preprocessDataset(
  snapshot: RawDatasetSnapshot,
): { events: EventRecord[]; report: PreprocessReport } {
  const warnings: string[] = [];

  const sortedReviews = [...snapshot.reviews].sort((left, right) =>
    compareCreatedAt(left.createdAt, right.createdAt),
  );

  const events: EventRecord[] = [];

  for (const [index, review] of sortedReviews.entries()) {
    const createdAt = parseRawCreatedAt(review.createdAt);
    if (!createdAt) {
      warnings.push(`跳过记录 ${review.recordId}：评价创建时间无法解析`);
      continue;
    }

    const commentText = normalizeText(review.commentText);
    if (!review.poiName.trim() || !review.poiLocation.trim()) {
      warnings.push(`跳过记录 ${review.recordId}：POI 名称或地址缺失`);
      continue;
    }

    if (!hasVisualContent(review.attachments.length, commentText)) {
      warnings.push(`跳过记录 ${review.recordId}：文字与图片同时为空`);
      continue;
    }

    events.push({
      eventId: `evt_${`${index + 1}`.padStart(3, "0")}`,
      commentId: review.recordId,
      day: formatCreatedAtDay(review.createdAt),
      time: formatCreatedAtTime(review.createdAt, true),
      commentText,
      commentPictures: review.attachments.map((attachment) => ({
        url: attachment.publicPath,
        name: attachment.name,
      })),
      poiName: review.poiName.trim(),
      poiLocation: review.poiLocation.trim(),
      poiProvince: review.poiProvince.trim(),
      poiCity: review.poiCity.trim(),
      poiDistrict: review.poiDistrict.trim(),
      categoryL1: review.categoryL1.trim(),
      categoryL2: review.categoryL2.trim(),
      categoryL3: review.categoryL3.trim(),
      authorName: snapshot.authorName,
    });
  }

  return {
    events,
    report: {
      totalInput: snapshot.reviews.length,
      totalOutput: events.length,
      warnings,
      generatedAt: new Date().toISOString(),
    },
  };
}
