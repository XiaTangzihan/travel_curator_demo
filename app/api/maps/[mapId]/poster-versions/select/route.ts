import { NextResponse } from "next/server";
import { z } from "zod";
import { selectMapPosterVersion } from "@/src/engine/pipelines/generate-map";
import { getMapRecord } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type SelectPosterVersionContext = {
  params: Promise<{ mapId: string }>;
};

const requestSchema = z.object({
  versionId: z.string().min(1),
});

export async function POST(request: Request, context: SelectPosterVersionContext) {
  try {
    const { mapId } = await context.params;
    const mapRecord = await getMapRecord(mapId);

    if (!mapRecord) {
      return NextResponse.json({ error: "地图不存在" }, { status: 404 });
    }

    const body = requestSchema.parse(await request.json());
    const result = await selectMapPosterVersion({
      mapRecord,
      versionId: body.versionId,
    });

    return NextResponse.json({
      mapId,
      posterPath: result.mapRecord.posterPath,
      currentRunId: result.mapRecord.currentRunId,
      selectedPosterVersionId: result.mapRecord.selectedPosterVersionId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "切换海报版本失败" },
      { status: 500 },
    );
  }
}
