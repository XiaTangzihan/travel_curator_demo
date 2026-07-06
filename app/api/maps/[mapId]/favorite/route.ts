import { NextResponse } from "next/server";
import { z } from "zod";
import { setMapFavoriteState } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type FavoriteMapContext = {
  params: Promise<{ mapId: string }>;
};

const requestSchema = z.object({
  favorite: z.boolean(),
});

export async function POST(request: Request, context: FavoriteMapContext) {
  try {
    const { mapId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await setMapFavoriteState(mapId, body.favorite);

    if (!result) {
      return NextResponse.json({ error: "地图不存在" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      mapId,
      favorite: body.favorite,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "更新收藏状态失败" },
      { status: 500 },
    );
  }
}
