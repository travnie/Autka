import { boundedTerms, decodePlRows, MAX_RESULTS, normalizedKey, PL_TARGETS, record, type IndexedPreview } from "./preview";

export function buildTavilyPlRequest(input: string, apiKey: string): Request | null {
  const terms = boundedTerms(input);
  const key = normalizedKey(apiKey);
  if (!terms || !key) return null;

  return new Request("https://api.tavily.com/search", {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: terms,
      topic: "general",
      search_depth: "basic",
      auto_parameters: false,
      include_domains: PL_TARGETS.map(({ scope }) => scope.split("/")[0]),
      include_domains_mode: "restrict",
      max_results: MAX_RESULTS,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
  });
}

export function decodeTavilyPlResults(payload: unknown): IndexedPreview[] {
  const root = record(payload);
  if (!Array.isArray(root?.results)) throw new Error("invalid_tavily_response");
  return decodePlRows(root.results, "tavily", "content");
}
