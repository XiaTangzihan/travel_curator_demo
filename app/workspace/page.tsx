import { WorkspacePage } from "@/src/features/workspace/workspace-page";
import { getRawDataset } from "@/src/server/repositories/demo-repository";

export default async function WorkspaceRoute() {
  const rawDataset = await getRawDataset();

  if (!rawDataset) {
    throw new Error("广州本地样本未初始化，请先执行 sync:guangzhou");
  }

  return <WorkspacePage rawDataset={rawDataset} />;
}
