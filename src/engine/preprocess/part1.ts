import {
  type EventRecord,
  type PreprocessReport,
  type RawDatasetSnapshot,
} from "@/src/contracts/domain";

function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

function formatDay(date: Date) {
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())}`;
}

function formatTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim();
}

function hasVisualContent(pictureCount: number, commentText: string) {
  return pictureCount > 0 || commentText.length > 0;
}

export function preprocessDataset(
  snapshot: RawDatasetSnapshot,
): { events: EventRecord[]; report: PreprocessReport } {
  const warnings: string[] = [];

  const sortedReviews = [...snapshot.reviews].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  const events: EventRecord[] = [];

  for (const [index, review] of sortedReviews.entries()) {
    const createdAt = new Date(review.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
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

    const day = formatDay(createdAt);
    const time = formatTime(createdAt);

    if (review.sourceDay && review.sourceDay !== day) {
      warnings.push(`记录 ${review.recordId}：拆分 day(${day}) 与源字段(${review.sourceDay}) 不一致`);
    }

    if (review.sourceTime && !time.startsWith(review.sourceTime)) {
      warnings.push(`记录 ${review.recordId}：拆分 time(${time}) 与源字段(${review.sourceTime}) 不一致`);
    }

    events.push({
      eventId: `evt_${pad(index + 1).padStart(3, "0")}`,
      commentId: review.recordId,
      day,
      time,
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
