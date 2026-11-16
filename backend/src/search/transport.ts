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

function discardBody(response: Response): void {
  // Cancellation may wait on an uncooperative source. Never block fallback on it.
  void response.body?.cancel().catch(() => {});
}

function dispatchUntilAbort(
  dispatch: PreviewDispatch,
  provider: Provider,
  request: Request,
  signal: AbortSignal,
): Promise<Response | null> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new Error("provider_timeout"));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });

    // Handle late resolution/rejection even after timeout.
    void Promise.resolve().then(() => {
      if (signal.aborted) return null;
      return dispatch(provider, request, signal);
    }).then(response => {
      if (signal.aborted) {
        if (response) discardBody(response);
        abort();
      } else {
        signal.removeEventListener("abort", abort);
        resolve(response);
      }
    }, error => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.ok || !response.body) {
    discardBody(response);
    throw new Error("provider_unavailable");
  }
  const contentType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  const declared = Number(response.headers.get("Content-Length") ?? 0);
  if (contentType !== "application/json" || declared > MAX_BODY_BYTES) {
    discardBody(response);
    throw new Error("invalid_provider_body");
  }
  const body = await readBodyUpTo(response.body, MAX_BODY_BYTES, signal);
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let stage = "dispatch";
    try {
      const response = await dispatchUntilAbort(dispatch, provider.name, request, controller.signal);
      if (!response) continue;
      stage = "response";
      const payload = await readJson(response, controller.signal);
      stage = "decode";
      const previews = provider.decode(payload);
      return { status: "ok", provider: provider.name, previews };
    } catch {
      // Fixed diagnostic fields only. No raw provider errors, queries or credentials.
      console.warn(JSON.stringify({
        msg: "search_provider_failed",
        provider: provider.name,
        stage: controller.signal.aborted ? "timeout" : stage,
      }));
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: "unavailable" };
}
