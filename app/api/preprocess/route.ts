import { NextResponse } from "next/server";
import { z } from "zod";
import { supportedDatasetKeys } from "@/src/config/demo";
import { preprocessDataset } from "@/src/engine/preprocess/raw_to_events";
import {
  getRawDataset,
  saveEventsDataset,
} from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  datasetKey: z.enum(supportedDatasetKeys),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const rawDataset = await getRawDataset(body.datasetKey);

    if (!rawDataset) {
      return NextResponse.json(
        { error: "本地原始样本不存在，请先执行对应同步脚本。" },
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
    await saveEventsDataset(snapshot, body.datasetKey);

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "预处理失败" },
      { status: 500 },
    );
  }
}
