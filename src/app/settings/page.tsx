import { SettingsScreen } from "@/components/screens/settings";
import { loadAudit, loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  const data = loadPortfolio();
  return <SettingsScreen refreshedAt={data.marketRefreshedAt} audit={loadAudit()} />;
}
