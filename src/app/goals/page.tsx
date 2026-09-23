import { GoalsScreen } from "@/components/screens/goals";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  return <GoalsScreen data={loadPortfolio()} />;
}
