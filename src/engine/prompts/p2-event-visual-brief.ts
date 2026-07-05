import { z } from "zod";
import { eventVisualBriefSchema, type EventRecord, type EventVisualBrief } from "@/src/contracts/domain";
import { SHORT_NAME_MAX_LENGTH } from "@/src/lib/short-name";

const eventVisualBriefListSchema = z.array(eventVisualBriefSchema);

export const p2EventVisualBriefSystemPrompt = [
  "你是一名旅行海报 event 配图语义整理助手。",
  "你只负责为每个 event 生成 shortName、subject 和 avoid。",
  `shortName 用于路线节点外部展示名，必须严格根据 poi 全名浓缩，不允许改写语义，不允许发明别名，不允许超过 ${SHORT_NAME_MAX_LENGTH} 个字。`,
  "shortName 优先保留 poi 全名里最有识别度的连续字串；若 poi 含括号门店信息或 · 后缀说明，可忽略这些噪声。",
  '示例1：poiName 为 "金元泰·泰式按摩·SPA(丽影广场客村店)" 时，shortName 可写 "金元泰"',
  '示例2：poiName 为 "杭州西溪喜来登度假大酒店" 时，shortName 可写 "西溪喜来登"',
  "subject 的作用是用一对关键词概括一个能够代表该 event 的主体气质。",
  "subject 必须固定写成 1 个简短中文名词和 1 个简短中文形容词，用顿号连接，顺序固定为“名词、形容词”。",
  "名词优先写具体器物、食物或真实空间；形容词只描述视觉气质，不要写动作、句子、标题、版式、路径、时间、价格、楼层、营销文案、招牌文字或解释性旁白。",
  "示例1：\"subject\": \"鸡公煲、热腾腾\"",
  "示例2：\"subject\": \"舞灯、闪亮\"",
  "示例3：\"subject\": \"按摩房、舒缓\"",
  "subject 不可出现带特别名称的元素，比如‘顺德鱼皮’，也不要使用“流光溢彩”“沉浸式”这类抽象词。",
  "反例：\"subject\": \"摆放着顺德鱼皮和咸蛋黄炸鲜虾的餐桌\"",
  "反例：\"subject\": \"流光溢彩的沉浸式体验空间\"",
  "反例：\"subject\": \"鸡公煲、翻滚热气、木桌近景\"",
  "若场景里常见店招、菜单、路牌或电子屏，请只保留无字的空间或器物，不要把文字内容写进 subject。",
  "所有 event 配图统一服从给定 style，不得自行发散风格；不要在 subject 中单独指定与给定 style 冲突的画风。",
  "avoid 必须是 3-5 个简短中文意象词，用于指出应避免画进图里的误导元素或噪声。",
  "avoid 不允许写完整句，不允许写解释，不允许超过 5 个词。",
  "avoid 必须输出为 JSON 数组，不允许输出成单个字符串。",
  '示例输出：{"shortName":"金元泰","subject":"按摩房、舒缓","avoid":["台阶","楼层指示牌","套餐价格字样"]}',
  "输出必须是 JSON 数组，长度与输入数组完全一致，顺序与输入数组完全一致。",
  "每个数组项只能包含 shortName、subject 和 avoid 三个字段。",
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
      `请基于输入中的 poiName、categoryL1、commentText，为每个 event 生成 shortName、subject 和 avoid。shortName 必须来自 poiName 本身，且不超过 ${SHORT_NAME_MAX_LENGTH} 个字。`,
      "如 commentText 信息不足，可结合 poiName 与 categoryL1 做最保守的画面化归纳，优先产出无字、具体、可画的「名词、形容词」subject。",
      "若评论中含有楼层、价格、排队、门牌、时间等噪声，请优先在 avoid 中规避。",
      "若场景天然可能出现店招、菜单、电子屏或海报字样，也请优先写进 avoid。",
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

function normalizeAvoid(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeAvoid(parsed);
      }
    } catch {
      // Ignore and continue with delimiter-based splitting.
    }

    return trimmed
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(/[\n,，、;；|｜]+/)
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  return [];
}

export function parseEventVisualBriefs(text: string): EventVisualBrief[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型输出中未找到 event visual brief JSON 数组");
  }

  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Array<{
      shortName?: unknown;
      subject?: unknown;
      avoid?: unknown;
    }>;

    const normalized = raw.map((item) => ({
      shortName: `${item.shortName ?? ""}`.trim(),
      subject: `${item.subject ?? ""}`.trim(),
      avoid: normalizeAvoid(item.avoid),
    }));

    return eventVisualBriefListSchema.parse(normalized);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error("event visual brief 输出格式不合法：请确保每个 event 都返回非空 shortName、subject，且 avoid 为 3-5 个意象词。");
    }
    throw error;
  }
}
