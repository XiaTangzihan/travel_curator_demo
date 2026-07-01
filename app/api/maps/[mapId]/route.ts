import { NextResponse } from "next/server";
import {
  getMapRecord,
  getRenderedMap,
} from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type MapRouteContext = {
  params: Promise<{ mapId: string }>;
};

export async function GET(_request: Request, context: MapRouteContext) {
  try {
    const { mapId } = await context.params;
    const [mapRecord, map] = await Promise.all([getMapRecord(mapId), getRenderedMap(mapId)]);

    if (!mapRecord || !map) {
      return NextResponse.json({ error: "地图不存在" }, { status: 404 });
    }

    return NextResponse.json({ mapRecord, map });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "读取地图失败" },
      { status: 500 },
    );
  }
}
