import { execSync } from "node:child_process";
import { getBamDatasetConfig, type BamDatasetConfig, type BamDatasetKey } from "@/src/server/datasets/registry";

const larkCliPath =
  process.env.LARK_CLI_PATH ?? "C:/Users/Admin/AppData/Roaming/npm/lark-cli.cmd";

function runLarkJson(args: string[]) {
  const command = [larkCliPath, ...args]
    .map((arg) => `"${String(arg).replaceAll('"', '\\"')}"`)
    .join(" ");
  const output = execSync(command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: "powershell.exe",
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function columnNumberToName(columnNumber: number) {
  let value = columnNumber;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function columnNameToNumber(columnName: string) {
  return columnName
    .split("")
    .reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0);
}

export type BamColumn = {
  key: string;
  header: string;
};

export type BamDataRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type BamSheetSnapshot = {
  dataset: BamDatasetConfig & { key: BamDatasetKey };
  columns: BamColumn[];
  imageColumnKeys: string[];
  rows: BamDataRow[];
};

function readSheetBounds(dataset: BamDatasetConfig & { key: BamDatasetKey }) {
  const workbook = runLarkJson([
    "sheets",
    "+workbook-info",
    "--url",
    dataset.source.url,
  ]) as {
    data?: {
      sheets?: Array<{
        sheet_id?: string;
        column_count?: number;
        row_count?: number;
      }>;
    };
  };

  const sheet = workbook.data?.sheets?.find(
    (candidate) => candidate.sheet_id === dataset.source.sheetId,
  );
  if (!sheet?.column_count || !sheet.row_count) {
    throw new Error(`无法定位 BAM 分表 ${dataset.source.sheetName} 的边界`);
  }

  return {
    columnCount: sheet.column_count,
    rowCount: sheet.row_count,
  };
}

function buildColumns(values: Record<string, string>) {
  return Object.entries(values)
    .sort((left, right) => columnNameToNumber(left[0]) - columnNameToNumber(right[0]))
    .map(([key, header]) => ({
      key,
      header: `${header ?? ""}`.trim(),
    }));
}

function buildImageColumnKeys(columns: BamColumn[]) {
  const startIndex = columns.findIndex((column) => column.header === "图片 URL 列表");
  if (startIndex === -1) {
    return [];
  }

  const keys = [columns[startIndex].key];
  for (let index = startIndex + 1; index < columns.length; index += 1) {
    const header = columns[index].header;
    if (header) {
      break;
    }
    keys.push(columns[index].key);
  }

  return keys;
}

export function findColumnKey(columns: BamColumn[], headerName: string) {
  return columns.find((column) => column.header === headerName)?.key;
}

export function getCellValue(row: BamDataRow, columnKey: string | undefined) {
  if (!columnKey) {
    return "";
  }

  return `${row.values[columnKey] ?? ""}`.trim();
}

export function readBamSheetSnapshot(datasetKey?: string | null): BamSheetSnapshot {
  const dataset = getBamDatasetConfig(datasetKey);
  const bounds = readSheetBounds(dataset);
  const range = `A1:${columnNumberToName(bounds.columnCount)}${bounds.rowCount}`;
  const payload = runLarkJson([
    "sheets",
    "+csv-get",
    "--url",
    dataset.source.url,
    "--sheet-id",
    dataset.source.sheetId,
    "--range",
    range,
    "--rows-json",
  ]) as {
    data?: {
      rows?: Array<{
        row_number?: number;
        values?: Record<string, string>;
      }>;
    };
  };

  const rows = payload.data?.rows ?? [];
  const headerRow = rows[0]?.values ?? {};
  const columns = buildColumns(headerRow);
  const imageColumnKeys = buildImageColumnKeys(columns);
  const dataRows = rows
    .slice(1)
    .filter((row) =>
      Object.values(row.values ?? {}).some((value) => `${value ?? ""}`.trim().length > 0),
    )
    .map((row) => ({
      rowNumber: row.row_number ?? 0,
      values: Object.fromEntries(
        Object.entries(row.values ?? {}).map(([key, value]) => [key, `${value ?? ""}`.trim()]),
      ),
    }));

  return {
    dataset,
    columns,
    imageColumnKeys,
    rows: dataRows,
  };
}
