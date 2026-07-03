import { notFound } from "next/navigation";
import { ConfirmPage } from "@/src/features/confirm/confirm-page";
import { formatRunDurationLabel } from "@/src/lib/run-trace";
import {
  getMapRecord,
  getRenderedMap,
  getRunTrace,
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

  const currentRun = mapRecord.currentRunId ? await getRunTrace(mapRecord.currentRunId) : null;
  const runDurationLabel = currentRun
    ? formatRunDurationLabel({
        startedAt: currentRun.startedAt,
        endedAt: currentRun.endedAt,
      })
    : null;

  return (
    <ConfirmPage
      mapRecord={mapRecord}
      mapViewModel={mapViewModel}
      runDurationLabel={runDurationLabel}
    />
  );
}
