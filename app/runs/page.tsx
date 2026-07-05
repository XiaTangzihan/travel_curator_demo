import { RunsPage } from "@/src/features/runs/runs-page";
import {
  getTraceMapDetailViewModel,
  getTraceOverviewViewModel,
} from "@/src/server/trace-diagnostics/queries";

export const dynamic = "force-dynamic";

export default async function RunsRoute() {
  const overview = await getTraceOverviewViewModel();
  const initialMapId = overview.mapItems[0]?.mapId;
  const initialDetail = initialMapId
    ? await getTraceMapDetailViewModel(initialMapId)
    : null;

  return <RunsPage overview={overview} initialDetail={initialDetail} />;
}
