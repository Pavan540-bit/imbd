import { SettingsScreen } from "@/components/screens/settings";
import { loadAudit, loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadPortfolio();
  return <SettingsScreen refreshedAt={data.marketRefreshedAt} audit={await loadAudit()} />;
}
