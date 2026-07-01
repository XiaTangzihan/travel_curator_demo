import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMapDraft } from "@/src/engine/pipelines/generate-map";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mapName: z.string().min(1, "地图名称不能为空"),
  city: z.string().min(1),
  style: z.string().min(1),
  selectedCommentIds: z.array(z.string()).min(1, "至少选择 1 条评论"),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await generateMapDraft(body);

    return NextResponse.json({
      mapId: result.mapId,
      runId: result.runId,
      warnings: result.runTrace.warnings,
      providerMode: result.runTrace.providerMode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "生成失败" },
      { status: 500 },
    );
  }
}
