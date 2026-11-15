import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { isCurrentReservation, reserveSearchBudget, type SearchProvider } from "../src/search/budget";

async function setLimit(provider: SearchProvider, limit: number) {
  await env.DB.prepare(
    "INSERT INTO search_provider_limits (provider, monthly_limit) VALUES (?, ?) ON CONFLICT(provider) DO UPDATE SET monthly_limit = excluded.monthly_limit",
  ).bind(provider, limit).run();
}

describe("search budget", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM search_budgets"),
      env.DB.prepare("DELETE FROM search_provider_limits"),
    ]);
  });

  it("reserves concurrent calls without crossing the cap", async () => {
    await setLimit("brave", 7);
    const now = new Date("2040-01-15T12:00:00Z");
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      reserveSearchBudget(env.DB, "brave", 1, now),
    ));
    const granted = results.filter(result => result !== null);
    expect(granted).toHaveLength(7);
    expect(granted.map(result => result.used).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await reserveSearchBudget(env.DB, "brave", 1, now)).toBeNull();
  });

  it("shares monthly quota across days; isolates providers and rolls over", async () => {
    await setLimit("brave", 1);
    await setLimit("tavily", 1);
    const first = new Date("2040-02-01T00:00:00Z");
    const last = new Date("2040-02-29T23:59:59.999Z");
    const next = new Date("2040-03-01T00:00:00.000Z");
    expect(await reserveSearchBudget(env.DB, "brave", 1, first)).toEqual({ month: "2040-02", used: 1, remaining: 0 });
    expect(await reserveSearchBudget(env.DB, "brave", 1, last)).toBeNull();
    const reservation = await reserveSearchBudget(env.DB, "tavily", 1, last);
    expect(reservation).toEqual({ month: "2040-02", used: 1, remaining: 0 });
    if (!reservation) throw new Error("expected reservation");
    expect(isCurrentReservation(reservation, last)).toBe(true);
    expect(isCurrentReservation(reservation, next)).toBe(false);
    expect(await reserveSearchBudget(env.DB, "brave", 1, next)).toEqual({ month: "2040-03", used: 1, remaining: 0 });
  });

  it("honors canonical cap changes and weighted reservations", async () => {
    const now = new Date("2040-04-01T00:00:00Z");
    await setLimit("tavily", 10);
    expect(await reserveSearchBudget(env.DB, "tavily", 4, now)).toEqual({ month: "2040-04", used: 4, remaining: 6 });
    await setLimit("tavily", 3);
    expect(await reserveSearchBudget(env.DB, "tavily", 1, now)).toBeNull();
    await setLimit("tavily", 10);
    expect(await reserveSearchBudget(env.DB, "tavily", 7, now)).toBeNull();
    expect(await reserveSearchBudget(env.DB, "tavily", 6, now)).toEqual({ month: "2040-04", used: 10, remaining: 0 });
  });

  it("rejects missing/disabled caps and invalid units", async () => {
    const now = new Date("2040-05-01T00:00:00Z");
    expect(await reserveSearchBudget(env.DB, "brave", 1, now)).toBeNull();
    await setLimit("brave", 0);
    expect(await reserveSearchBudget(env.DB, "brave", 1, now)).toBeNull();
    await expect(setLimit("brave", 1001)).rejects.toThrow();
    await setLimit("brave", 10);
    for (const units of [0, -1, 1.5, 11, Infinity]) {
      expect(await reserveSearchBudget(env.DB, "brave", units, now)).toBeNull();
    }
    expect(await reserveSearchBudget(env.DB, "brave", 1, new Date(NaN))).toBeNull();
    expect(await reserveSearchBudget(env.DB, "brave", 1, now)).toEqual({ month: "2040-05", used: 1, remaining: 9 });
  });
});
