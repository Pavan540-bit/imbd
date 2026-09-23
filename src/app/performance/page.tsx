import { PerformanceScreen } from "@/components/screens/performance";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  return <PerformanceScreen data={loadPortfolio()} />;
}
