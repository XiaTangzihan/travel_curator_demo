import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteMapArtifacts } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mapIds: z.array(z.string().min(1)).min(1, "至少选择 1 个地图"),
});

export async function DELETE(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const uniqueMapIds = [...new Set(body.mapIds)];
    const results = await Promise.all(uniqueMapIds.map((mapId) => deleteMapArtifacts(mapId)));
    const deleted = results.filter((result): result is NonNullable<typeof result> => Boolean(result));
    const missingMapIds = uniqueMapIds.filter((mapId, index) => !results[index]);
    const failed = deleted.filter((result) => !result.verified);

    if (failed.length) {
      return NextResponse.json(
        {
          error: "部分地图删除后仍存在残留文件",
          failed: failed.map((result) => ({
            mapId: result.mapId,
            remainingArtifactPaths: result.remainingArtifactPaths,
          })),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      deletedMapIds: deleted.map((result) => result.mapId),
      deletedCount: deleted.length,
      missingMapIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "批量删除地图失败" },
      { status: 500 },
    );
  }
}
