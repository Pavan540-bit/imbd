import { CashflowScreen } from "@/components/screens/cashflow";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <CashflowScreen data={await loadPortfolio()} />;
}
