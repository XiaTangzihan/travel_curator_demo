import { z } from "zod";
import { eventVisualBriefSchema, type EventRecord, type EventVisualBrief } from "@/src/contracts/domain";

const eventVisualBriefListSchema = z.array(eventVisualBriefSchema);

export const p2EventVisualBriefSystemPrompt = [
  "你是一名旅行海报 event 配图语义整理助手。",
  "你只负责为每个 event 生成 subject 和 avoid。",
  "subject 必须是一句完整、自然、可画面化的中文句子，描述一幅图里主要该画什么。",
  "subject 只允许描述主体、动作、场景，不要写编号、标题、版式、路径、时间、价格、楼层、营销文案或解释性旁白。",
  "所有 event 配图统一服从给定 style，不得自行发散风格；不要在 subject 中单独指定与给定 style 冲突的画风。",
  "avoid 必须是 3-5 个简短中文意象词，用于指出应避免画进图里的误导元素或噪声。",
  "avoid 不允许写完整句，不允许写解释，不允许超过 5 个词。",
  "输出必须是 JSON 数组，长度与输入数组完全一致，顺序与输入数组完全一致。",
  "每个数组项只能包含 subject 和 avoid 两个字段。",
].join("\n");

function normalizeCommentText(text: string) {
  return text.trim() || "无文字评论";
}

export function buildEventVisualBriefPrompt(params: {
  styleLabel: string;
  events: EventRecord[];
}) {
  return {
    system: p2EventVisualBriefSystemPrompt,
    user: [
      `当前全局 style：${params.styleLabel}`,
      "请基于输入中的 poiName、categoryL1、commentText，为每个 event 生成 subject 和 avoid。",
      "如 commentText 信息不足，可结合 poiName 与 categoryL1 做最保守的画面化归纳。",
      "若评论中含有楼层、价格、排队、门牌、时间等噪声，请优先在 avoid 中规避。",
      JSON.stringify(
        params.events.map((event) => ({
          poiName: event.poiName,
          categoryL1: event.categoryL1,
          commentText: normalizeCommentText(event.commentText),
        })),
        null,
        2,
      ),
    ].join("\n\n"),
  };
}

export function parseEventVisualBriefs(text: string): EventVisualBrief[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型输出中未找到 event visual brief JSON 数组");
  }

  return eventVisualBriefListSchema.parse(JSON.parse(text.slice(start, end + 1)));
}
