// First slice: PL listing previews only. No route or outbound call until quota guards land.
export interface IndexedPreview {
  title: string;
  url: string;
  marketplace: "otomoto" | "olx";
  provider: "brave";
  snippet: string;
}

const PL_TARGETS = [
  { scope: "otomoto.pl/osobowe/oferta/", marketplace: "otomoto", path: /^\/osobowe\/oferta\/[^/]+-ID([a-zA-Z0-9]+)\.html$/ },
  { scope: "olx.pl/d/oferta/", marketplace: "olx", path: /^\/d\/oferta\/[^/]+-CID5-ID([a-zA-Z0-9]+)\.html$/ },
] as const;

const MAX_RESULTS = 20;

function boundedTerms(input: string): string {
  const words = input.slice(0, 256).match(/[\p{L}\p{N}]+/gu) ?? [];
  const accepted: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (["and", "or", "not"].includes(lower) || seen.has(lower)) continue;
    if ([...accepted, word].join(" ").length > 40) continue;
    accepted.push(word);
    seen.add(lower);
    if (accepted.length === 6) break;
  }
  return accepted.join(" ");
}

export function buildBravePlRequest(input: string, apiKey: string): Request | null {
  const terms = boundedTerms(input);
  const key = apiKey.trim();
  if (!terms || !key || !/^[\x21-\x7e]+$/.test(key)) return null;
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", PL_TARGETS.map(({ scope }) => `${terms} site:${scope}`).join(" OR "));
  url.searchParams.set("country", "PL");
  url.searchParams.set("search_lang", "pl");
  url.searchParams.set("count", String(MAX_RESULTS));
  url.searchParams.set("text_decorations", "false");
  return new Request(url, {
    redirect: "manual",
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const bounded = value.slice(0, max * 4).replace(/\s+/g, " ").trim();
  return Array.from(bounded).slice(0, max).join("").replace(/[\uD800-\uDFFF]/gu, "\uFFFD");
}

function listing(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  // Origin excludes URL userinfo; require it to start the serialized URL.
  if (url.protocol !== "https:" || url.port || !url.href.startsWith(url.origin + "/")) return null;
  const hostname = url.hostname.replace(/^www\./, "");
  const target = PL_TARGETS.find(({ scope }) => scope.split("/")[0] === hostname);
  const id = target?.path.exec(url.pathname)?.[1];
  if (!target || !id) return null;
  url.hash = "";
  return { url: url.href, marketplace: target.marketplace, id: `${target.marketplace}:${id}` };
}

export function decodeBravePlResults(payload: unknown): IndexedPreview[] {
  const root = record(payload);
  if (!root || root.type !== "search") throw new Error("invalid_brave_response");
  if (root.web === undefined) return [];
  const web = record(root.web);
  if (!Array.isArray(web?.results)) throw new Error("invalid_brave_response");

  const seen = new Set<string>();
  const previews: IndexedPreview[] = [];
  for (const item of web.results.slice(0, MAX_RESULTS)) {
    const row = record(item);
    const match = listing(row?.url);
    const title = text(row?.title, 200);
    if (!match || !title || seen.has(match.id)) continue;
    seen.add(match.id);
    previews.push({
      title,
      url: match.url,
      marketplace: match.marketplace,
      provider: "brave",
      snippet: text(row?.description, 500),
    });
  }
  return previews;
}
