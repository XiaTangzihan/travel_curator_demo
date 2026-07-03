import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getDatasetConfig } from "./dataset-registry.mjs";

const datasetKey = process.argv[2] ?? "hangzhou";
const dataset = getDatasetConfig(datasetKey);
const rootDir = process.cwd();
const rawInput = path.join(rootDir, "public", "mock", "raw", dataset.rawFileName);
const eventsOutput = path.join(rootDir, "public", "mock", "events", dataset.eventsFileName);

mkdirSync(path.dirname(eventsOutput), { recursive: true });

function pad(value) {
  return `${value}`.padStart(2, "0");
}

function formatDay(date) {
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const rawDataset = JSON.parse(readFileSync(rawInput, "utf8"));
const warnings = [];

const reviews = [...rawDataset.reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const events = reviews
  .map((review, index) => {
    const createdAt = new Date(review.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      warnings.push(`跳过 ${review.recordId}：时间无法解析`);
      return null;
    }

    const commentText = (review.commentText ?? "").trim();
    if (!review.poiName?.trim() || !review.poiLocation?.trim()) {
      warnings.push(`跳过 ${review.recordId}：POI 信息缺失`);
      return null;
    }

    if (!commentText && !(review.attachments?.length > 0)) {
      warnings.push(`跳过 ${review.recordId}：图片与文字都为空`);
      return null;
    }

    return {
      eventId: `evt_${`${index + 1}`.padStart(3, "0")}`,
      commentId: review.recordId,
      day: formatDay(createdAt),
      time: formatTime(createdAt),
      commentText,
      commentPictures: (review.attachments ?? []).map((attachment) => ({
        url: attachment.publicPath,
        name: attachment.name,
      })),
      poiName: review.poiName.trim(),
      poiLocation: review.poiLocation.trim(),
      poiProvince: (review.poiProvince ?? "").trim(),
      poiCity: (review.poiCity ?? "").trim(),
      poiDistrict: (review.poiDistrict ?? "").trim(),
      categoryL1: (review.categoryL1 ?? "").trim(),
      categoryL2: (review.categoryL2 ?? "").trim(),
      categoryL3: (review.categoryL3 ?? "").trim(),
      authorName: rawDataset.authorName,
    };
  })
  .filter(Boolean);

const generatedAt = new Date().toISOString();
const snapshot = {
  datasetKey: rawDataset.datasetKey ?? dataset.datasetKey,
  datasetId: rawDataset.datasetId,
  generatedAt,
  report: {
    totalInput: rawDataset.reviews.length,
    totalOutput: events.length,
    warnings,
    generatedAt,
  },
  events,
};

writeFileSync(eventsOutput, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`已输出 ${eventsOutput}`);
