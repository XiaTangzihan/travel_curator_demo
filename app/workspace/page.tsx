import { WorkspacePage } from "@/src/features/workspace/workspace-page";
import { getRawDataset } from "@/src/server/repositories/demo-repository";

export default async function WorkspaceRoute() {
  const rawDataset = await getRawDataset();

  if (!rawDataset) {
    throw new Error("演示素材尚未准备完成，请先初始化本地样本。");
  }

  return <WorkspacePage rawDataset={rawDataset} />;
}
