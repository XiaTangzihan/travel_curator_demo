import {
  imageModelLabels,
  resolveRequestedImageModel,
  type SelectableImageModel,
} from "@/src/config/image-models";

type SeedreamRuntimeConfig = {
  imageModel: SelectableImageModel;
  label: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
};

const runtimeEnvMap: Record<
  SelectableImageModel,
  {
    apiKeyEnvs: string[];
    modelIdEnvs: string[];
  }
> = {
  "seedream-4-0": {
    apiKeyEnvs: ["SEEDREAM_4_0_API_KEY"],
    modelIdEnvs: ["SEEDREAM_4_0_MODEL_ID"],
  },
  "seedream-4-5": {
    apiKeyEnvs: ["SEEDREAM_4_5_API_KEY"],
    modelIdEnvs: ["SEEDREAM_4_5_MODEL_ID"],
  },
  "seedream-5-0": {
    apiKeyEnvs: ["SEEDREAM_5_0_API_KEY", "SEEDREAM_API_KEY"],
    modelIdEnvs: ["SEEDREAM_5_0_MODEL_ID", "SEEDREAM_MODEL_ID"],
  },
};

function readFirstDefinedEnv(envNames: string[]) {
  for (const envName of envNames) {
    const value = process.env[envName]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function requireModelEnv(params: {
  envNames: string[];
  modelLabel: string;
  fieldLabel: string;
}) {
  const value = readFirstDefinedEnv(params.envNames);
  if (value) {
    return value;
  }

  throw new Error(`${params.modelLabel} 缺少 ${params.fieldLabel} 配置：${params.envNames.join(" / ")}`);
}

export function resolveSeedreamRuntimeConfig(
  requestedImageModel?: SelectableImageModel | null,
): SeedreamRuntimeConfig {
  const imageModel = resolveRequestedImageModel(requestedImageModel);
  const label = imageModelLabels[imageModel];
  const baseUrl = process.env.SEEDREAM_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("缺少环境变量 SEEDREAM_BASE_URL");
  }

  const runtimeEnv = runtimeEnvMap[imageModel];

  return {
    imageModel,
    label,
    baseUrl,
    apiKey: requireModelEnv({
      envNames: runtimeEnv.apiKeyEnvs,
      modelLabel: label,
      fieldLabel: "API Key",
    }),
    modelId: requireModelEnv({
      envNames: runtimeEnv.modelIdEnvs,
      modelLabel: label,
      fieldLabel: "Model ID",
    }),
  };
}
