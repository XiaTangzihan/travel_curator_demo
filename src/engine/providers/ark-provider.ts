import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SelectableImageModel } from "@/src/config/image-models";
import { resolveSeedreamRuntimeConfig } from "@/src/engine/providers/seedream-model-registry";

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
  const buffer = await readFile(filePath);
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
