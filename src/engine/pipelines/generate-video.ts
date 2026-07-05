import {
  mapRecordSchema,
  runTraceSchema,
  type MapRecord,
} from "@/src/contracts/domain";
import { resolveRequestedVideoModel, type SelectableVideoModel } from "@/src/config/video-models";
import {
  buildVideoPrompt,
  supportedVideoDurationSeconds,
  type SupportedVideoDurationSeconds,
} from "@/src/engine/prompts";
import { canUsePublicImageAsModelInput } from "@/src/engine/pipelines/model-image-inputs";
import {
  createSeedanceVideoTask,
  downloadSeedanceVideo,
  getSeedanceVideoTask,
} from "@/src/engine/providers/ark-provider";
import { createRunId } from "@/src/lib/ids";
import {
  getMapRecord,
  getRenderedMap,
  saveMapRecord,
  saveRenderedMap,
  saveRunTrace,
  saveVideoArtifact,
  updateRunTrace,
} from "@/src/server/repositories/demo-repository";
import { fromPublicPath } from "@/src/server/utils/storage";

type StartGenerateVideoRunInput = {
  mapId: string;
  durationSeconds: number;
  videoModel?: SelectableVideoModel;
};

type GenerateVideoExecutionContext = {
  runId: string;
  mapRecord: MapRecord;
  startedAt: string;
};

const videoTaskPollIntervalMs = 2_000;
const videoTaskMaxPollAttempts = 90;

function buildVideoWaitPath(mapId: string, runId: string) {
  return `/maps/${mapId}/video/generating/${runId}`;
}

function isSupportedVideoDurationSeconds(value: number): value is SupportedVideoDurationSeconds {
  return (supportedVideoDurationSeconds as readonly number[]).includes(value);
}

function assertSupportedVideoDurationSeconds(value: number): SupportedVideoDurationSeconds {
  if (!isSupportedVideoDurationSeconds(value)) {
    throw new Error("视频时长仅支持 5 / 7 / 9 秒");
  }

  return value;
}

function assertPosterCanGenerateVideo(mapRecord: MapRecord) {
  if (!canUsePublicImageAsModelInput(mapRecord.posterPath)) {
    throw new Error("当前底片不支持视频生成，请先获得 PNG/JPG/WebP 底片");
  }
}

async function waitForSeedanceTask(params: {
  taskId: string;
  videoModel: SelectableVideoModel;
  runId: string;
}) {
  for (let attempt = 1; attempt <= videoTaskMaxPollAttempts; attempt += 1) {
    const task = await getSeedanceVideoTask({
      taskId: params.taskId,
      videoModel: params.videoModel,
    });

    await updateRunTrace(params.runId, {
      providerTaskId: task.taskId,
      updatedAt: new Date().toISOString(),
    });

    if (task.status === "succeeded") {
      if (!task.videoUrl) {
        throw new Error("视频任务已完成，但未返回可下载的视频地址");
      }
      return task;
    }

    if (task.status === "failed" || task.status === "canceled") {
      throw new Error(task.errorMessage || "视频任务执行失败");
    }

    if (attempt < videoTaskMaxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, videoTaskPollIntervalMs));
    }
  }

  throw new Error("视频任务长时间未完成，请稍后重试");
}

async function runGenerateVideo(params: GenerateVideoExecutionContext) {
  const durationSeconds = assertSupportedVideoDurationSeconds(
    params.mapRecord.videoDurationSeconds ?? 5,
  );
  const videoModel = resolveRequestedVideoModel(params.mapRecord.videoModel);
  const posterFilePath = fromPublicPath(params.mapRecord.posterPath);
  const prompt = buildVideoPrompt({
    styleKey: params.mapRecord.style,
    durationSeconds,
  });

  await updateRunTrace(params.runId, {
    progressStep: "rendering",
    updatedAt: new Date().toISOString(),
  });

  const createdTask = await createSeedanceVideoTask({
    prompt,
    imageUrl: posterFilePath,
    durationSeconds,
    videoModel,
    ratio: "16:9",
    resolution: "720p",
    generateAudio: true,
  });

  await updateRunTrace(params.runId, {
    providerTaskId: createdTask.taskId,
    videoModel,
    updatedAt: new Date().toISOString(),
  });

  const completedTask = await waitForSeedanceTask({
    taskId: createdTask.taskId,
    videoModel,
    runId: params.runId,
  });

  await updateRunTrace(params.runId, {
    progressStep: "finalizing",
    updatedAt: new Date().toISOString(),
  });

  const videoBuffer = await downloadSeedanceVideo(completedTask.videoUrl);
  const videoPath = await saveVideoArtifact(params.mapRecord.mapId, videoBuffer);
  const completedAt = new Date().toISOString();

  const nextMapRecord = mapRecordSchema.parse({
    ...params.mapRecord,
    currentVideoRunId: params.runId,
    videoPath,
    videoDurationSeconds: durationSeconds,
    videoUpdatedAt: completedAt,
    videoModel,
    updatedAt: completedAt,
  });
  await saveMapRecord(nextMapRecord);

  const renderedMap = await getRenderedMap(params.mapRecord.mapId);
  if (renderedMap) {
    await saveRenderedMap(params.mapRecord.mapId, {
      ...renderedMap,
      currentVideoRunId: params.runId,
      videoPath,
      videoDurationSeconds: durationSeconds,
      videoUpdatedAt: completedAt,
      videoModel,
      generatedAt: completedAt,
    });
  }

  await saveRunTrace(
    runTraceSchema.parse({
      runId: params.runId,
      mapId: params.mapRecord.mapId,
      datasetKey: params.mapRecord.datasetKey,
      status: "completed",
      stage: "video_generate",
      progressStep: "finalizing",
      imageModel: params.mapRecord.imageModel,
      videoModel,
      providerTaskId: createdTask.taskId,
      videoDurationSeconds: durationSeconds,
      styleKey: params.mapRecord.style,
      warnings: [],
      artifacts: {
        routePath: params.mapRecord.routePath,
        posterPath: params.mapRecord.posterPath,
        videoPath,
        mapPath: `/mock/maps/${params.mapRecord.mapId}.view.json`,
      },
      providerMode: "live",
      startedAt: params.startedAt,
      updatedAt: completedAt,
      endedAt: completedAt,
    }),
  );
}

export async function startGenerateVideoRun(input: StartGenerateVideoRunInput) {
  const mapRecord = await getMapRecord(input.mapId);
  if (!mapRecord) {
    throw new Error("当前地图不存在");
  }

  assertPosterCanGenerateVideo(mapRecord);
  const durationSeconds = assertSupportedVideoDurationSeconds(input.durationSeconds);
  const videoModel = resolveRequestedVideoModel(input.videoModel);
  const runId = createRunId();
  const startedAt = new Date().toISOString();

  const nextMapRecord = mapRecordSchema.parse({
    ...mapRecord,
    currentVideoRunId: runId,
    videoDurationSeconds: durationSeconds,
    videoModel,
    updatedAt: startedAt,
  });
  await saveMapRecord(nextMapRecord);

  const renderedMap = await getRenderedMap(mapRecord.mapId);
  if (renderedMap) {
    await saveRenderedMap(mapRecord.mapId, {
      ...renderedMap,
      currentVideoRunId: runId,
      videoDurationSeconds: durationSeconds,
      videoModel,
      generatedAt: startedAt,
    });
  }

  await saveRunTrace(
    runTraceSchema.parse({
      runId,
      mapId: mapRecord.mapId,
      datasetKey: mapRecord.datasetKey,
      status: "running",
      stage: "video_generate",
      progressStep: "preparing",
      imageModel: mapRecord.imageModel,
      videoModel,
      videoDurationSeconds: durationSeconds,
      styleKey: mapRecord.style,
      warnings: [],
      artifacts: {
        routePath: mapRecord.routePath,
        posterPath: mapRecord.posterPath,
        mapPath: `/mock/maps/${mapRecord.mapId}.view.json`,
      },
      providerMode: "live",
      startedAt,
      updatedAt: startedAt,
    }),
  );

  setTimeout(() => {
    void runGenerateVideo({
      runId,
      mapRecord: nextMapRecord,
      startedAt,
    }).catch(async (error) => {
      const failedAt = new Date().toISOString();
      await updateRunTrace(runId, {
        status: "failed",
        errorMessage: (error as Error).message || "视频生成失败",
        updatedAt: failedAt,
        endedAt: failedAt,
      });
    });
  }, 0);

  return {
    runId,
    mapId: mapRecord.mapId,
    waitPath: buildVideoWaitPath(mapRecord.mapId, runId),
  };
}

export {
  assertSupportedVideoDurationSeconds,
  buildVideoWaitPath,
  isSupportedVideoDurationSeconds,
};
