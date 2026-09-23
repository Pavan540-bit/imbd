import { backupPayload } from "@/app/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await backupPayload();
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": "attachment; filename=portfolio-backup.json",
    },
  });
}
