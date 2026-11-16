import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBudgetedDispatch } from "../src/search/dispatch";

const brave = () => new Request("https://api.search.brave.com/res/v1/web/search?q=Lexus", { redirect: "manual" });
const tavily = () => new Request("https://api.tavily.com/search", { method: "POST", redirect: "manual" });
const signal = () => new AbortController().signal;

async function setLimit(provider: "brave" | "tavily", cap: number) {
  await env.DB.prepare(
    "INSERT INTO search_provider_limits (provider, monthly_limit) VALUES (?, ?)",
  ).bind(provider, cap).run();
}

describe("budget-gated dispatch", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM search_budgets"),
      env.DB.prepare("DELETE FROM search_provider_limits"),
    ]);
  });

  it("never sends when a provider has no configured cap", async () => {
    const send = vi.fn(async () => Response.json({}));
    const dispatch = createBudgetedDispatch(env.DB, send);
    expect(await dispatch("brave", brave(), signal())).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("reserves each attempt including failures; providers have separate caps", async () => {
    await setLimit("brave", 1);
    await setLimit("tavily", 1);
    const send = vi.fn(async (_request: Request, _init: RequestInit) => new Response(null, { status: 429 }));
    const dispatch = createBudgetedDispatch(env.DB, send);
    const abort = signal();
    expect((await dispatch("brave", brave(), abort))?.status).toBe(429);
    expect(await dispatch("brave", brave(), signal())).toBeNull();
    expect((await dispatch("tavily", tavily(), signal()))?.status).toBe(429);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1]).toEqual({ signal: abort, redirect: "manual" });
  });

  it("rejects foreign destinations, wrong methods, redirects and aborted calls without using quota", async () => {
    await setLimit("brave", 1);
    const send = vi.fn(async (_request: Request, _init: RequestInit) => Response.json({}));
    const dispatch = createBudgetedDispatch(env.DB, send);
    for (const request of [
      new Request("https://evil.test/res/v1/web/search", { redirect: "manual" }),
      new Request("https://api.search.brave.com/other", { redirect: "manual" }),
      new Request("https://api.search.brave.com/res/v1/web/search", { method: "POST", redirect: "manual" }),
      new Request("https://api.search.brave.com/res/v1/web/search", { redirect: "follow" }),
      tavily(),
    ]) {
      expect(await dispatch("brave", request, signal())).toBeNull();
    }
    const controller = new AbortController();
    controller.abort();
    expect(await dispatch("brave", brave(), controller.signal)).toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect((await dispatch("brave", brave(), signal()))?.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not refund an attempt that throws", async () => {
    await setLimit("brave", 1);
    const send = vi.fn(async () => { throw new Error("network_failure"); });
    const dispatch = createBudgetedDispatch(env.DB, send);
    await expect(dispatch("brave", brave(), signal())).rejects.toThrow("network_failure");
    expect(await dispatch("brave", brave(), signal())).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
