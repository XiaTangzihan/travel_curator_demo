import { NextResponse } from "next/server";
import { z } from "zod";
import { setMapFavoriteState } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mapIds: z.array(z.string().min(1)).min(1, "至少选择 1 个地图"),
  favorite: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const uniqueMapIds = [...new Set(body.mapIds)];
    const results = await Promise.all(
      uniqueMapIds.map((mapId) => setMapFavoriteState(mapId, body.favorite)),
    );
    const updated = results.filter((result): result is NonNullable<typeof result> => Boolean(result));
    const missingMapIds = uniqueMapIds.filter((mapId, index) => !results[index]);

    return NextResponse.json({
      ok: true,
      favorite: body.favorite,
      updatedMapIds: updated.map((result) => result.mapId),
      updatedCount: updated.length,
      missingMapIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "批量更新收藏状态失败" },
      { status: 500 },
    );
  }
}
