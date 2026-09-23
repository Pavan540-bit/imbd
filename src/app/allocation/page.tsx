import { AllocationScreen } from "@/components/screens/allocation";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AllocationScreen data={loadPortfolio()} />;
}
