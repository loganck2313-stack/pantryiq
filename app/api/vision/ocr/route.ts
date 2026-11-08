import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

declare global {
  interface CloudflareEnv {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
  }
}

const MAX_IMAGE_BYTES = 1_000_000;
const MAX_BODY_BYTES = 1_400_000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

type OcrLine = { name: string; quantity: number; unit: string };

async function readLimitedBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Image request is too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing image data");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("Image request is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return JSON.parse(new TextDecoder().decode(bytes)) as { mimeType?: string; data?: string };
}

function allowRequest(request: Request) {
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [address, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(address);
    if (rateBuckets.size >= 500) return false;
  }
  const key = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_CALLS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function validateItems(value: unknown): OcrLine[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) throw new Error("Gemini returned an unreadable receipt response");
  return (value as { items: unknown[] }).items.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 100) : "";
    const quantity = Number(record.quantity ?? 1);
    const unit = typeof record.unit === "string" ? record.unit.trim().slice(0, 24) : "item";
    return name && Number.isFinite(quantity) && quantity > 0 && quantity <= 5000 ? [{ name, quantity, unit: unit || "item" }] : [];
  });
}

export async function POST(request: Request) {
  if (!allowRequest(request)) return Response.json({ error: "Vision request limit reached. Try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  try {
    const { env } = await getCloudflareContext({ async: true });
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Gemini is not configured. Add the server-side GEMINI_API_KEY secret." }, { status: 503, headers: { "Cache-Control": "no-store" } });

    const body = await readLimitedBody(request);
    if (!body.data || body.data.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) throw new Error("Choose an image smaller than 1 MB");
    if (!body.mimeType || !["image/jpeg", "image/png", "image/webp"].includes(body.mimeType)) throw new Error("Use a JPEG, PNG, or WebP receipt image");

    const model = env.GEMINI_MODEL && /^[a-zA-Z0-9._-]+$/.test(env.GEMINI_MODEL) ? env.GEMINI_MODEL : "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: "Read this grocery receipt. Return only JSON matching {items:[{name:string,quantity:number,unit:string}]}. Use quantity 1 and unit item when unclear. Do not infer unreadable text." },
            { inlineData: { mimeType: body.mimeType, data: body.data } },
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      });
      if (response.ok || (response.status < 500 && response.status !== 429) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** attempt)));
    }
    if (!response?.ok) return Response.json({ error: `Gemini request failed (${response?.status ?? "no response"})` }, { status: 502, headers: { "Cache-Control": "no-store" } });
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } };
    const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const items = validateItems(JSON.parse(text));
    return Response.json({ items, usage: { promptTokens: result.usageMetadata?.promptTokenCount ?? 0, outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0, totalTokens: result.usageMetadata?.totalTokenCount ?? 0 } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receipt image processing failed";
    const status = /image request|image smaller|use a jpeg|missing image/i.test(message) ? 400 : 502;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}