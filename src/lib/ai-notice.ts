export type AiNotice = {
  tone: "warning";
  title: string;
  message: string;
};

const aiNoticeStorageKey = "travel_curator_ai_notice";
const landmarkFallbackPrefix = "P1 已回退：";

export function hasLandmarkFallbackWarning(warnings: string[]) {
  return warnings.some((warning) => warning.startsWith(landmarkFallbackPrefix));
}

export function buildLandmarkFallbackNotice(city: string): AiNotice {
  return {
    tone: "warning",
    title: "城市地标已切换到兜底数据",
    message: `${city} 的实时知识补全本次未成功，系统已改用本地地标继续生成。`,
  };
}

export function resolveAiNoticeFromWarnings(params: {
  warnings: string[];
  city: string;
}) {
  if (!hasLandmarkFallbackWarning(params.warnings)) {
    return null;
  }

  return buildLandmarkFallbackNotice(params.city);
}

export function persistAiNotice(notice: AiNotice) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(aiNoticeStorageKey, JSON.stringify(notice));
}

export function consumeAiNotice() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(aiNoticeStorageKey);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(aiNoticeStorageKey);

  try {
    const parsed = JSON.parse(raw) as Partial<AiNotice>;
    if (
      parsed.tone === "warning" &&
      typeof parsed.title === "string" &&
      typeof parsed.message === "string"
    ) {
      return parsed as AiNotice;
    }
  } catch {
    return null;
  }

  return null;
}
