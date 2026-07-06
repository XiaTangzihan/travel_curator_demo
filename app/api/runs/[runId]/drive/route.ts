import { NextResponse } from "next/server";
import { driveMapRun } from "@/src/engine/pipelines/generate-map";

export const dynamic = "force-dynamic";

type RunDriveRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RunDriveRouteContext) {
  try {
    const { runId } = await context.params;
    const run = await driveMapRun(runId);

    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "推进 run 失败" },
      { status: 500 },
    );
  }
}
