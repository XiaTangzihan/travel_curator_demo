import type { EventRecord, Landmark } from "@/src/contracts/domain";

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

function buildIconHint(event: EventRecord) {
  const seeds = [
    shortName(event),
    event.categoryL3,
    event.categoryL2,
    event.commentText.slice(0, 18),
  ]
    .filter(Boolean)
    .join(" / ");

  return seeds.slice(0, 20);
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
  ];

  const body: string[] = [];

  days.forEach(([day, events], index) => {
    body.push(`# Day ${index + 1} (${day})`, "");

    events.forEach((event, eventIndex) => {
      const sequence = event.sequence ?? eventIndex + 1;
      body.push(`## Event ${sequence} · ${shortName(event)}`);
      body.push(`- sequence: ${sequence}`);
      body.push(`- poi: ${canonicalName(event)}`);
      body.push(`- short_name: ${shortName(event)}`);
      body.push(`- 类目: ${cleanCategory(event)}`);
      body.push(`- 文案: ${event.commentText || "无文字评论"}`);
      body.push(`- 配图: ${pickImage(event)}`);
      body.push(`- event标志生图提示: ${buildIconHint(event)}`);
      body.push("");
    });
  });

  return [...metadata, ...body].join("\n");
}
