import { applyCuratedMapImport, formatCuratedMapImportReport, hasBlockingCuratedMapImportErrors, prepareCuratedMapImport } from "@/src/server/curated-map-import";

function readFlagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${value} 不是合法的正整数。`);
  }

  return parsed;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const expectedCount = parsePositiveInt(readFlagValue("--expected-count"), 5);
  const targetRoot = readFlagValue("--target-root");

  const report = apply
    ? await applyCuratedMapImport({
        mode: "favorite_preload",
        apply: true,
        expectedCount,
        targetRoot,
      })
    : (
        await prepareCuratedMapImport({
          mode: "favorite_preload",
          dryRun: true,
          expectedCount,
          targetRoot,
        })
      ).report;

  console.log(formatCuratedMapImportReport(report));

  if (apply && !hasBlockingCuratedMapImportErrors(report)) {
    console.log(`已写入收藏预装快照：${report.targetRoot}`);
  }

  if (hasBlockingCuratedMapImportErrors(report)) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error((error as Error).message || "bootstrap-favorite-preload 执行失败");
  process.exitCode = 1;
});
