import path from "node:path";
import { getBamDatasetConfig } from "@/src/server/datasets/registry";
import { readBamSheetSnapshot } from "@/src/server/datasets/bam-reader";
import { buildCanonicalRawSnapshot } from "@/src/server/datasets/bam-to-raw";
import { storagePaths, writeJsonFile } from "@/src/server/utils/storage";

export async function syncDataset(datasetKey?: string | null) {
  const dataset = getBamDatasetConfig(datasetKey);
  const snapshot = readBamSheetSnapshot(dataset.key);
  const rawDataset = await buildCanonicalRawSnapshot(snapshot);
  const outputPath = path.join(storagePaths.raw, dataset.rawFileName);

  await writeJsonFile(outputPath, rawDataset);
  return {
    datasetKey: dataset.key,
    outputPath,
    rawDataset,
  };
}
