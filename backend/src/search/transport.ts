import { readBodyUpTo } from "../lib/body";
import { buildBravePlRequest, decodeBravePlResults } from "./brave";
import { boundedTerms, type IndexedPreview } from "./preview";
import { buildTavilyPlRequest, decodeTavilyPlResults } from "./tavily";

type Provider = IndexedPreview["provider"];
type SearchKeys = Partial<Record<Provider, string>>;

// Required dispatcher: reserve quota and validate current period before fetch.
// No default unrestricted network path. Null means unavailable or denied.
export type PreviewDispatch = (provider: Provider, request: Request, signal: AbortSignal) => Promise<Response | null>;

export type PreviewSearchResult =
  | { status: "ok"; provider: Provider; previews: IndexedPreview[] }
  | { status: "invalid_query" | "unavailable" };

const TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 256 * 1024;

const PROVIDERS = [
  { name: "brave", build: buildBravePlRequest, decode: decodeBravePlResults },
  { name: "tavily", build: buildTavilyPlRequest, decode: decodeTavilyPlResults },
] as const;

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("provider_unavailable");
  }
  const contentType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  const declared = Number(response.headers.get("Content-Length") ?? 0);
  if (contentType !== "application/json" || declared > MAX_BODY_BYTES) {
    await response.body.cancel();
    throw new Error("invalid_provider_body");
  }
  const body = await readBodyUpTo(response.body, MAX_BODY_BYTES);
  if (!body) throw new Error("provider_body_too_large");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(body)) as unknown;
}

/** Sequential fallback; a successful empty set is authoritative for that attempt. */
export async function searchPlPreviews(
  input: string,
  keys: SearchKeys,
  dispatch: PreviewDispatch,
): Promise<PreviewSearchResult> {
  if (!boundedTerms(input)) return { status: "invalid_query" };

  for (const provider of PROVIDERS) {
    const request = provider.build(input, keys[provider.name] ?? "");
    if (!request) continue;
    try {
      const response = await dispatch(provider.name, request, AbortSignal.timeout(TIMEOUT_MS));
      if (!response) continue;
      const previews = provider.decode(await readJson(response));
      return { status: "ok", provider: provider.name, previews };
    } catch {
      // No raw provider errors, query or credential logging. No retry/fan-out.
    }
  }
  return { status: "unavailable" };
}
