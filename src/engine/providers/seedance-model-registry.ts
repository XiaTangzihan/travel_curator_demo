import {
  resolveRequestedVideoModel,
  videoModelLabels,
  type SelectableVideoModel,
} from "@/src/config/video-models";

type SeedanceRuntimeConfig = {
  videoModel: SelectableVideoModel;
  label: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
};

const runtimeEnvMap: Record<
  SelectableVideoModel,
  {
    apiKeyEnvs: string[];
    modelIdEnvs: string[];
    defaultModelId?: string;
  }
> = {
  "seedance-1-5-pro": {
    apiKeyEnvs: ["SEEDANCE_1_5_API_KEY"],
    modelIdEnvs: ["SEEDANCE_1_5_MODEL_ID"],
    defaultModelId: "doubao-seedance-1-5-pro-251215",
  },
  "seedance-1-0-pro-fast": {
    apiKeyEnvs: ["SEEDANCE_1_0_PRO_FAST_API_KEY"],
    modelIdEnvs: ["SEEDANCE_1_0_PRO_FAST_MODEL_ID"],
    defaultModelId: "doubao-seedance-1-0-pro-fast-251015",
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
  fallbackValue?: string;
}) {
  const value = readFirstDefinedEnv(params.envNames);
  if (value) {
    return value;
  }

  if (params.fallbackValue) {
    return params.fallbackValue;
  }

  throw new Error(`${params.modelLabel} 缺少 ${params.fieldLabel} 配置：${params.envNames.join(" / ")}`);
}

export function resolveSeedanceRuntimeConfig(
  requestedVideoModel?: SelectableVideoModel | null,
): SeedanceRuntimeConfig {
  const videoModel = resolveRequestedVideoModel(requestedVideoModel);
  const label = videoModelLabels[videoModel];
  const baseUrl = process.env.SEEDANCE_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("缺少环境变量 SEEDANCE_BASE_URL");
  }

  const runtimeEnv = runtimeEnvMap[videoModel];

  return {
    videoModel,
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
      fallbackValue: runtimeEnv.defaultModelId,
    }),
  };
}

export function resolveAvailableSeedanceModels() {
  return (Object.keys(videoModelLabels) as SelectableVideoModel[]).filter((videoModel) => {
    try {
      resolveSeedanceRuntimeConfig(videoModel);
      return true;
    } catch {
      return false;
    }
  });
}
