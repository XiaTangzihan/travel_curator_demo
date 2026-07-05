import { RunsPage } from "@/src/features/runs/runs-page";
import {
  getTraceMapDetailViewModel,
  getTraceOverviewViewModel,
} from "@/src/server/trace-diagnostics/queries";

export const dynamic = "force-dynamic";

type RunsRouteProps = {
  searchParams: Promise<{ mapId?: string }>;
};

export default async function RunsRoute(props: RunsRouteProps) {
  const searchParams = await props.searchParams;
  const overview = await getTraceOverviewViewModel();
  const requestedMapId = searchParams.mapId?.trim();
  const initialMapId =
    requestedMapId && overview.mapItems.some((item) => item.mapId === requestedMapId)
      ? requestedMapId
      : overview.mapItems[0]?.mapId;
  const initialDetail = initialMapId
    ? await getTraceMapDetailViewModel(initialMapId)
    : null;

  return <RunsPage overview={overview} initialDetail={initialDetail} />;
}
