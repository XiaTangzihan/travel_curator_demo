import { notFound } from "next/navigation";
import { VideoGeneratingPage } from "@/src/features/video-generating/video-generating-page";
import { getRunTraceWithRecovery } from "@/src/server/repositories/demo-repository";

export const dynamic = "force-dynamic";

type VideoGeneratingRouteProps = {
  params: Promise<{ mapId: string; runId: string }>;
};

export default async function VideoGeneratingRoute(props: VideoGeneratingRouteProps) {
  const { runId } = await props.params;
  const run = await getRunTraceWithRecovery(runId);

  if (!run) {
    notFound();
  }

  return <VideoGeneratingPage initialRun={run} />;
}
