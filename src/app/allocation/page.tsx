import { AllocationScreen } from "@/components/screens/allocation";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <AllocationScreen data={await loadPortfolio()} />;
}
