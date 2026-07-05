import { NextResponse } from "next/server";
import { mapRecordSchema, runTraceSchema } from "@/src/contracts/domain";
import { prunePosterVersionsForConfirm } from "@/src/engine/pipelines/generate-map";
import { createRunId } from "@/src/lib/ids";
import {
  getMapRecord,
  saveMapRecord,
  saveRunTrace,
} from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type ConfirmContext = {
  params: Promise<{ mapId: string }>;
};

export async function POST(_request: Request, context: ConfirmContext) {
  try {
    const { mapId } = await context.params;
    const mapRecord = await getMapRecord(mapId);

    if (!mapRecord) {
      return NextResponse.json({ error: "地图不存在" }, { status: 404 });
    }

    const prunedRecord = await prunePosterVersionsForConfirm({ mapRecord });

    const runId = createRunId();
    const confirmedRecord = mapRecordSchema.parse({
      ...prunedRecord,
      status: "confirmed",
      currentRunId: runId,
      updatedAt: new Date().toISOString(),
    });

    await saveMapRecord(confirmedRecord);
    await saveRunTrace(
      runTraceSchema.parse({
        runId,
        mapId,
        datasetKey: confirmedRecord.datasetKey,
        status: "completed",
        stage: "confirm",
        warnings: [],
        artifacts: {
          routePath: `/mock/routes/${mapId}.route.md`,
          posterPath: confirmedRecord.posterPath,
          mapPath: `/mock/maps/${mapId}.view.json`,
        },
        providerMode: "live",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      }),
    );

    return NextResponse.json({ ok: true, mapId, runId });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "确认保存失败" },
      { status: 500 },
    );
  }
}
