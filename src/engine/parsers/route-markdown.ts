import { parsedRouteSchema, type ParsedRoute, type ParsedRouteEvent } from "@/src/contracts/domain";

function parseFrontMatterValue(value: string) {
  return value.trim();
}

function parseIntegerField(value: string, fieldName: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`route front matter 字段 ${fieldName} 不是合法整数`);
  }
  return parsed;
}

function parseAvoid(value: string) {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFrontMatter(lines: string[]) {
  if (lines[0]?.trim() !== "---") {
    throw new Error("route front matter 起始分隔符缺失");
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex === -1) {
    throw new Error("route front matter 结束分隔符缺失");
  }

  const frontMatterLines = lines.slice(1, endIndex);
  const record = new Map<string, string>();
  for (const line of frontMatterLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`route front matter 行格式非法：${trimmed}`);
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    record.set(key, value);
  }

  return {
    endIndex,
    mapName: parseFrontMatterValue(record.get("map_name") ?? ""),
    city: parseFrontMatterValue(record.get("city") ?? ""),
    styleLabel: parseFrontMatterValue(record.get("style") ?? ""),
    days: parseIntegerField(record.get("days") ?? "", "days"),
    eventCount: parseIntegerField(record.get("event_count") ?? "", "event_count"),
    knowledgeCount: parseIntegerField(record.get("knowledge_count") ?? "", "knowledge_count"),
  };
}

export function parseRouteMarkdown(markdown: string): ParsedRoute {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const frontMatter = parseFrontMatter(lines);

  let index = frontMatter.endIndex + 1;
  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  if (lines[index]?.trim() !== "## Important Rules") {
    throw new Error("route 缺少 ## Important Rules 区块");
  }

  index += 1;
  const importantRules: string[] = [];
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("# Day ")) {
      break;
    }
    if (!trimmed.startsWith("- ")) {
      throw new Error(`Important Rules 行格式非法：${trimmed}`);
    }
    importantRules.push(trimmed.slice(2).trim());
    index += 1;
  }

  const events: ParsedRouteEvent[] = [];
  let currentDayIndex = 0;
  let currentDay = "";
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const dayMatch = /^# Day (\d+) \((.+)\)$/.exec(trimmed);
    if (dayMatch) {
      currentDayIndex = Number.parseInt(dayMatch[1], 10);
      currentDay = dayMatch[2].trim();
      index += 1;
      continue;
    }

    const eventMatch = /^## Event (\d+) · (.+)$/.exec(trimmed);
    if (!eventMatch) {
      throw new Error(`route 行无法识别：${trimmed}`);
    }

    if (!currentDayIndex || !currentDay) {
      throw new Error("event 在 route 中缺少所属 Day 上下文");
    }

    const headingSequence = Number.parseInt(eventMatch[1], 10);
    const headingTitle = eventMatch[2].trim();
    const fieldMap = new Map<string, string>();

    index += 1;
    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (!nextTrimmed) {
        index += 1;
        continue;
      }
      if (nextTrimmed.startsWith("# Day ") || nextTrimmed.startsWith("## Event ")) {
        break;
      }
      const fieldMatch = /^- ([^:]+):\s*(.*)$/.exec(nextTrimmed);
      if (!fieldMatch) {
        throw new Error(`event 字段行格式非法：${nextTrimmed}`);
      }
      fieldMap.set(fieldMatch[1].trim(), fieldMatch[2]);
      index += 1;
    }

    const parsedSequence = Number.parseInt(fieldMap.get("sequence") ?? "", 10);
    if (!Number.isFinite(parsedSequence)) {
      throw new Error(`event ${headingTitle} 缺少合法 sequence`);
    }
    if (parsedSequence !== headingSequence) {
      throw new Error(`event ${headingTitle} 的标题 sequence 与字段 sequence 不一致`);
    }

    events.push({
      dayIndex: currentDayIndex,
      day: currentDay,
      sequence: parsedSequence,
      headingTitle,
      poi: (fieldMap.get("poi") ?? "").trim(),
      shortName: (fieldMap.get("short_name") ?? "").trim(),
      category: (fieldMap.get("类目") ?? "").trim(),
      commentText: fieldMap.get("文案") ?? "",
      imagePath: (fieldMap.get("配图") ?? "").trim(),
      subject: (fieldMap.get("subject") ?? "").trim(),
      avoid: parseAvoid(fieldMap.get("avoid") ?? ""),
    });
  }

  return parsedRouteSchema.parse({
    mapName: frontMatter.mapName,
    city: frontMatter.city,
    styleLabel: frontMatter.styleLabel,
    days: frontMatter.days,
    eventCount: frontMatter.eventCount,
    knowledgeCount: frontMatter.knowledgeCount,
    importantRules,
    events,
  });
}
