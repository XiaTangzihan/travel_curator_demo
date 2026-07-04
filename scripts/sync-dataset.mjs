import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDatasetConfig } from "./dataset-registry.mjs";

const datasetKey = process.argv[2] ?? "hangzhou";
const dataset = getDatasetConfig(datasetKey);
const larkCliPath =
  process.env.LARK_CLI_PATH ?? "C:/Users/Admin/AppData/Roaming/npm/lark-cli.cmd";
const rootDir = process.cwd();
const commentsDir = path.join(rootDir, "public", "mock", "files", "comments");
const rawOutput = path.join(rootDir, "public", "mock", "raw", dataset.rawFileName);

mkdirSync(commentsDir, { recursive: true });
mkdirSync(path.dirname(rawOutput), { recursive: true });

function runLark(args) {
  const command = [larkCliPath, ...args]
    .map((arg) => `"${String(arg).replaceAll('"', '\\"')}"`)
    .join(" ");
  const output = execSync(command, {
    cwd: rootDir,
    encoding: "utf8",
    shell: true,
  });
  return JSON.parse(output);
}

function pad(value) {
  return `${value}`.padStart(2, "0");
}

function normalizeCreatedAt(value) {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) {
    return "";
  }

  function formatIso(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+08:00`;
  }

  if (/^\d{10}$/.test(trimmed)) {
    const date = new Date(Number(trimmed) * 1000);
    return formatIso(date);
  }

  if (/^\d{13}$/.test(trimmed)) {
    const date = new Date(Number(trimmed));
    return formatIso(date);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.replace(" ", "T") + ":00+08:00";
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.replace(" ", "T") + "+08:00";
  }

  return trimmed;
}

async function buildSheetAttachment(recordId, url, attachmentIndex) {
  const cleanUrl = `${url ?? ""}`.trim();
  if (!cleanUrl) {
    return null;
  }

  const normalizedUrl = cleanUrl.replace(/\\u0026/g, "&");
  const extensionMatch = normalizedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : ".jpeg";
  const fileName = `${recordId}_${attachmentIndex + 1}${extension}`;
  const relativeOutput = path
    .join("public", "mock", "files", "comments", fileName)
    .split(path.sep)
    .join("/");
  const absoluteOutput = path.join(rootDir, relativeOutput);

  let size;
  if (!existsSync(absoluteOutput)) {
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(absoluteOutput, buffer);
    size = buffer.length;
  }

  return {
    sourceUrl: normalizedUrl,
    name: fileName,
    size,
    localPath: relativeOutput,
    publicPath: `/${relativeOutput.split(path.sep).join("/").replace(/^public\//, "")}`,
  };
}

function syncFromBase() {
  const payload = runLark([
    "base",
    "+record-list",
    "--as",
    "user",
    "--base-token",
    dataset.source.baseToken,
    "--table-id",
    dataset.source.tableId,
    "--view-id",
    dataset.source.viewId,
    "--limit",
    "50",
    "--format",
    "json",
  ]);

  const fields = payload.data.fields;
  const records = payload.data.data;
  const recordIds = payload.data.record_id_list;

  return records.map((row, index) => {
    const recordId = recordIds[index];
    const byField = Object.fromEntries(fields.map((field, fieldIndex) => [field, row[fieldIndex]]));
    const attachments = Array.isArray(byField["原图"]) ? byField["原图"] : [];

    const syncedAttachments = attachments.map((attachment, attachmentIndex) => {
      const extension = path.extname(attachment.name).toLowerCase() || ".jpg";
      const relativeOutput = path
        .join("public", "mock", "files", "comments", `${recordId}_${attachmentIndex + 1}${extension}`)
        .split(path.sep)
        .join("/");
      const absoluteOutput = path.join(rootDir, relativeOutput);

      if (!existsSync(absoluteOutput)) {
        runLark([
          "base",
          "+record-download-attachment",
          "--as",
          "user",
          "--base-token",
          dataset.source.baseToken,
          "--table-id",
          dataset.source.tableId,
          "--record-id",
          recordId,
          "--file-token",
          attachment.file_token,
          "--output",
          relativeOutput,
          "--overwrite",
          "--json",
        ]);
      }

      return {
        sourceUrl: attachment.file_token,
        name: attachment.name,
        size: attachment.size,
        localPath: relativeOutput,
        publicPath: `/${relativeOutput.split(path.sep).join("/").replace(/^public\//, "")}`,
      };
    });

    return {
      recordId,
      sourceReviewId: byField["评价 id"] ?? recordId,
      createdAt: normalizeCreatedAt(byField["评价创建时间"]),
      commentText: byField["评价文本"] ?? "",
      poiName: byField["POI名称"] ?? "",
      poiLocation: byField["POI地址"] ?? "",
      poiProvince: byField["省份"] ?? "",
      poiCity: byField["城市"] ?? "",
      poiDistrict: byField["区"] ?? "",
      categoryL1: byField["一级类目"] ?? "",
      categoryL2: byField["二级类目"] ?? "",
      categoryL3: byField["三级类目"] ?? "",
      attachments: syncedAttachments,
    };
  });
}

async function syncFromSheet() {
  const payload = runLark([
    "sheets",
    "+csv-get",
    "--url",
    dataset.source.url,
    "--sheet-id",
    dataset.source.sheetId,
    "--range",
    "A1:X200",
    "--rows-json",
  ]);

  const rows = payload.data.rows ?? [];
  const dataRows = rows.slice(1).filter((row) => `${row.values.A ?? ""}`.trim().length > 0);

  const reviews = [];

  for (const [index, row] of dataRows.entries()) {
    const values = row.values;
    const recordId = `sheet_${datasetKey}_${values.B ?? row.row_number ?? index + 1}`;
    const attachments = [];

    for (const [attachmentIndex, column] of ["P", "Q", "R", "S", "T", "U", "V", "W", "X"].entries()) {
      const attachment = await buildSheetAttachment(recordId, values[column], attachmentIndex);
      if (attachment) {
        attachments.push(attachment);
      }
    }

    reviews.push({
      recordId,
      sourceReviewId: values.B ?? recordId,
      sourceRowNumber: row.row_number,
      createdAt: normalizeCreatedAt(values.A),
      commentText: values.C ?? "",
      poiName: values.F ?? "",
      poiLocation: values.G ?? "",
      poiProvince: values.H ?? "",
      poiCity: values.I ?? "",
      poiDistrict: values.J ?? "",
      categoryL1: values.K ?? "",
      categoryL2: values.L ?? "",
      categoryL3: values.M ?? "",
      attachments,
    });
  }

  return reviews;
}

const reviews = dataset.source.type === "base" ? syncFromBase() : await syncFromSheet();

const snapshot = {
  datasetKey: dataset.datasetKey,
  datasetId: dataset.datasetId,
  authorName: dataset.authorName,
  source:
    dataset.source.type === "sheet"
      ? {
          ...dataset.source,
          adapterVersion: "canonical-raw-v2-preview",
        }
      : dataset.source,
  syncedAt: new Date().toISOString(),
  reviews,
};

writeFileSync(rawOutput, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`已输出 ${rawOutput}`);
