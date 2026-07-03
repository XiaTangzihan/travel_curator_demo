import { NextResponse } from "next/server";
import { getRunTraceWithRecovery } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type RunRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RunRouteContext) {
  try {
    const { runId } = await context.params;
    const run = await getRunTraceWithRecovery(runId);

    if (!run) {
      return NextResponse.json({ error: "run 不存在" }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "读取 run 失败" },
      { status: 500 },
    );
  }
}
