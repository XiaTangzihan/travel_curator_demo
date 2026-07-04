import { NextResponse } from "next/server";
import { z } from "zod";
import { supportedDatasetKeys } from "@/src/config/demo";
import { supportedStyleKeys } from "@/src/engine/prompts";
import { startGenerateMapRun } from "@/src/engine/pipelines/generate-map";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  datasetKey: z.enum(supportedDatasetKeys),
  mapName: z.string().trim().min(1, "地图名称不能为空"),
  city: z.string().trim().min(1, "目的地不能为空"),
  style: z.enum(supportedStyleKeys),
  selectedCommentIds: z.array(z.string()).min(1, "至少选择 1 条评论"),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await startGenerateMapRun(body);

    return NextResponse.json({
      mapId: result.mapId,
      runId: result.runId,
      waitPath: result.waitPath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "生成失败" },
      { status: 500 },
    );
  }
}
