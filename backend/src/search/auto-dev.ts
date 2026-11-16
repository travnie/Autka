// Internal Auto.dev v2 evaluation only. No fetch, production route or persistence.
// See docs/DATA_SOURCES.md for licensing gate.
export interface AutoDevFilter {
  make: string;
  model?: string;
}

export interface AutoDevEvaluationListing {
  vin: string;
  make: string;
  model: string;
  year: number;
  priceUsd: number;
  listingUrl: string;
}

const LIMIT = 20;
const FIELDS = [
  "vehicle.vin", "vehicle.make", "vehicle.model", "vehicle.year",
  "retailListing.price", "retailListing.vdp",
];

function filterTerm(value: string): string | null {
  const term = value.trim();
  return term.length >= 1 && term.length <= 40 &&
    /^[\p{L}\p{N}][\p{L}\p{N} .-]*$/u.test(term) ? term : null;
}

export function buildAutoDevEvaluationRequest(
  filter: AutoDevFilter,
  apiKey: string,
): Request | null {
  const make = filterTerm(filter.make);
  const model = filter.model === undefined ? undefined : filterTerm(filter.model);
  const key = apiKey.trim();
  if (!make || model === null || !key || !/^[\x21-\x7e]+$/.test(key)) return null;

  const url = new URL("https://api.auto.dev/listings");
  url.searchParams.set("vehicle.make", make);
  if (model) url.searchParams.set("vehicle.model", model);
  url.searchParams.set("retailListing.used", "true");
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("select", FIELDS.join(","));
  return new Request(url, {
    redirect: "manual",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function dealerUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || !url.href.startsWith(url.origin + "/")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function decodeAutoDevEvaluation(payload: unknown): AutoDevEvaluationListing[] {
  const data = record(payload)?.data;
  if (!Array.isArray(data)) throw new Error("invalid_auto_dev_response");

  const listings: AutoDevEvaluationListing[] = [];
  const seen = new Set<string>();
  for (const value of data.slice(0, LIMIT)) {
    const row = record(value);
    if (!row) continue;
    const vin = row["vehicle.vin"];
    const make = row["vehicle.make"];
    const model = row["vehicle.model"];
    const year = row["vehicle.year"];
    const price = row["retailListing.price"];
    const listingUrl = dealerUrl(row["retailListing.vdp"]);
    if (
      typeof vin !== "string" || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) || seen.has(vin) ||
      typeof make !== "string" || !filterTerm(make) ||
      typeof model !== "string" || !filterTerm(model) ||
      typeof year !== "number" || !Number.isInteger(year) || year < 1886 || year > 2100 ||
      typeof price !== "number" || !Number.isFinite(price) || price <= 0 || !listingUrl
    ) continue;
    seen.add(vin);
    listings.push({ vin, make: make.trim(), model: model.trim(), year, priceUsd: price, listingUrl });
  }
  return listings;
}
