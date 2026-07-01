import { notFound } from "next/navigation";
import { DynamicMapPage } from "@/src/features/dynamic-map/dynamic-map-page";
import { getRenderedMap } from "@/src/server/repositories/demo-repository";

type MapRouteProps = {
  params: Promise<{ mapId: string }>;
};

export default async function MapRoute(props: MapRouteProps) {
  const { mapId } = await props.params;
  const map = await getRenderedMap(mapId);

  if (!map) {
    notFound();
  }

  return <DynamicMapPage map={map} />;
}
