import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const baseToken = "Qkj4bs0zoawVfxsiqZuczylCnSy";
const tableId = "tblriXmgzeiEEp56";
const viewId = "vewOamfc7D";
const authorName = "旅行者小夏";
const larkCliPath =
  process.env.LARK_CLI_PATH ?? "C:/Users/Admin/AppData/Roaming/npm/lark-cli.cmd";
const rootDir = process.cwd();
const commentsDir = path.join(rootDir, "public", "mock", "files", "comments");
const rawOutput = path.join(rootDir, "public", "mock", "raw", "guangzhou.raw.json");

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

function getExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return ext || ".jpg";
}

const payload = runLark([
  "base",
  "+record-list",
  "--as",
  "user",
  "--base-token",
  baseToken,
  "--table-id",
  tableId,
  "--view-id",
  viewId,
  "--limit",
  "20",
  "--format",
  "json",
]);

const fields = payload.data.fields;
const records = payload.data.data;
const recordIds = payload.data.record_id_list;

const mappedReviews = records.map((row, index) => {
  const recordId = recordIds[index];
  const byField = Object.fromEntries(fields.map((field, fieldIndex) => [field, row[fieldIndex]]));
  const attachments = Array.isArray(byField["原图"]) ? byField["原图"] : [];

  const syncedAttachments = attachments.map((attachment, attachmentIndex) => {
    const ext = getExt(attachment.name);
    const relativeOutput = path
      .join("public", "mock", "files", "comments", `${recordId}_${attachmentIndex + 1}${ext}`)
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
        baseToken,
        "--table-id",
        tableId,
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
      fileToken: attachment.file_token,
      name: attachment.name,
      size: attachment.size,
      localPath: relativeOutput,
      publicPath: `/${relativeOutput
        .split(path.sep)
        .join("/")
        .replace(/^public\//, "")}`,
    };
  });

  return {
    recordId,
    createdAt: byField["评价创建时间"],
    sourceDay: byField["Day"] ?? "",
    sourceTime: byField["时间"] ?? "",
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

const snapshot = {
  datasetId: "guangzhou-golden",
  authorName,
  source: {
    baseToken,
    tableId,
    viewId,
  },
  syncedAt: new Date().toISOString(),
  reviews: mappedReviews,
};

writeFileSync(rawOutput, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`已输出 ${rawOutput}`);
