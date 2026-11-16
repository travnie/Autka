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
 * D1 failures propagate; the transport handles fallback.
 */
export function createBudgetedDispatch(db: D1Database, send: Send = fetch) {
  return async (
    provider: SearchProvider,
    request: Request,
    signal: AbortSignal,
  ): Promise<Response | null> => {
    if (signal.aborted || !isProviderRequest(provider, request)) return null;
    const reservation = await reserveSearchBudget(db, provider);
    if (!reservation || signal.aborted || !isCurrentReservation(reservation)) return null;
    return send(request, { signal, redirect: "manual" });
  };
}
