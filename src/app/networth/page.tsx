import { NetWorthScreen } from "@/components/screens/networth";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <NetWorthScreen data={await loadPortfolio()} />;
}
