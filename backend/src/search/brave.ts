import { boundedTerms, decodePlRows, MAX_RESULTS, normalizedKey, PL_TARGETS, record, type IndexedPreview } from "./preview";

export function buildBravePlRequest(input: string, apiKey: string): Request | null {
  const terms = boundedTerms(input);
  const key = normalizedKey(apiKey);
  if (!terms || !key) return null;
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

export function decodeBravePlResults(payload: unknown): IndexedPreview[] {
  const root = record(payload);
  if (!root || root.type !== "search") throw new Error("invalid_brave_response");
  if (root.web === undefined) return [];
  const web = record(root.web);
  if (!Array.isArray(web?.results)) throw new Error("invalid_brave_response");

  return decodePlRows(web.results, "brave", row => row.description);
}
