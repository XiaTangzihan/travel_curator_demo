import type { EventRecord, Landmark } from "@/src/contracts/domain";

const IMPORTANT_RULES = [
  "所有 event 配图统一服从给定 style，不得自行发散风格。",
  "背景地标只作为背景视觉参考，不给地标配文。",
  "每个 event 的 subject 必须是一句完整画面描述。",
  "每个 event 的 avoid 必须是 3-5 个要避免的意象词。",
];

function cleanCategory(event: EventRecord) {
  return [event.categoryL1, event.categoryL2, event.categoryL3]
    .filter(Boolean)
    .join(" / ");
}

function pickImage(event: EventRecord) {
  return event.commentPictures[0]?.url ?? "无";
}

function sortEvents(events: EventRecord[]) {
  return [...events].sort((left, right) => {
    const sequenceDiff = (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER);
    if (sequenceDiff !== 0) {
      return sequenceDiff;
    }

    const leftKey = `${left.day} ${left.time}`;
    const rightKey = `${right.day} ${right.time}`;
    return leftKey.localeCompare(rightKey);
  });
}

function canonicalName(event: EventRecord) {
  return event.canonicalName?.trim() || event.poiName;
}

function shortName(event: EventRecord) {
  return event.shortName?.trim() || canonicalName(event);
}

function ensureVisualBrief(event: EventRecord) {
  if (!event.subject?.trim()) {
    throw new Error(`事件 ${event.commentId} 缺少 subject，无法生成新 route.md`);
  }

  if (!event.avoid?.length || event.avoid.length < 3 || event.avoid.length > 5) {
    throw new Error(`事件 ${event.commentId} 缺少有效 avoid，无法生成新 route.md`);
  }

  return {
    subject: event.subject.trim(),
    avoid: event.avoid.map((item) => item.trim()).filter(Boolean),
  };
}

export function createDeterministicRouteMarkdown(params: {
  mapName: string;
  city: string;
  styleLabel: string;
  events: EventRecord[];
  knowledge: Landmark[];
}) {
  const grouped = new Map<string, EventRecord[]>();

  for (const event of sortEvents(params.events)) {
    const list = grouped.get(event.day) ?? [];
    list.push(event);
    grouped.set(event.day, list);
  }

  const days = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  const metadata = [
    "---",
    `map_name: ${params.mapName}`,
    `city: ${params.city}`,
    `style: ${params.styleLabel}`,
    `days: ${days.length}`,
    `event_count: ${params.events.length}`,
    `knowledge_count: ${params.knowledge.length}`,
    "---",
    "",
    "## Important Rules",
    ...IMPORTANT_RULES.map((rule) => `- ${rule}`),
    "",
  ];

  const body: string[] = [];

  days.forEach(([day, events], index) => {
    body.push(`# Day ${index + 1} (${day})`, "");

    events.forEach((event, eventIndex) => {
      const sequence = event.sequence ?? eventIndex + 1;
      const visualBrief = ensureVisualBrief(event);
      body.push(`## Event ${sequence} · ${shortName(event)}`);
      body.push(`- sequence: ${sequence}`);
      body.push(`- poi: ${canonicalName(event)}`);
      body.push(`- short_name: ${shortName(event)}`);
      body.push(`- 类目: ${cleanCategory(event)}`);
      body.push(`- 文案: ${event.commentText || "无文字评论"}`);
      body.push(`- 配图: ${pickImage(event)}`);
      body.push(`- subject: ${visualBrief.subject}`);
      body.push(`- avoid: ${visualBrief.avoid.join(", ")}`);
      body.push("");
    });
  });

  return [...metadata, ...body].join("\n");
}
