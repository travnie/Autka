import { describe, expect, it, vi } from "vitest";
import { buildTavilyPlRequest, decodeTavilyPlResults } from "../src/search/tavily";
import { searchPlPreviews, type PreviewDispatch } from "../src/search/transport";

const offer = "https://www.otomoto.pl/osobowe/oferta/lexus-es-ID6Ijx6V.html";
const listing = { url: offer, title: "Lexus ES", content: "Indexed preview" };
const keys = { brave: "test-brave-key", tavily: "test-tavily-key" };
const json = (value: unknown) => Response.json(value);

describe("Tavily indexed search", () => {
  it("uses basic scoped POST without higher-cost or full-content options", async () => {
    const request = buildTavilyPlRequest("Lexus ES OR -foo", keys.tavily);
    if (!request) throw new Error("expected request");
    expect(request.url).toBe("https://api.tavily.com/search");
    expect(request.method).toBe("POST");
    expect(request.redirect).toBe("manual");
    expect(request.headers.get("Authorization")).toBe(`Bearer ${keys.tavily}`);
    expect(await request.json()).toMatchObject({
      query: "Lexus ES foo",
      search_depth: "basic",
      auto_parameters: false,
      include_domains: ["otomoto.pl", "olx.pl"],
      include_domains_mode: "restrict",
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      max_results: 20,
    });
    expect(buildTavilyPlRequest("Lexus", "bad\nkey")).toBeNull();
  });

  it("maps only individual allowed listing URLs and deduplicates IDs", () => {
    expect(decodeTavilyPlResults({ results: [
      listing, { ...listing, url: offer + "?utm_source=test" },
      { ...listing, url: "https://otomoto.pl/osobowe/lexus" },
      { ...listing, url: "https://evil.test/osobowe/oferta/lexus-ID1.html" },
    ] })).toEqual([{
      url: offer, title: listing.title, snippet: listing.content, provider: "tavily", marketplace: "otomoto",
    }]);
    expect(() => decodeTavilyPlResults({ error: "quota" })).toThrow("invalid_tavily_response");
    expect(decodeTavilyPlResults({ results: [
      { ...listing, title: "Lexus" + String.fromCharCode(0, 31, 127) + "ES" },
    ] })[0].title).toBe("Lexus ES");
  });
});

describe("provider fallback transport", () => {
  it("tries Tavily after a denied or unsuccessful Brave attempt", async () => {
    for (const denied of [null, new Response(null, { status: 429 }), new Response(null, { status: 302 })]) {
      const called: string[] = [];
      const dispatch: PreviewDispatch = async (provider, request, signal) => {
        called.push(provider);
        expect(request.redirect).toBe("manual");
        expect(signal.aborted).toBe(false);
        return provider === "brave" ? denied : json({ results: [listing] });
      };
      expect(await searchPlPreviews("Lexus", keys, dispatch)).toMatchObject({
        status: "ok", provider: "tavily", previews: [{ url: offer }],
      });
      expect(called).toEqual(["brave", "tavily"]);
    }
  });

  it("does not fall back on a valid empty Brave response", async () => {
    const called: string[] = [];
    const dispatch: PreviewDispatch = async provider => {
      called.push(provider);
      return json({ type: "search", web: { results: [] } });
    };
    expect(await searchPlPreviews("Lexus", keys, dispatch)).toEqual({
      status: "ok", provider: "brave", previews: [],
    });
    expect(called).toEqual(["brave"]);
  });

  it("times out an unresponsive dispatcher and falls back", async () => {
    let aborted = false;
    const dispatch: PreviewDispatch = async (provider, _request, signal) => {
      if (provider === "tavily") return json({ results: [listing] });
      signal.addEventListener("abort", () => { aborted = true; }, { once: true });
      return new Promise<Response>(() => {});
    };
    expect(await searchPlPreviews("Lexus", keys, dispatch)).toMatchObject({
      status: "ok", provider: "tavily",
    });
    expect(aborted).toBe(true);
  }, 10000);

  it("disposes a response that arrives after the attempt deadline", async () => {
    let cancelled = false;
    let complete: ((response: Response) => void) | undefined;
    const dispatch: PreviewDispatch = async provider => {
      if (provider === "tavily") return json({ results: [listing] });
      return new Promise<Response>(resolve => { complete = resolve; });
    };
    expect(await searchPlPreviews("Lexus", keys, dispatch)).toMatchObject({
      status: "ok", provider: "tavily",
    });
    const body = new ReadableStream<Uint8Array>({
      cancel() { cancelled = true; },
    });
    complete?.(new Response(body));
    await vi.waitFor(() => expect(cancelled).toBe(true));
  }, 10000);

  it("times out a stalled response body and cancels the reader", async () => {
    let cancelled = false;
    const dispatch: PreviewDispatch = async provider => {
      if (provider === "tavily") return json({ results: [listing] });
      const body = new ReadableStream<Uint8Array>({
        cancel() { cancelled = true; },
      });
      return new Response(body, { headers: { "Content-Type": "application/json" } });
    };
    expect(await searchPlPreviews("Lexus", keys, dispatch)).toMatchObject({
      status: "ok", provider: "tavily",
    });
    expect(cancelled).toBe(true);
  }, 10000);

  it("never dispatches unconfigured providers or empty queries", async () => {
    const dispatch: PreviewDispatch = async () => { throw new Error("unexpected dispatch"); };
    let attempts = 0;
    const count: PreviewDispatch = async (...args) => { attempts++; return dispatch(...args); };
    expect(await searchPlPreviews("Lexus", {}, count)).toEqual({ status: "unavailable" });
    expect(await searchPlPreviews("OR", keys, count)).toEqual({ status: "invalid_query" });
    expect(attempts).toBe(0);
  });

  it("rejects oversized and malformed JSON, then falls back", async () => {
    for (const response of [
      new Response("x".repeat(300000), { headers: { "Content-Type": "application/json" } }),
      new Response("{", { headers: { "Content-Type": "application/json" } }),
      new Response("{}", { headers: { "Content-Type": "text/html" } }),
      new Response(new Uint8Array([123, 125])),
    ]) {
      const dispatch: PreviewDispatch = async provider =>
        provider === "brave" ? response : json({ results: [listing] });
      expect(await searchPlPreviews("Lexus", keys, dispatch)).toMatchObject({
        status: "ok", provider: "tavily",
      });
    }
  });
});
