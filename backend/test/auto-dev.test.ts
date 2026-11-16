import { describe, expect, it } from "vitest";
import { buildAutoDevEvaluationRequest, decodeAutoDevEvaluation } from "../src/search/auto-dev";

const fixture = {
  "vehicle.vin": "1ABCDEF2345678901",
  "vehicle.make": "Lexus",
  "vehicle.model": "ES 300h",
  "vehicle.year": 2022,
  "retailListing.price": 29000,
  "retailListing.vdp": "https://dealer.example/vehicle/1",
};

describe("Auto.dev internal evaluation", () => {
  it("builds one projected used-vehicle page with server bearer auth", () => {
    const request = buildAutoDevEvaluationRequest({ make: "Lexus", model: "ES 300h" }, "fixture-token");
    if (!request) throw new Error("expected request");
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe("https://api.auto.dev/listings");
    expect(url.searchParams.get("vehicle.make")).toBe("Lexus");
    expect(url.searchParams.get("vehicle.model")).toBe("ES 300h");
    expect(url.searchParams.get("retailListing.used")).toBe("true");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("select")?.split(",")).toEqual([
      "vehicle.vin", "vehicle.make", "vehicle.model", "vehicle.year",
      "retailListing.price", "retailListing.vdp",
    ]);
    expect(request.headers.get("Authorization")).toBe("Bearer fixture-token");
    expect(request.url).not.toContain("fixture-token");
    expect(request.redirect).toBe("manual");
  });

  it("preserves valid model punctuation without adding query parameters", () => {
    const request = buildAutoDevEvaluationRequest({ make: "Chrysler", model: "Town & Country" }, "fixture-token");
    if (!request) throw new Error("expected request");
    const url = new URL(request.url);
    expect(url.searchParams.get("vehicle.model")).toBe("Town & Country");
    expect(decodeAutoDevEvaluation({ data: [
      { ...fixture, "vehicle.make": " Chrysler ", "vehicle.model": " Town & Country " },
    ] })[0]).toMatchObject({ make: "Chrysler", model: "Town & Country" });
    expect(buildAutoDevEvaluationRequest({ make: "Ford", model: "F-150,Mustang" }, "fixture-token")).toBeNull();
  });

  it("rejects multi-make operators and invalid credentials", () => {
    expect(buildAutoDevEvaluationRequest({ make: "Ford,Lexus" }, "fixture-token")).toBeNull();
    expect(buildAutoDevEvaluationRequest({ make: "Lexus", model: "" }, "fixture-token")).toBeNull();
    expect(buildAutoDevEvaluationRequest({ make: "Lexus" }, "bad\nkey")).toBeNull();
    expect(buildAutoDevEvaluationRequest({ make: "Lexus" }, "")).toBeNull();
  });

  it("decodes selected fields and drops duplicate or invalid listing rows", () => {
    expect(decodeAutoDevEvaluation({ data: [
      { ...fixture, "vehicle.make": " Lexus ", "vehicle.model": " ES 300h " }, fixture,
      { ...fixture, "vehicle.vin": "1ABCDEF2345678902", "retailListing.price": 0 },
      { ...fixture, "vehicle.vin": "1ABCDEF2345678903", "retailListing.vdp": "http://dealer.example/vehicle/3" },
      { ...fixture, "vehicle.vin": "1ABCDEF2345678904", "retailListing.vdp": "https://user@dealer.example/vehicle/4" },
    ] })).toEqual([{
      vin: fixture["vehicle.vin"], make: "Lexus", model: "ES 300h", year: 2022,
      priceUsd: 29000, listingUrl: fixture["retailListing.vdp"],
    }]);
    expect(decodeAutoDevEvaluation({ data: [] })).toEqual([]);
    expect(() => decodeAutoDevEvaluation({ error: "quota" })).toThrow("invalid_auto_dev_response");
  });
});
