import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDemoDataset } from "@/src/config/demo";
import { preprocessDataset } from "@/src/engine/preprocess/raw_to_events";

const datasetKey = process.argv[2] ?? "hangzhou";
const dataset = getDemoDataset(datasetKey);
const rootDir = process.cwd();
const rawInput = path.join(rootDir, "public", "mock", "raw", dataset.rawFileName);
const eventsOutput = path.join(rootDir, "public", "mock", "events", dataset.eventsFileName);

mkdirSync(path.dirname(eventsOutput), { recursive: true });

const rawDataset = JSON.parse(readFileSync(rawInput, "utf8"));
const result = preprocessDataset(rawDataset);

const snapshot = {
  datasetKey: rawDataset.datasetKey ?? dataset.key,
  datasetId: rawDataset.datasetId,
  generatedAt: result.report.generatedAt,
  report: result.report,
  events: result.events,
};

writeFileSync(eventsOutput, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`已输出 ${eventsOutput}`);
