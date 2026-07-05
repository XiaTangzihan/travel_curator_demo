import { NextResponse } from "next/server";
import { z } from "zod";
import { selectableImageModelSchema } from "@/src/contracts/domain";
import {
  resolveRegenerateExecutionPlan,
} from "@/src/features/confirm/regenerate-policy";
import { regenerateMapDraft } from "@/src/engine/pipelines/generate-map";
import {
  getEventsDataset,
  getMapRecord,
} from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type RegenerateContext = {
  params: Promise<{ mapId: string }>;
};

const requestSchema = z.object({
  mode: z.enum(["variant", "edit"]),
  instruction: z.string().default(""),
  imageModel: selectableImageModelSchema.optional(),
});

export async function POST(request: Request, context: RegenerateContext) {
  try {
    const { mapId } = await context.params;
    const mapRecord = await getMapRecord(mapId);
    const eventsSnapshot = mapRecord
      ? await getEventsDataset(mapRecord.datasetKey)
      : null;

    if (!mapRecord || !eventsSnapshot) {
      return NextResponse.json({ error: "地图或事件数据不存在" }, { status: 404 });
    }

    const body = requestSchema.parse(await request.json());
    const executionPlan = resolveRegenerateExecutionPlan({
      mode: body.mode,
      instruction: body.instruction,
    });
    const events = eventsSnapshot.events.filter((event) =>
      mapRecord.selectedCommentIds.includes(event.commentId),
    );

    const result = await regenerateMapDraft({
      mapRecord,
      events,
      mode: executionPlan.mode,
      instruction: executionPlan.instruction,
      imageModel: body.imageModel,
    });

    return NextResponse.json({
      mapId,
      runId: result.runId,
      providerMode: result.runTrace.providerMode,
      warnings: result.runTrace.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "重生成失败" },
      { status: 500 },
    );
  }
}
