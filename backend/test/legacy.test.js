import { describe, expect, it, vi } from "vitest";
import legacy from "../legacy/index.js";

describe("legacy adapter", () => {
  it("passes the original request and upstream response through unchanged", async () => {
    const request = new Request("https://cargate-backend.travny.workers.dev/offers?limit=1");
    const response = Response.json({ offers: [], count: 0 });
    const fetch = vi.fn(async () => response);

    expect(await legacy.fetch(request, { API: { fetch } })).toBe(response);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(request);
  });

  it("fails closed when the service binding is unavailable", async () => {
    const request = new Request("https://cargate-backend.travny.workers.dev/health");
    const response = await legacy.fetch(request, {});
    expect(response.status).toBe(503);
  });
});
