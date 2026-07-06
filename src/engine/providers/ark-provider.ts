import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SelectableImageModel } from "@/src/config/image-models";
import type { SelectableVideoModel } from "@/src/config/video-models";
import { resolveSeedreamRuntimeConfig } from "@/src/engine/providers/seedream-model-registry";
import { resolveSeedanceRuntimeConfig } from "@/src/engine/providers/seedance-model-registry";
import { readBinaryFile } from "@/src/server/utils/storage";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
};

type SeedreamImageOptions = {
  prompt: string;
  images?: string[];
  size?: string;
  imageModel?: SelectableImageModel;
};

type SeedanceVideoOptions = {
  prompt: string;
  imageUrl: string;
  durationSeconds: number;
  videoModel?: SelectableVideoModel;
  ratio?: "16:9";
  resolution?: "720p";
  generateAudio?: boolean;
};

type SeedanceTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "unknown";

type SeedanceTaskPayload = {
  id: string;
  model?: string;
  status?: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
  content?: {
    video_url?: string;
  } | null;
  usage?: {
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  created_at?: number;
  updated_at?: number;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generate_audio?: boolean;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function runChatCompletion(options: ChatOptions) {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: options.temperature ?? 0.2,
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response);
    throw new Error(`文本模型调用失败: ${JSON.stringify(detail)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("文本模型未返回可用内容");
  }

  return content;
}

export async function runDoubaoChat(messages: ChatMessage[], temperature?: number) {
  return runChatCompletion({
    baseUrl: process.env.DOUBAO_BASE_URL ?? requireEnv("DOUBAO_BASE_URL"),
    apiKey: requireEnv("DOUBAO_API_KEY"),
    model: requireEnv("DOUBAO_ENDPOINT"),
    messages,
    temperature,
  });
}

function imageMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

async function imageFileToDataUri(filePath: string) {
  const buffer = await readBinaryFile(filePath) ?? await readFile(filePath);
  return `data:${imageMimeType(filePath)};base64,${buffer.toString("base64")}`;
}

export async function runSeedreamImage(input: string | SeedreamImageOptions) {
  const options = typeof input === "string" ? { prompt: input } : input;
  const runtimeConfig = resolveSeedreamRuntimeConfig(options.imageModel);
  const images = options.images?.length
    ? await Promise.all(
        options.images.map(async (image) =>
          image.startsWith("data:image/") || image.startsWith("http") ? image : imageFileToDataUri(image),
        ),
      )
    : undefined;

  const response = await fetch(`${runtimeConfig.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runtimeConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: runtimeConfig.modelId,
      prompt: options.prompt,
      ...(images?.length ? { images } : {}),
      response_format: "b64_json",
      size: options.size ?? "2560x1440",
    }),
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response);
    throw new Error(`生图模型调用失败: ${JSON.stringify(detail)}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64 = payload.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error("生图模型未返回图片数据");
  }

  return Buffer.from(base64, "base64");
}

function normalizeSeedanceTaskStatus(status?: string): SeedanceTaskStatus {
  if (!status) {
    return "unknown";
  }

  switch (status) {
    case "queued":
    case "running":
    case "succeeded":
    case "failed":
    case "canceled":
      return status;
    default:
      return "unknown";
  }
}

export async function createSeedanceVideoTask(options: SeedanceVideoOptions) {
  const runtimeConfig = resolveSeedanceRuntimeConfig(options.videoModel);
  const imageUrl =
    options.imageUrl.startsWith("data:image/") || options.imageUrl.startsWith("http")
      ? options.imageUrl
      : await imageFileToDataUri(options.imageUrl);
  const response = await fetch(`${runtimeConfig.baseUrl}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runtimeConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: runtimeConfig.modelId,
      content: [
        {
          type: "text",
          text: options.prompt,
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        },
      ],
      duration: options.durationSeconds,
      ratio: options.ratio ?? "16:9",
      resolution: options.resolution ?? "720p",
      generate_audio: options.generateAudio ?? true,
    }),
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response);
    throw new Error(`生视频任务创建失败: ${JSON.stringify(detail)}`);
  }

  const payload = (await response.json()) as SeedanceTaskPayload;
  if (!payload.id) {
    throw new Error("生视频任务创建失败：未返回任务 ID");
  }

  return {
    taskId: payload.id,
    videoModel: runtimeConfig.videoModel,
    modelId: runtimeConfig.modelId,
    status: normalizeSeedanceTaskStatus(payload.status),
    payload,
  };
}

export async function getSeedanceVideoTask(params: {
  taskId: string;
  videoModel?: SelectableVideoModel;
}) {
  const runtimeConfig = resolveSeedanceRuntimeConfig(params.videoModel);
  const response = await fetch(
    `${runtimeConfig.baseUrl}/contents/generations/tasks/${params.taskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
      },
    },
  );

  if (!response.ok) {
    const detail = await parseJsonResponse(response);
    throw new Error(`生视频任务查询失败: ${JSON.stringify(detail)}`);
  }

  const payload = (await response.json()) as SeedanceTaskPayload;
  return {
    taskId: payload.id || params.taskId,
    videoModel: runtimeConfig.videoModel,
    modelId: runtimeConfig.modelId,
    status: normalizeSeedanceTaskStatus(payload.status),
    videoUrl: payload.content?.video_url?.trim() || "",
    errorCode: payload.error?.code?.trim() || "",
    errorMessage: payload.error?.message?.trim() || "",
    payload,
  };
}

export async function downloadSeedanceVideo(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const detail = await parseJsonResponse(response);
    throw new Error(`视频下载失败: ${JSON.stringify(detail)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
