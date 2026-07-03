import type { DemoDatasetKey } from "@/src/config/demo";
import type { EventRecord, Landmark, MapViewModel } from "@/src/contracts/domain";

function excerpt(text: string) {
  if (text.length <= 48) {
    return text;
  }
  return `${text.slice(0, 48)}...`;
}

function compareEventOrder(left: EventRecord, right: EventRecord) {
  const sequenceDiff = (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER);
  if (sequenceDiff !== 0) {
    return sequenceDiff;
  }

  const leftKey = `${left.day} ${left.time}`;
  const rightKey = `${right.day} ${right.time}`;
  return leftKey.localeCompare(rightKey);
}

export function buildMapViewModel(params: {
  mapId: string;
  datasetKey: DemoDatasetKey;
  mapName: string;
  city: string;
  style: string;
  posterPath: string;
  routeMarkdown: string;
  events: EventRecord[];
  knowledge: Landmark[];
}) {
  const events = [...params.events].sort(compareEventOrder);

  const selectedEventId = events[0]?.eventId ?? "";

  const viewModel: MapViewModel = {
    mapId: params.mapId,
    datasetKey: params.datasetKey,
    mapName: params.mapName,
    city: params.city,
    style: params.style,
    posterPath: params.posterPath,
    routeMarkdown: params.routeMarkdown,
    selectedEventId,
    generatedAt: new Date().toISOString(),
    knowledge: params.knowledge,
    nodes: events.map((event) => ({
      eventId: event.eventId,
      day: event.day,
      time: event.time,
      title: event.poiName,
      excerpt: excerpt(event.commentText || event.poiName),
      thumbnail: event.commentPictures[0]?.url,
    })),
    events,
  };

  return viewModel;
}
