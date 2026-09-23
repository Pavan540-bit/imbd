import { ReportsScreen } from "@/components/screens/reports";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <ReportsScreen data={await loadPortfolio()} />;
}
