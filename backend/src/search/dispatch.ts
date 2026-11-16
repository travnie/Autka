import { isCurrentReservation, reserveSearchBudget, type SearchProvider } from "./budget";

// Conservative guard against requests crossing the UTC accounting boundary.
const MONTH_END_GUARD_MS = 60_000;

function nearMonthEnd(now: Date): boolean {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return next - now.getTime() <= MONTH_END_GUARD_MS;
}

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
 * Caller must supply a deadline signal covering reservation, fetch and body read.
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
      console.warn(JSON.stringify({ msg: "search_dispatch_denied", provider, reason: "reservation_denied" }));
      return null;
    }
    const current = now();
    if (signal.aborted || !isCurrentReservation(reservation, current) || nearMonthEnd(current)) return null;
    try {
      return await send(request, { signal, redirect: "manual" });
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    }
  };
}
