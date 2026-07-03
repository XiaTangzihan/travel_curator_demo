import { describe, expect, it } from "vitest";
import { formatRunDurationLabel, isTerminalRunStatus } from "@/src/lib/run-trace";

describe("formatRunDurationLabel", () => {
  it("会格式化 60 秒内的耗时", () => {
    expect(
      formatRunDurationLabel({
        startedAt: "2026-07-03T03:00:00.000Z",
        endedAt: "2026-07-03T03:00:18.000Z",
      }),
    ).toBe("18s");
  });

  it("会格式化 60 秒以上的耗时", () => {
    expect(
      formatRunDurationLabel({
        startedAt: "2026-07-03T03:00:00.000Z",
        endedAt: "2026-07-03T03:01:08.000Z",
      }),
    ).toBe("1m 08s");
  });
});

describe("isTerminalRunStatus", () => {
  it("能识别终态与非终态", () => {
    expect(isTerminalRunStatus("completed")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);
    expect(isTerminalRunStatus("incomplete")).toBe(true);
    expect(isTerminalRunStatus("running")).toBe(false);
  });
});
