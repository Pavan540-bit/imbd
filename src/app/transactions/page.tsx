import { TransactionsScreen } from "@/components/screens/transactions";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  return <TransactionsScreen data={loadPortfolio()} />;
}
