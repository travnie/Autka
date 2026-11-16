import { isCurrentReservation, reserveSearchBudget, type SearchProvider } from "./budget";

type Send = (request: Request, init: RequestInit) => Promise<Response>;

function isProviderRequest(provider: SearchProvider, request: Request): boolean {
  if (request.redirect !== "manual") return false;
  const url = new URL(request.url);
  if (!url.href.startsWith(url.origin + "/") || url.hash) return false;
  if (provider === "brave") {
    return request.method === "GET" && url.origin === "https://api.search.brave.com" &&
      url.pathname === "/res/v1/web/search";
  }
  return provider === "tavily" && request.method === "POST" &&
    url.href === "https://api.tavily.com/search";
}

/**
 * Reserve one unit before sending a fixed provider request.
 * No retries or refunds. Abort, quota denial and month rollover fail closed.
 * Caller must supply a deadline signal (searchPlPreviews owns the timeout).
 * D1 failures propagate; the transport handles fallback.
 */
export function createBudgetedDispatch(db: D1Database, send: Send = fetch, now = () => new Date()) {
  return async (
    provider: SearchProvider,
    request: Request,
    signal: AbortSignal,
  ): Promise<Response | null> => {
    if (signal.aborted || !isProviderRequest(provider, request)) return null;
    const reservation = await reserveSearchBudget(db, provider, 1, now());
    if (!reservation) {
      console.warn(JSON.stringify({ msg: "search_dispatch_denied", provider, reason: "budget" }));
      return null;
    }
    if (signal.aborted || !isCurrentReservation(reservation, now())) return null;
    try {
      return await send(request, { signal, redirect: "manual" });
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    }
  };
}
