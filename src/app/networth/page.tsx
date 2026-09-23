import { NetWorthScreen } from "@/components/screens/networth";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  return <NetWorthScreen data={loadPortfolio()} />;
}
