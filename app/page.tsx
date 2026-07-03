import { ProfileHome } from "@/src/features/profile/profile-home";
import { getDemoDataset, resolveDatasetKey, supportedDatasetKeys } from "@/src/config/demo";
import { getRawDataset, listMapRecords } from "@/src/server/repositories/demo-repository";

type HomeProps = {
  searchParams: Promise<{ dataset?: string }>;
};

export default async function Home(props: HomeProps) {
  const searchParams = await props.searchParams;
  const datasetKey = resolveDatasetKey(searchParams.dataset);
  const [rawDataset, maps] = await Promise.all([getRawDataset(datasetKey), listMapRecords()]);

  return (
    <ProfileHome
      maps={maps}
      rawCount={rawDataset?.reviews.length ?? 0}
      activeDatasetKey={datasetKey}
      datasetOptions={supportedDatasetKeys.map((key) => getDemoDataset(key))}
    />
  );
}
