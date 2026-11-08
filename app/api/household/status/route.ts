import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

declare global {
  interface CloudflareEnv {
    GEMINI_API_KEY?: string;
  }
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return Response.json({ geminiConfigured: Boolean(env.GEMINI_API_KEY), currency: "NAD" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ geminiConfigured: false, currency: "NAD" }, { headers: { "Cache-Control": "no-store" } });
  }
}