import type { EventRecord } from "@/src/contracts/domain";

export const p2RouteSystemPrompt =
  "你是一名旅行路线编排助手。请把输入的事件按 day 和 time 组织成 route.md，严格输出 Markdown。";

export function buildRouteMarkdownPrompt(params: { events: EventRecord[] }) {
  return {
    system: p2RouteSystemPrompt,
    user: [
      "请把下面事件列表整理成 route.md。",
      "要求：先按 day 升序，再按 time 升序；输出 YAML front matter 与 Day/Event 分层；每个 event 都要有 event标志生图提示。",
      JSON.stringify(params.events, null, 2),
    ].join("\n\n"),
  };
}
