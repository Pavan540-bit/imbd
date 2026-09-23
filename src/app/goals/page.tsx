import { GoalsScreen } from "@/components/screens/goals";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <GoalsScreen data={await loadPortfolio()} />;
}
