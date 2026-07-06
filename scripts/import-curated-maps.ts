import { applyCuratedMapImport, formatCuratedMapImportReport, hasBlockingCuratedMapImportErrors, prepareCuratedMapImport } from "@/src/server/curated-map-import";

function readFlagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function collectMapIds() {
  const repeatedMapIds: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === "--map-id" && process.argv[index + 1]) {
      repeatedMapIds.push(process.argv[index + 1]);
    }
  }

  const groupedMapIds = (readFlagValue("--map-ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...repeatedMapIds, ...groupedMapIds];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const mapIds = collectMapIds();
  const targetRoot = readFlagValue("--target-root");

  const report = apply
    ? await applyCuratedMapImport({
        mode: "manual",
        apply: true,
        mapIds,
        targetRoot,
      })
    : (
        await prepareCuratedMapImport({
          mode: "manual",
          dryRun: true,
          mapIds,
          targetRoot,
        })
      ).report;

  console.log(formatCuratedMapImportReport(report));

  if (apply && !hasBlockingCuratedMapImportErrors(report)) {
    console.log(`已写入手动导图快照：${report.targetRoot}`);
  }

  if (hasBlockingCuratedMapImportErrors(report)) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error((error as Error).message || "import-curated-maps 执行失败");
  process.exitCode = 1;
});
