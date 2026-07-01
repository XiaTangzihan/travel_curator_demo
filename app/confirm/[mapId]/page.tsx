import { notFound } from "next/navigation";
import { ConfirmPage } from "@/src/features/confirm/confirm-page";
import {
  getMapRecord,
  getRenderedMap,
} from "@/src/server/repositories/demo-repository";

type ConfirmRouteProps = {
  params: Promise<{ mapId: string }>;
};

export default async function ConfirmRoute(props: ConfirmRouteProps) {
  const { mapId } = await props.params;
  const [mapRecord, mapViewModel] = await Promise.all([
    getMapRecord(mapId),
    getRenderedMap(mapId),
  ]);

  if (!mapRecord || !mapViewModel) {
    notFound();
  }

  return <ConfirmPage mapRecord={mapRecord} mapViewModel={mapViewModel} />;
}
