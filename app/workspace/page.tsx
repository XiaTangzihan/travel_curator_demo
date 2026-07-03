import { WorkspacePage } from "@/src/features/workspace/workspace-page";
import { getDemoDataset, resolveDatasetKey, supportedDatasetKeys } from "@/src/config/demo";
import { getRawDataset } from "@/src/server/repositories/demo-repository";

type WorkspaceRouteProps = {
  searchParams: Promise<{ dataset?: string }>;
};

export default async function WorkspaceRoute(props: WorkspaceRouteProps) {
  const searchParams = await props.searchParams;
  const datasetKey = resolveDatasetKey(searchParams.dataset);
  const rawDataset = await getRawDataset(datasetKey);

  if (!rawDataset) {
    throw new Error("演示素材尚未准备完成，请先初始化本地样本。");
  }

  return (
    <WorkspacePage
      rawDataset={rawDataset}
      activeDatasetKey={datasetKey}
      datasetOptions={supportedDatasetKeys.map((key) => getDemoDataset(key))}
    />
  );
}
