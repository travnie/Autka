import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { reserveSearchBudget } from "../src/search/budget";

describe("search budget", () => {
  it("reserves concurrent calls without crossing the cap", async () => {
    const now = new Date("2040-01-15T12:00:00Z");
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      reserveSearchBudget(env.DB, "brave", 7, 1, now),
    ));
    const granted = results.filter(result => result !== null);
    expect(granted).toHaveLength(7);
    expect(granted.map(result => result.used).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await reserveSearchBudget(env.DB, "brave", 7, 1, now)).toBeNull();
  });

  it("isolates providers and rolls over at UTC month boundary", async () => {
    const last = new Date("2040-02-29T23:59:59.999Z");
    const next = new Date("2040-03-01T00:00:00.000Z");
    expect(await reserveSearchBudget(env.DB, "brave", 1, 1, last)).toEqual({ used: 1, remaining: 0 });
    expect(await reserveSearchBudget(env.DB, "brave", 1, 1, last)).toBeNull();
    expect(await reserveSearchBudget(env.DB, "tavily", 1, 1, last)).toEqual({ used: 1, remaining: 0 });
    expect(await reserveSearchBudget(env.DB, "brave", 1, 1, next)).toEqual({ used: 1, remaining: 0 });
  });

  it("supports weighted reservations and reduced caps", async () => {
    const now = new Date("2040-04-01T00:00:00Z");
    expect(await reserveSearchBudget(env.DB, "tavily", 10, 4, now)).toEqual({ used: 4, remaining: 6 });
    expect(await reserveSearchBudget(env.DB, "tavily", 3, 1, now)).toBeNull();
    expect(await reserveSearchBudget(env.DB, "tavily", 10, 7, now)).toBeNull();
    expect(await reserveSearchBudget(env.DB, "tavily", 10, 6, now)).toEqual({ used: 10, remaining: 0 });
  });

  it("rejects invalid, disabled and above-ceiling budgets", async () => {
    const now = new Date("2040-05-01T00:00:00Z");
    for (const limit of [0, -1, 1.5, 1001, Infinity, NaN]) {
      expect(await reserveSearchBudget(env.DB, "brave", limit, 1, now)).toBeNull();
    }
    for (const units of [0, -1, 1.5, 11, Infinity]) {
      expect(await reserveSearchBudget(env.DB, "brave", 10, units, now)).toBeNull();
    }
    expect(await reserveSearchBudget(env.DB, "brave", 10, 1, new Date(NaN))).toBeNull();
    expect(await reserveSearchBudget(env.DB, "brave", 10, 1, now)).toEqual({ used: 1, remaining: 9 });
  });
});
