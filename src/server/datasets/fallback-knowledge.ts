import type { Landmark } from "@/src/contracts/domain";
import type { DemoDatasetKey } from "@/src/config/demo";

const fallbackKnowledgeByDataset: Record<DemoDatasetKey, Landmark[]> = {
  guangzhou: [
    { name: "广州塔", visual: "修长塔身与夜景灯光" },
    { name: "珠江", visual: "穿城而过的江面与游船" },
    { name: "永庆坊", visual: "骑楼街巷与岭南旧城肌理" },
    { name: "白云山", visual: "城市边缘的山体与绿意" },
    { name: "沙面", visual: "欧式建筑群与树荫街道" },
    { name: "北京路", visual: "步行街与城市烟火" },
    { name: "陈家祠", visual: "岭南木雕与灰塑屋檐" },
    { name: "上下九", visual: "老广骑楼商业街" },
  ],
  hangzhou: [],
  meishan: [],
};

export function getFallbackKnowledge(datasetKey: DemoDatasetKey) {
  return fallbackKnowledgeByDataset[datasetKey] ?? [];
}
