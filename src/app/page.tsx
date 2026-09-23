import { DashboardScreen } from "@/components/screens/dashboard";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <DashboardScreen data={await loadPortfolio()} />;
}
