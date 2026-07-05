import { NextResponse } from "next/server";
import { getTraceMapDetailViewModel } from "@/src/server/trace-diagnostics/queries";

export const dynamic = "force-dynamic";

type TraceMapRouteContext = {
  params: Promise<{ mapId: string }>;
};

export async function GET(_request: Request, context: TraceMapRouteContext) {
  try {
    const { mapId } = await context.params;
    const detail = await getTraceMapDetailViewModel(mapId);

    if (!detail) {
      return NextResponse.json({ error: "作品不存在" }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "读取作品追踪详情失败" },
      { status: 500 },
    );
  }
}
