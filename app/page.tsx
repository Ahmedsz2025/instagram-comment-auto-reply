import { Dashboard } from "@/components/dashboard";
import { getSafeConfiguration } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Dashboard config={getSafeConfiguration()} />;
}
