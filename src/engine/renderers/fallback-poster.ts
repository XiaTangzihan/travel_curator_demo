import type { EventRecord } from "@/src/contracts/domain";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createFallbackPosterSvg(params: {
  city: string;
  styleLabel: string;
  events: EventRecord[];
}) {
  const width = 1440;
  const height = 960;
  const nodes = params.events.map((event, index) => {
    const x = 170 + (index % 4) * 300 + (index % 2 === 0 ? 0 : 36);
    const y = 220 + Math.floor(index / 4) * 220;
    return { x, y, event, index };
  });

  const path = nodes
    .map((node, index) =>
      `${index === 0 ? "M" : "L"} ${node.x + 24} ${node.y + 24}`,
    )
    .join(" ");

  const nodeSvg = nodes
    .map(
      ({ x, y, event, index }) => `
      <g transform="translate(${x}, ${y})">
        <circle cx="24" cy="24" r="24" fill="#ff7a45" />
        <text x="24" y="31" text-anchor="middle" font-size="22" font-family="ui-monospace, Menlo, Monaco, Consolas" fill="#fffdf8">${event.sequence ?? index + 1}</text>
        <rect x="60" y="-6" width="208" height="64" rx="20" fill="rgba(255,253,248,0.94)" stroke="#173F7A" stroke-width="2" />
        <text x="76" y="30" font-size="18" font-weight="700" font-family="'Microsoft YaHei', sans-serif" fill="#16202A">${esc((event.shortName ?? event.poiName).slice(0, 18))}</text>
      </g>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f7f1e3" />
        <stop offset="100%" stop-color="#fffdf8" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#paper)" />
    <circle cx="1220" cy="160" r="120" fill="rgba(116,215,247,0.22)" />
    <circle cx="220" cy="140" r="90" fill="rgba(255,122,69,0.18)" />
    <text x="88" y="110" font-size="58" font-weight="900" font-family="'Microsoft YaHei', sans-serif" fill="#173F7A">${esc(params.city)}</text>
    <text x="88" y="156" font-size="24" font-family="'Microsoft YaHei', sans-serif" fill="#16202A">旅行地图 · ${esc(params.styleLabel)} · 本地稳态底片</text>
    <path d="${path}" fill="none" stroke="#74D7F7" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
    ${nodeSvg}
  </svg>`;
}
