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

export async function runSeedreamImage(prompt: string) {
  const response = await fetch(
    `${process.env.SEEDREAM_BASE_URL ?? requireEnv("SEEDREAM_BASE_URL")}/images/generations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireEnv("SEEDREAM_API_KEY")}`,
      },
      body: JSON.stringify({
        model: requireEnv("SEEDREAM_MODEL_ID"),
        prompt,
        response_format: "b64_json",
        size: "2048x2048",
      }),
    },
  );

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
