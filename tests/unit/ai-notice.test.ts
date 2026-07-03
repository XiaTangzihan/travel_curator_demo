import { describe, expect, it } from "vitest";
import {
  buildLandmarkFallbackNotice,
  hasLandmarkFallbackWarning,
  resolveAiNoticeFromWarnings,
} from "@/src/lib/ai-notice";

describe("ai-notice", () => {
  it("只在 P1 fallback warning 出现时生成用户提示", () => {
    const notice = resolveAiNoticeFromWarnings({
      warnings: ["P1 已回退：文本模型调用失败", "P3 已回退：生图模型调用失败"],
      city: "杭州",
    });

    expect(notice).toEqual(buildLandmarkFallbackNotice("杭州"));
  });

  it("不会把其他 warning 误判为城市地标 fallback", () => {
    expect(
      hasLandmarkFallbackWarning([
        "P3 已回退：生图模型调用失败",
        "P4 提示：当前旧底片不是 PNG/JPG/WebP，已仅使用风格参考图重绘。",
      ]),
    ).toBe(false);
  });
});
