import { load } from "cheerio";

export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 2;

type ScrapedRecipe = {
  name: string;
  note: string;
  ingredients: string[];
  steps: string[];
  minutes: number;
  servings?: string;
  image?: string;
  sourceUrl: string;
};

function validateTarget(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete recipe URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const blockedSuffixes = [".localhost", ".local", ".internal", ".test", ".invalid", ".example", ".home.arpa"];
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hostname.includes(".") || hostname.includes(":") || /^\d+(?:\.\d+){3}$/.test(hostname) || !/^[a-z0-9.-]+$/.test(hostname) || blockedSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("Use a public HTTPS recipe page without credentials or a custom port");
  }
  if (hostname.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-"))) throw new Error("That recipe host is not valid");
  url.hash = "";
  return url;
}

async function fetchHtml(sourceUrl: string, signal: AbortSignal) {
  const initialUrl = validateTarget(sourceUrl);
  let target = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(target, {
      redirect: "manual",
      signal,
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9", "User-Agent": "PantryIQRecipePreview/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("The recipe page redirected too many times");
      const next = validateTarget(new URL(location, target).toString());
      if (next.hostname !== initialUrl.hostname) throw new Error("The recipe page redirected to another host; open its final URL directly");
      target = next;
      continue;
    }
    if (!response.ok) throw new Error(`The recipe site returned HTTP ${response.status}`);
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) throw new Error("That URL did not return an HTML page");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) throw new Error("That page is too large to import");
    if (!response.body) throw new Error("The recipe page had no readable content");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("That page is too large to import");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return { html: new TextDecoder().decode(bytes), url: target.toString() };
  }
  throw new Error("Could not reach that recipe page");
}

function parseDuration(value: unknown) {
  if (typeof value !== "string") return 30;
  const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (iso) return Math.max(1, Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0));
  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/i);
  return hours || minutes ? Math.max(1, Math.round(Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0))) : 30;
}

function flattenText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenText);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return flattenText(record.text ?? record.name ?? record.itemListElement);
  }
  return [];
}

function findRecipe(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value.map(findRecipe).find(Boolean);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.some((type) => typeof type === "string" && type.toLowerCase() === "recipe")) return record;
  return findRecipe(record["@graph"]) ?? findRecipe(record.mainEntity);
}

function imageFromValue(value: unknown, baseUrl: string) {
  const entry = Array.isArray(value) ? value[0] : value;
  const raw = typeof entry === "string" ? entry : entry && typeof entry === "object" ? String((entry as Record<string, unknown>).url ?? (entry as Record<string, unknown>).contentUrl ?? "") : "";
  if (!raw) return undefined;
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== "https:") return undefined;
    const resize = url.searchParams.get("resize")?.match(/(\d{2,5})[,x](\d{2,5})/);
    const declaredWidth = Number(resize?.[1] ?? url.searchParams.get("width") ?? url.searchParams.get("w") ?? 0);
    if (declaredWidth > 0 && declaredWidth < 800) return undefined;
    if (resize && Number(resize[1]) < 1400) {
      const height = Math.round(1400 * Number(resize[2]) / Number(resize[1]));
      url.searchParams.set("resize", `1400,${height}`);
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function parseRecipe(html: string, sourceUrl: string): ScrapedRecipe {
  const $ = load(html);
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const meta = (...selectors: string[]) => {
    for (const selector of selectors) {
      const value = $(selector).first().attr("content");
      if (value) return clean(value);
    }
    return "";
  };
  const jsonLdRecords: unknown[] = [];
  $("script[type='application/ld+json']").each((_, script) => {
    try { jsonLdRecords.push(JSON.parse($(script).contents().text())); } catch { /* Ignore malformed structured data. */ }
  });
  const schema = jsonLdRecords.map(findRecipe).find(Boolean);
  const microdata = $("[itemtype*='schema.org/Recipe'], [itemtype*='Recipe']").first();
  const propertyText = (property: string) => {
    const element = microdata.find(`[itemprop='${property}']`).first();
    return clean(element.attr("content") ?? element.attr("datetime") ?? element.text());
  };
  const schemaIngredients = Array.isArray(schema?.recipeIngredient) ? schema.recipeIngredient.filter((item): item is string => typeof item === "string") : [];
  const microIngredients = microdata.find("[itemprop='recipeIngredient'], [itemprop='ingredients']").map((_, item) => clean($(item).attr("content") ?? $(item).text())).get().filter(Boolean);
  const headings = $("h2,h3,h4").toArray();
  const sectionList = (pattern: RegExp, listSelector: string) => {
    for (const heading of headings) {
      if (!pattern.test(clean($(heading).text()))) continue;
      const section = $(heading).closest("section, article, li").first();
      const container = section.length ? section : $(heading).parent().parent();
      const items = container.find(listSelector).map((_, item) => clean($(item).text())).get().filter(Boolean);
      if (items.length) return items;
    }
    return [];
  };
  const article = $("article, main, [itemtype*='Recipe'], [class*='recipe'], [id*='recipe']").first();
  const fallbackRoot = article.length ? article : $("body");
  let ingredients = schemaIngredients.length ? schemaIngredients : microIngredients;
  if (!ingredients.length) ingredients = sectionList(/ingredients|you.?ll need|what you need/i, "li");
  if (!ingredients.length) ingredients = fallbackRoot.find("ul li").map((_, item) => clean($(item).text())).get().filter((text) => /^\d+(?:\s*\/\s*\d+|\.\d+)?\s+/.test(text)).slice(0, 100);
  let steps = schema ? flattenText(schema.recipeInstructions) : [];
  if (!steps.length && microdata.length) steps = microdata.find("[itemprop='recipeInstructions']").map((_, item) => clean($(item).attr("content") ?? $(item).text())).get().filter(Boolean);
  if (!steps.length) steps = sectionList(/instructions|directions|method|preparation|steps/i, "li");
  if (!steps.length) steps = fallbackRoot.find("ol li").map((_, item) => clean($(item).text())).get().filter(Boolean).slice(0, 100);

  const name = clean(String(schema?.name || propertyText("name") || meta("meta[property='og:title']", "meta[name='twitter:title']") || $("h1").first().text() || "")).slice(0, 160);
  const description = clean(String(schema?.description || meta("meta[property='og:description']", "meta[name='description']") || "")).slice(0, 500);
  const yieldValue = schema?.recipeYield ?? propertyText("recipeYield");
  const servings = Array.isArray(yieldValue) ? String(yieldValue[0] ?? "") : String(yieldValue);
  const totalTime = schema?.totalTime ?? propertyText("totalTime");
  const schemaImage = imageFromValue(schema?.image, sourceUrl);
  const ogImage = imageFromValue(meta("meta[property='og:image:secure_url']", "meta[property='og:image']", "meta[name='twitter:image']"), sourceUrl);
  const principalImages = fallbackRoot.find("img").toArray().map((image) => {
    const node = $(image);
    const srcset = node.attr("data-srcset") ?? node.attr("srcset") ?? "";
    const srcsetImages = srcset.split(",").map((candidate) => {
      const [url, descriptor = ""] = candidate.trim().split(/\s+/);
      return { url, width: Number(descriptor.match(/(\d+)w/)?.[1] ?? 0) };
    }).filter((candidate) => candidate.url).sort((left, right) => right.width - left.width);
    const fromSrcset = srcsetImages.map((candidate) => imageFromValue(candidate.url, sourceUrl)).find(Boolean);
    const raw = node.attr("data-src") ?? node.attr("data-lazy-src") ?? node.attr("src") ?? "";
    return fromSrcset ?? imageFromValue(raw, sourceUrl);
  }).filter((image): image is string => Boolean(image));
  const imageDimensions = (value: string) => {
    try {
      const url = new URL(value);
      const resize = url.searchParams.get("resize")?.match(/(\d{2,5})[,x](\d{2,5})/);
      const pathSize = value.match(/(?:^|\/)(\d{2,5})x(\d{2,5})(?:\/|\.|$)/);
      const width = Number(resize?.[1] ?? url.searchParams.get("width") ?? url.searchParams.get("w") ?? pathSize?.[1] ?? 0);
      const height = Number(resize?.[2] ?? url.searchParams.get("height") ?? pathSize?.[2] ?? 0);
      return { width, height };
    } catch {
      return { width: 0, height: 0 };
    }
  };
  const isHeroCandidate = (value: string) => {
    const path = new URL(value).pathname.toLowerCase();
    if (/(logo|sprite|avatar|profile|icon|brand)/.test(path)) return false;
    const { width, height } = imageDimensions(value);
    const ratio = width && height ? width / height : 1;
    return ratio >= 0.45 && ratio <= 2.8;
  };
  const imageWidth = (value: string) => imageDimensions(value).width;
  const principalImage = principalImages.filter(isHeroCandidate).sort((left, right) => imageWidth(right) - imageWidth(left))[0];
  const imageCandidates = [
    { url: ogImage, priority: 850 },
    { url: schemaImage, priority: 825 },
    { url: principalImage, priority: 900 },
  ].filter((candidate): candidate is { url: string; priority: number } => candidate.url !== undefined && isHeroCandidate(candidate.url));
  const heroImage = imageCandidates.sort((left, right) => (imageWidth(right.url) || right.priority) - (imageWidth(left.url) || left.priority))[0]?.url;
  if (!name || ingredients.length === 0) throw new Error("No recipe title or ingredients were found on that page");
  return {
    name,
    note: description,
    ingredients: ingredients.map((item) => clean(item).slice(0, 400)).filter(Boolean).slice(0, 100),
    steps: steps.map((step) => clean(step).slice(0, 1200)).filter(Boolean).slice(0, 100),
    minutes: parseDuration(totalTime),
    servings: clean(servings).slice(0, 80) || undefined,
    image: heroImage,
    sourceUrl,
  };
}

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get("url") ?? "";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    validateTarget(sourceUrl);
    const controller = new AbortController();
    const timeoutRequest = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("The recipe page timed out"));
      }, FETCH_TIMEOUT_MS);
    });
    const { html, url } = await Promise.race([fetchHtml(sourceUrl, controller.signal), timeoutRequest]);
    const recipe = parseRecipe(html, url);
    const cacheControl = process.env.NODE_ENV === "development" ? "no-store" : "public, max-age=0, s-maxage=900, stale-while-revalidate=3600";
    return Response.json(recipe, { headers: { "Cache-Control": cacheControl } });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "The recipe page timed out" : error instanceof Error ? error.message : "Recipe extraction failed";
    return Response.json({ error: message }, { status: 422, headers: { "Cache-Control": "no-store" } });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}