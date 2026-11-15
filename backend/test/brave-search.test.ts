import { describe, expect, it } from "vitest";
import { buildBravePlRequest, decodeBravePlResults } from "../src/search/brave";

const offer = "https://www.otomoto.pl/osobowe/oferta/lexus-es-ID6Ijx6V.html";
const olx = "https://www.olx.pl/d/oferta/lexus-es-CID5-ID1cerhQ.html";
const row = (url: string) => ({ url, title: "Lexus ES", description: "Indexed snippet" });
const payload = (...results: unknown[]) => ({ type: "search", web: { results } });

describe("Brave PL search previews", () => {
  it("builds a fixed scoped request without user operators or URL credentials", () => {
    const request = buildBravePlRequest("Lexus ES OR site:evil.test -foo", "test-key")!;
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe("https://api.search.brave.com/res/v1/web/search");
    expect(url.searchParams.get("q")).toBe(
      "Lexus ES site evil test foo site:otomoto.pl/osobowe/oferta/ OR Lexus ES site evil test foo site:olx.pl/d/oferta/",
    );
    expect(request.headers.get("X-Subscription-Token")).toBe("test-key");
    expect(request.url).not.toContain("test-key");
    expect(request.redirect).toBe("manual");
    expect(buildBravePlRequest("Lexus", "  test-key  ")?.headers.get("X-Subscription-Token")).toBe("test-key");
    expect(buildBravePlRequest("Lexus", "bad\nkey")).toBeNull();
    expect(buildBravePlRequest("OR !", "test-key")).toBeNull();
    expect(buildBravePlRequest("Lexus", "")).toBeNull();
  });

  it("accepts only known car listing paths and deduplicates native ids", () => {
    expect(decodeBravePlResults(payload(
      row(offer + "?utm_source=search#photos"),
      row(offer + "?other=1"),
      row(olx),
      row("https://www.otomoto.pl/osobowe/lexus/es"),
      row("https://otomoto.pl.evil.test/osobowe/oferta/car-ID1.html"),
      row("https://www.olx.pl/d/oferta/phone-CID99-ID123.html"),
      row("https://example.test@" + new URL(offer).host + new URL(offer).pathname),
      row(offer.replace("https:", "http:")),
      row(offer.replace("https://", "https://user:pass@")),
      row(offer.replace("www.otomoto.pl", "www.otomoto.pl:8443")),
      { url: offer.replace("ID6Ijx6V", "ID12345"), title: null },
    ))).toEqual([
      { title: "Lexus ES", url: offer + "?utm_source=search", marketplace: "otomoto", provider: "brave", snippet: "Indexed snippet" },
      { title: "Lexus ES", url: olx, marketplace: "olx", provider: "brave", snippet: "Indexed snippet" },
    ]);
  });

  it("bounds query terms and result count", () => {
    const req = buildBravePlRequest("a b c d e f g h i", "test-key")!;
    expect(new URL(req.url).searchParams.get("q")).toContain("a b c d e f site:");
    const long = buildBravePlRequest("x".repeat(50) + " Lexus", "test-key")!;
    expect(new URL(long.url).searchParams.get("q")).toContain("Lexus site:");
    expect(decodeBravePlResults(payload(...Array.from({ length: 25 }, (_, i) =>
      row(offer.replace("ID6Ijx6V", "ID" + i)),
    )))).toHaveLength(20);
  });

  it("bounds text without splitting Unicode code points", () => {
    const result = decodeBravePlResults(payload({
      url: offer, title: "a".repeat(199) + "🚗" + "b",
      description: "🚗".repeat(10000),
    }))[0];
    expect(result.title).toBe("a".repeat(199) + "🚗");
    expect(Array.from(result.snippet)).toHaveLength(500);
  });

  it("distinguishes empty results from malformed responses", () => {
    expect(decodeBravePlResults({ type: "search" })).toEqual([]);
    expect(decodeBravePlResults(payload())).toEqual([]);
    expect(() => decodeBravePlResults({ error: "quota" })).toThrow("invalid_brave_response");
    expect(() => decodeBravePlResults({ type: "search", web: {} })).toThrow("invalid_brave_response");
  });
});
