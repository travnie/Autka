import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSearchRouter } from "../src/routes/search";

const url = "https://www.otomoto.pl/osobowe/oferta/lexus-es-ID6Ijx6V.html";
const input = { region: "PL", query: "Lexus ES" };
const send = vi.fn(async () => Response.json({ type: "search", web: { results: [
  { url, title: "Lexus ES", description: "Indexed preview" },
] } }));
const rate = vi.fn(async () => ({ success: true }));
const bindings = () => ({
  DB: env.DB,
  ENABLE_INDEXED_SEARCH: "true",
  BSAS_API_KEY: "fixture-brave-key",
  TAVILY_API_KEY: "fixture-tavily-key",
  SEARCH_RATE_LIMITER: { limit: rate },
});
const router = createSearchRouter(send, () => new Date("2041-01-15T12:00:00Z"));
function call(body: unknown = input, overrides: Partial<ReturnType<typeof bindings>> = {}, ip = "192.0.2.1") {
  return router.request("/search/previews", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  }, { ...bindings(), ...overrides });
}
async function cap(provider: "brave" | "tavily") {
  await env.DB.prepare("INSERT INTO search_provider_limits (provider, monthly_limit) VALUES (?, 1)")
    .bind(provider).run();
}

describe("indexed search endpoint", () => {
  beforeEach(async () => {
    send.mockClear();
    rate.mockReset();
    rate.mockResolvedValue({ success: true });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM search_budgets"),
      env.DB.prepare("DELETE FROM search_provider_limits"),
    ]);
  });

  it("fails closed without enable flag, limiter, credentials or client IP", async () => {
    for (const overrides of [
      { ENABLE_INDEXED_SEARCH: "false" },
      { SEARCH_RATE_LIMITER: undefined },
      { BSAS_API_KEY: "", TAVILY_API_KEY: "" },
    ]) expect((await call(input, overrides)).status).toBe(503);
    expect((await call(input, {}, "")).status).toBe(503);
    expect((await call(input, {}, "bad:ip")).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects invalid requests and limits clients before dispatch", async () => {
    expect((await call({ region: "EU", query: "Lexus" })).status).toBe(400);
    expect((await call({ region: "PL", query: "OR" })).status).toBe(400);
    expect((await call({ region: "PL", query: "x".repeat(1024) })).status).toBe(413);
    rate.mockResolvedValueOnce({ success: false });
    const blocked = await call();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(send).not.toHaveBeenCalled();
  });

  it("uses the atomic budget and serves only uncached indexed previews", async () => {
    expect((await call()).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
    await cap("brave");
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok", provider: "brave", previews: [
        { url, title: "Lexus ES", snippet: "Indexed preview", marketplace: "otomoto", provider: "brave" },
      ],
    });
    expect((await call()).status).toBe(503);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
