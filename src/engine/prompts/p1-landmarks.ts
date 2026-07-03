export const p1LandmarksSystemPrompt =
  "你是一名熟悉中国城市旅行信息的助手，只能使用公开、非敏感、常识级信息。";

export function buildLandmarkPrompt(city: string) {
  return {
    system: p1LandmarksSystemPrompt,
    user: [
      `请基于公开、非敏感信息，列出 ${city} 最具代表性的地标与景点。`,
      "按知名度排序，输出 8 到 12 个。",
      '每个对象包含 name 和 visual 两个字段，严格输出 JSON 数组。',
    ].join("\n"),
  };
}
