import { isIP } from "node:net";
import { Hono } from "hono";
import { readBodyUpTo } from "../lib/body";
import { createBudgetedDispatch } from "../search/dispatch";
import { boundedTerms, normalizedKey, record } from "../search/preview";
import { searchPlPreviews } from "../search/transport";

interface SearchEnv {
  DB: D1Database;
  ENABLE_INDEXED_SEARCH?: string;
  BSAS_API_KEY?: string;
  TAVILY_API_KEY?: string;
  SEARCH_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

const MAX_REQUEST_BYTES = 1024;
const RATE_LIMIT_WINDOW_SECONDS = 60;
type Send = (request: Request, init: RequestInit) => Promise<Response>;

export function createSearchRouter(send?: Send, now?: () => Date) {
  const router = new Hono<{ Bindings: SearchEnv }>();

  router.post("/search/previews", async (c) => {
    c.header("Cache-Control", "no-store");
    const env = c.env;
    if (env.ENABLE_INDEXED_SEARCH !== "true") {
      return c.json({ status: "unavailable" }, 503);
    }
    if (!env.SEARCH_RATE_LIMITER) {
      console.warn("indexed_search_limiter_missing");
      return c.json({ status: "unavailable" }, 503);
    }
    const keys = {
      brave: normalizedKey(env.BSAS_API_KEY ?? "") ?? undefined,
      tavily: normalizedKey(env.TAVILY_API_KEY ?? "") ?? undefined,
    };
    if (!keys.brave && !keys.tavily) {
      console.warn("indexed_search_keys_missing");
      return c.json({ status: "unavailable" }, 503);
    }

    const client = c.req.header("CF-Connecting-IP");
    if (!client || client.length > 64 || isIP(client) === 0) {
      return c.json({ status: "unavailable" }, 503);
    }
    let stage = "rate_limit";
    try {
      const allowed = await env.SEARCH_RATE_LIMITER.limit({ key: client });
      if (!allowed.success) {
        c.header("Retry-After", String(RATE_LIMIT_WINDOW_SECONDS));
        return c.json({ status: "rate_limited" }, 429);
      }

      stage = "request_validation";
      const type = c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase();
      const declared = Number(c.req.header("Content-Length") ?? 0);
      if (type !== "application/json") return c.json({ status: "invalid_query" }, 415);
      if (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_REQUEST_BYTES) {
        return c.json({ status: "invalid_query" }, 413);
      }
      const body = c.req.raw.body;
      if (!body) return c.json({ status: "invalid_query" }, 400);
      let payload: Record<string, unknown> | null;
      try {
        const bytes = await readBodyUpTo(body, MAX_REQUEST_BYTES, AbortSignal.timeout(5000));
        if (!bytes) return c.json({ status: "invalid_query" }, 413);
        payload = record(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)) as unknown);
      } catch {
        return c.json({ status: "invalid_query" }, 400);
      }
      if (payload?.region !== "PL" || typeof payload.query !== "string" ||
          payload.query.length > 256 || !boundedTerms(payload.query)) {
        return c.json({ status: "invalid_query" }, 400);
      }

      stage = "search";
      const result = await searchPlPreviews(payload.query, keys, createBudgetedDispatch(env.DB, send, now));
      if (result.status === "ok") return c.json(result);
      if (result.status === "invalid_query") return c.json(result, 400);
      return c.json(result, 503);
    } catch {
      console.warn(JSON.stringify({ msg: "indexed_search_unavailable", stage }));
      return c.json({ status: "unavailable" }, 503);
    }
  });

  return router;
}

export const searchRouter = createSearchRouter();
