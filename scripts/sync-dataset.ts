import { syncDataset } from "@/src/server/datasets/sync-dataset";

const datasetKey = process.argv[2] ?? "hangzhou";

async function main() {
  const result = await syncDataset(datasetKey);
  console.log(`已输出 ${result.outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
