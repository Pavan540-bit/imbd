import { HoldingsScreen } from "@/components/screens/holdings";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const params = await searchParams;
  return <HoldingsScreen data={await loadPortfolio()} initialBucket={params.bucket || ""} />;
}
