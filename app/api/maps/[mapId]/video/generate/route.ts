import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { selectableVideoModelKeys } from "@/src/config/video-models";
import { startGenerateVideoRun } from "@/src/engine/pipelines/generate-video";

export const dynamic = "force-dynamic";

type VideoGenerateContext = {
  params: Promise<{ mapId: string }>;
};

const requestSchema = z.object({
  durationSeconds: z.number().int().positive(),
  videoModel: z.enum(selectableVideoModelKeys).optional(),
  promptInstruction: z.string().max(8000).optional(),
});

function resolveErrorStatus(error: unknown) {
  if (error instanceof ZodError) {
    return 400;
  }

  const message = (error as Error).message || "";
  if (message.includes("不存在")) {
    return 404;
  }
  if (
    message.includes("仅支持")
    || message.includes("不支持")
    || message.includes("不能为空")
  ) {
    return 400;
  }

  return 500;
}

export async function POST(request: Request, context: VideoGenerateContext) {
  try {
    const { mapId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await startGenerateVideoRun({
      mapId,
      durationSeconds: body.durationSeconds,
      videoModel: body.videoModel,
      promptInstruction: body.promptInstruction,
    });

    return NextResponse.json({
      mapId: result.mapId,
      runId: result.runId,
      waitPath: result.waitPath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "视频生成失败" },
      { status: resolveErrorStatus(error) },
    );
  }
}
