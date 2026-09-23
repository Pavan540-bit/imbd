import { CashflowScreen } from "@/components/screens/cashflow";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  return <CashflowScreen data={loadPortfolio()} />;
}
