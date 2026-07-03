import { NextResponse } from "next/server";
import { preprocessDataset } from "@/src/engine/preprocess/part1";
import {
  getRawDataset,
  saveEventsDataset,
} from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const rawDataset = await getRawDataset("guangzhou");

    if (!rawDataset) {
      return NextResponse.json(
        { error: "本地原始样本不存在，请先执行 sync:guangzhou" },
        { status: 400 },
      );
    }

    const result = preprocessDataset(rawDataset);
    const snapshot = {
      datasetKey: rawDataset.datasetKey,
      datasetId: rawDataset.datasetId,
      generatedAt: result.report.generatedAt,
      report: result.report,
      events: result.events,
    };
    await saveEventsDataset(snapshot, "guangzhou");

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "预处理失败" },
      { status: 500 },
    );
  }
}
