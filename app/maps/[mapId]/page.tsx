import { notFound } from "next/navigation";
import { DynamicMapPage } from "@/src/features/dynamic-map/dynamic-map-page";
import {
  getRenderedMap,
  getRunTrace,
} from "@/src/server/repositories/demo-repository";
import { resolveAvailableSeedanceModels } from "@/src/engine/providers/seedance-model-registry";

type MapRouteProps = {
  params: Promise<{ mapId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function MapRoute(props: MapRouteProps) {
  const { mapId } = await props.params;
  const searchParams = await props.searchParams;
  const map = await getRenderedMap(mapId);

  if (!map) {
    notFound();
  }

  const initialTab = searchParams.tab === "video" ? "video" : "map";
  const availableVideoModels = resolveAvailableSeedanceModels();
  const currentVideoRun = map.currentVideoRunId
    ? await getRunTrace(map.currentVideoRunId)
    : null;

  return (
    <DynamicMapPage
      map={map}
      initialTab={initialTab}
      availableVideoModels={availableVideoModels}
      initialVideoPromptInstruction={currentVideoRun?.promptInstruction}
    />
  );
}
