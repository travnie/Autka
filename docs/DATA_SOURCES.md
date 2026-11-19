# Data sources and marketplace integrations

Autka is designed to aggregate vehicle offers only when the project has a lawful,
reliable right to ingest and display them. This document is the source of truth for that
boundary, partner integration paths and the fallback used when a marketplace cannot be
part of the catalogue.

## The rule

Autka does **not** scrape marketplaces or reverse-engineer private endpoints.

There are three deliberately separate paths:

1. **Catalogue data** comes from licensed, partner-provided, seller-authorised or
   otherwise permitted feeds. It is normalized by the Cloudflare backend and served to
   client apps as `CarOffer` data.
2. **Marketplace deep-links** stay on the client. The shared builder translates the active
   `SearchFilter` into the original marketplace's search URL, and the platform UI opens
   that site. No listing data is ingested by Autka.
3. **Indexed search previews** come from permitted search APIs on demand. Separate
   backend search route and client model; never ingest into `CarOffer` or D1/R2.

`CarOffer` belongs in backend ingestion; marketplace hand-offs and indexed preview UI
belong in `feature/external`.

## Current state

- The mock source exists for local development and debug/demo use only.
- Production builds do not enable mock offers.
- No third-party marketplace catalogue should be enabled until its data rights and
  operational contract are clear.
- Unsupported marketplaces remain available through deep-links where the URL contract is
  sufficiently verified.

The Android source-status screen reads the backend's public-safe `/sources` metadata. Raw
provider errors and credentials stay server-side.

## Partner integration paths

A useful source does not need a bespoke enterprise API on day one. Autka can accommodate
several authorised delivery models.

### 1. Dealer or importer snapshot

A partner can publish JSON or CSV over HTTPS or place a snapshot in an agreed storage
location. The important part is a stable contract, not the transport.

A snapshot envelope can be as simple as:

```json
{
  "sourceId": "partner_slug",
  "generatedAt": "2026-08-10T06:00:00Z",
  "completeSnapshot": true,
  "offers": []
}
```

The records inside `offers` must provide enough information for the backend adapter to
normalize each listing into the current `CarOffer` model. At minimum that means a stable
source/native id, title, make, model, price with currency, fuel type, transmission, region,
original listing URL and an image list (which may be empty). Year, mileage, power,
location, timestamps, coordinates and thumbnail are optional in the current model but
improve the result when available.

The operational contract must also define update timestamps, expiry/deletion semantics and
explicit permission for any listing text or images Autka displays or caches.

### 2. Pull API or licensed feed

For a provider API, the backend adapter owns authentication, pagination, retries and
normalization. Secrets never ship in the client app. The adapter must declare whether a
successful run represents a **complete snapshot** or a **delta** because cleanup semantics
are different.

### 3. Partner push

A trusted partner may push signed data or upload a snapshot to an agreed endpoint/storage
location. The same data-rights and snapshot/delta rules apply; changing transport does not
change the licensing boundary.

### 4. Connected seller account

Some marketplace APIs are intended for a business to manage its own adverts. Those can be
useful when a dealer explicitly connects an account, but permission to access one seller's
inventory must not be treated as permission to ingest the entire marketplace.

### 5. Broker, auction or logistics partnership

For the USA → Poland side, an importer or broker can be valuable even without a broad
listing catalogue. Authorised inventory, realistic shipping bands, sourcing services,
lead attribution and better landed-cost assumptions can all improve Autka independently.

## Deep-link fallback

`shared/src/commonMain/kotlin/com/autka/feature/external/MarketplaceSearchLinks.kt` is the
maintained source of truth for marketplace URL builders. It currently covers search
hand-offs across Polish, European and US marketplaces, including local listing sites,
aggregators and US auction/dealer sites.

Do not duplicate every URL parameter in this document. The code carries per-provider
verification notes and marks uncertain values with `TODO(verify)`. A guessed parameter can
silently open an unfiltered page, so uncertain filters should be omitted or verified
against a real marketplace URL before being relied on.

Deep-links are a convenience, not an ingestion source. A marketplace may remain available
as a deep-link even after a licensed feed is added.

## Indexed search rollout

Goal: metasearch with original listing links, not another marketplace. No crawling,
scheduled searches, fake offers or price extraction from snippets.

Provider shortlist (pricing checked 2026-11-15; terms rechecked 2026-11-17):

| Provider | Role | Published entry allowance |
| --- | --- | --- |
| [Brave Search](https://brave.com/search/api/) | PL/EU/US primary web search | $5 monthly credits at $5/1,000 requests; $0 prepay, card required |
| [Tavily](https://www.tavily.com/pricing) | Web fallback | 1,000 monthly credits, no card; basic search only |
| [Auto.dev](https://www.auto.dev/listings) | US structured inventory evaluation only | Free: 1,000 calls/month, capped, 5 requests/sec; no production end-user use |
| [MarketCheck](https://developers.marketcheck.com/) | US alternative | Verify current plan, coverage and redistribution rights |

OTOMOTO's ChatGPT integration returns structured offers but is not a Worker credential
or permission to reuse its data. Pursue partner access separately. AutoUncle B2B and
direct dealer/importer feeds remain parallel opportunities.

### Phase 1: backend contract and search

- `POST /search/previews`: JSON `{"region": "PL", "query": "make model"}`. Query bounded to
  256 characters; body <= 1 KiB. Other regions/pagination later. POST keeps terms out of the client-facing URL.
  Fixed provider host and marketplace allowlists; no arbitrary URLs.
- Preview fields: title, original HTTPS URL, marketplace, provider, plain-text snippet.
  Missing structured facts stay missing; label results indexed, not verified live.
- Reuse existing browser search scope (PL/EU/US); centralize marketplace metadata
  rather than multiplying host lists. Accept individual listing URLs, not category pages.
- Brave adapter first; Tavily basic search fallback on unavailable/quota/transient errors.
  One provider per attempt; no automatic fan-out. Empty results are not errors.
- Server secrets: `BSAS_API_KEY` (Brave), `TAVILY_API_KEY`. Missing enable flag fails closed.
  PL pilot: `ENABLE_INDEXED_SEARCH=true` in production after owner confirmed prepaid-only
  Brave and Tavily Researcher without pay-as-you-go (2026-11-17). Both production
  `workers.dev` hostnames are covered by the same Access application (verified 2026-11-19);
  preview URLs are disabled. Retain both hostnames for installed clients.
  Initial D1 limits: 100 reservations/provider/UTC month, leaving headroom for other account usage.
  Missing/zero cap denies dispatch, not unlimited usage. Fresh/recreated D1 requires explicit
  operator provisioning and verification; see [deployment and smoke](../backend/README.md#deploy).
  Disable via flag or set provider limit to 0. Raise caps only after reviewing real usage.
  [Brave terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service)
  allow results in customer applications, not resale or durable storage.
  [Tavily display guidance](https://help.tavily.com/articles/4025347510-displaying-publishing-output)
  permits customer-facing titles, URLs and snippets. Third-party rights remain applicable.
  No raw API access; only bounded car listing previews.
  Per-IP Cloudflare rate limiter: 3 requests/minute/location (approximate); global D1 cap
  remains authoritative. No persisted IP addresses. Keep original browser deep-links.
- Enforce global monthly budget per provider (atomic reservation before outbound call),
  bounded per-client rate limits, timeouts, concurrency and query/result limits.
  No paid overage, no background retries or reservation refunds. Skip dispatch during
  final UTC minute; provider-side billing cap remains authoritative. Never log raw
  queries, credentials or snippets.
- Deduplicate canonical listing URL, retain functional URL parameters. Treat snippets
  as untrusted plain text; no HTML rendering. No provider-result persistence or image
  proxy/cache without explicit rights; default responses `Cache-Control: no-store`.
- Tests: host/path allowlists, operator injection, malformed payloads, duplicates,
  missing secrets, fallback, quota exhaustion and no upstream network in CI.

### Phase 2: client UI

- Shared preview model and provider-neutral endpoint client; Android then iOS.
- Explicit search action, no request per keystroke. Separate indexed-results section;
  show title, source, snippet, link and required provider attribution.
- Open original listing directly. Label freshness limitations and incomplete filter
  coverage. Keep deep-links accessible on empty, offline and quota-exhausted states.
- No inclusion in catalogue counts, map, numeric price sorting, saved-offer storage
  or alerts unless underlying data contract supports it.

### Phase 3: structured inventory

- Auto.dev: internal evaluation only. [Terms](https://www.auto.dev/terms) §§4.2–4.4
  restrict redistribution and derivative databases; Free allowance excludes production
  systems serving end users. Do not activate public search or ingest/cache listings.
  Confirm written display/redistribution rights and billing before production use.
- Evaluation contract: [v2 listings](https://docs.auto.dev/v2/reference/searchVehicleListings),
  server-only `AD_API_KEY`, bearer auth, one bounded page (20 maximum), used US retail
  listings, projected fields. No automatic calls, pagination, photos or persistence.
  Request/decoder fixtures only until private testing is explicitly wired.
- Add authorized structured search adapter only after acceptance checklist. Use
  query-time results or explicit snapshot/delta feeds as the contract requires.
- Evaluate MarketCheck and EU/PL partner feeds after initial coverage/quality measurements.
- Measure useful individual listing hits, stale links, latency, quota usage and fallback
  rate before expanding scope. No paid plan without explicit approval.

## Source research shortlist

The following are **research/partnership directions**, not claims that Autka currently has
redistribution rights or active credentials:

1. Direct dealer and US-importer feeds.
2. Commercial vehicle-data providers with explicit search/listing licences.
3. Marketplace or aggregator partner programmes, especially sources that can cover more
   than one underlying marketplace.
4. Connected-seller APIs for businesses that opt in with their own inventory.
5. Auction/broker relationships for US inventory and import logistics.

Previous research has included providers and programmes such as Auto.dev, mobile.de,
MarketCheck, AutoUncle B2B, OTOMOTO/OLX/AutoScout24 partner APIs, Manheim, IAA and Copart.
Treat that list as leads to re-check with the provider before implementation, not as a
statement that access or redistribution terms are currently available.

## Adapter acceptance checklist

Before enabling any real source, record at least:

- the contractual or otherwise explicit right to ingest and display the data;
- whether listing text and images may be cached and for how long;
- required attribution, branding and link-back rules;
- stable source ids plus deletion/expiry semantics;
- full-snapshot vs delta semantics;
- pagination, rate limits, retries and expected update cadence;
- native currency, tax inclusion and distance/location units;
- update timestamps and an expected freshness target;
- lead, affiliate or reporting requirements;
- production credentials stored only as backend secrets.

If those answers are unclear, keep the source disabled and use a deep-link instead.

## Moving a source from link-only to live data

When a lawful feed becomes available:

1. document its rights and operational contract using the checklist above;
2. add a backend `IngestSource` adapter and tests;
3. declare snapshot/delta cleanup semantics explicitly;
4. normalize into the shared `CarOffer` model;
5. keep credentials and provider-specific failures server-side;
6. verify source health and expiry behavior before enabling production ingestion;
7. decide separately whether the marketplace deep-link remains useful as an additional
   route to the original site.

See [`backend/README.md`](../backend/README.md) for ingestion mechanics and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the app/backend boundary.
