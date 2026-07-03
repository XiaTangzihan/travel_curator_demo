import { notFound } from "next/navigation";
import { GeneratingPage } from "@/src/features/generating/generating-page";
import { getRunTraceWithRecovery } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type GeneratingRouteProps = {
  params: Promise<{ runId: string }>;
};

export default async function GeneratingRoute(props: GeneratingRouteProps) {
  const { runId } = await props.params;
  const run = await getRunTraceWithRecovery(runId);

  if (!run) {
    notFound();
  }

  return <GeneratingPage initialRun={run} />;
}
