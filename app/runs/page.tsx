import { RunsPage } from "@/src/features/runs/runs-page";
import { listRunTraces } from "@/src/server/repositories/demo-repository";

export default async function RunsRoute() {
  const runs = await listRunTraces();
  return <RunsPage runs={runs} />;
}
