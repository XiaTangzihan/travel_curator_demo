import { ProfileHome } from "@/src/features/profile/profile-home";
import { getRawDataset, listMapRecords } from "@/src/server/repositories/demo-repository";

export default async function Home() {
  const [rawDataset, maps] = await Promise.all([getRawDataset(), listMapRecords()]);

  return <ProfileHome maps={maps} rawCount={rawDataset?.reviews.length ?? 0} />;
}
