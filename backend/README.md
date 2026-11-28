<!-- markdownlint-disable MD041 -->
[![Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)

# Autka Backend
<!-- markdownlint-enable MD041 -->

Cloudflare Workers backend that aggregates authorised used-car offers server-side and
serves a clean API to the Autka Android app. Built on **Workers + D1** (SQL) **+ R2**
(images), with a scheduled ingestion pipeline that is enabled once a real production
source is configured. Aggregation, credentials and feed access live here — never on the
device.

## Why a backend

The app deliberately does not scrape marketplaces. This Worker is where compliant feeds
are normalized into one schema and served. Each marketplace/partner is an `IngestSource`;
when scheduling is enabled, the cron trigger runs every enabled source, isolates failures
and upserts results into D1. Android talks to one backend API surface rather than carrying
provider credentials or provider-specific ingestion logic.

The maintained policy for what may become an ingestion source, partner integration paths
and the deep-link fallback lives in [`docs/DATA_SOURCES.md`](../docs/DATA_SOURCES.md).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/offers` | Search and pagination; query params mirror `SearchFilter` |
| GET | `/offers/:id` | Single offer |
| GET | `/sources` | Source list, enabled flags, offer counts and latest completed-ingest health |
| POST | `/admin/ingest` | Manually trigger ingestion; bearer-token protected |
| GET | `/images/<key>` | Stream a cached offer image from R2 |
| GET | `/import-services` | Import/sourcing companies, optionally filtered by region |

`/offers` returns `{ offers: CarOffer[], count, warnings? }`. In regular mode, `count` is
the total number of matching rows or de-duplicated groups before `limit` and `offset`.
`complete=true` instead returns the full matching set from one SQL statement, ignoring
pagination parameters, so ingestion cannot shift page boundaries between client requests.
Complete responses are capped at 5,000 rows and return HTTP 422 rather than silently
truncating a larger catalogue.

Native prices may be PLN, EUR or USD, so server-side price filters and price ordering
remain disabled until a normalized-price column lands. Android requests `complete=true`
and performs those operations after currency conversion.

`/sources` adds best-effort public health fields (`offerCount`, `lastCompletedAtEpochMs`,
`lastCompletedOk`, `lastOffersUpserted`). If D1 health lookup fails, the static source list
and enabled flags are still returned with health fields set to `null`; raw ingestion errors
remain server-side.

The `CarOffer` shape in `src/lib/types.ts` mirrors Android
`com.autka.core.model.CarOffer`; keep them in sync.

## Provisioned resources

- **Worker**: `cargate` (`https://cargate.travny.workers.dev/`)
- **D1**: `cargate-offers`
- **R2**: `cargate-images`

D1 and R2 bindings live in `wrangler.jsonc`.

## Client migration

Single Worker by owner request. Removing adapter source does not delete the deployed Worker.

Cutover checklist (record results in PR #300):

1. Merge after CI; publish the signed rolling Android release (0.0.3, canonical URL).
2. Verify the release tag points to the migrated code and canonical authenticated smoke passes.
3. Delete only the `cargate-backend` Worker via Cloudflare API/dashboard (no forced deletion).
4. Confirm only `cargate` remains; preserve Access, D1, R2 and secrets.

Old APKs and iOS builds with the former hostname must update/rebuild; no support for the retired
hostname after cutover. Authenticated API smoke does not verify native client authentication;
Access remains enforced.

## Local development

```bash
npm install
npm run db:migrate:local
npm run dev
npm test
npm run typecheck
```

The Android debug build points at `http://10.0.2.2:8787/`, the emulator loopback to the
host running `wrangler dev`.

Mock ingestion is opt-in. Set `ENABLE_MOCK_SOURCE=true` for a local/demo Worker. The
production configuration keeps it false.

## Deploy

Use the existing `cargate` Worker. Preserve its D1, R2, secrets and Cloudflare Access policy.
The separate `trvny/trvny/mcp/status-mcp/wrangler.jsonc` references `cargate` via `AUTKA`.

After deployment, smoke-check the canonical hostname with authorized Access credentials:
`GET /health`, `GET /offers`, `GET /images/missing` (expected 404).
The manual Worker smoke workflow requires `CF_ACCESS_CLIENT_ID` and
`CF_ACCESS_CLIENT_SECRET` repository secrets. It tests live deployments, not PR code.
Verify before shipping clients.
For the indexed-search pilot, additionally dispatch the smoke workflow with
`indexed_search=true` after deploying the enabled Worker. It checks unauthenticated
POST rejection on the canonical hostname with a deliberately invalid body (no provider call),
then makes one authorized PL preview request on the canonical hostname, without retries.
At most one reservation per provider per run; do not schedule this smoke.
Compatibility date 2026-11-11: newest supported by the locked CI runtime;
retest before raising. Run `npm run test` and `npx wrangler deploy --dry-run`.
Deploy the main config only.

```bash
npx wrangler login
npx wrangler secret put ADMIN_TOKEN
npm run db:migrate:remote
```

The migration step is required. Before enabling indexed search, provision the
operator-owned provider caps in the target D1 database (after migrations). For a new
production database only, initialize the approved pilot limits without overwriting
any existing cap or kill switch:

```bash
npx wrangler d1 execute cargate-offers --remote --command \
  "INSERT INTO search_provider_limits (provider, monthly_limit) VALUES ('brave', 100), ('tavily', 100) ON CONFLICT(provider) DO NOTHING;"
```

For every pilot deployment, inspect the actual limits:

```bash
npx wrangler d1 execute cargate-offers --remote --command \
  "SELECT provider, monthly_limit FROM search_provider_limits ORDER BY provider;"
```

Verify both limits, provider-side billing caps and Access coverage for the canonical hostname
before deploying with indexed search enabled. Missing/zero caps deny dispatch;
never seed them automatically in migrations or reset an operator's disabled provider.
Keep the flag disabled if the prerequisites are not met.

```bash
npm run deploy
```

Migrations create the offer schema, de-duplication and
coordinate columns, add per-source ingest leases, and remove mock rows left by older
production deployments.

## Ingestion semantics

`src/ingest/sources/` contains the source adapters. `mock.ts` is a local/demo source;
`stubs.ts` documents disabled real connectors awaiting compliant data paths.

Every currently enabled adapter is treated as a **complete snapshot**:

1. acquire a per-source D1 lease;
2. fetch and normalize the source snapshot;
3. cache images in R2 best-effort;
4. refresh the lease to prove the run was not superseded;
5. upsert the snapshot;
6. remove source rows not seen in that successful run;
7. release the lease.

A concurrent scheduled/manual run for the same source is skipped, while different sources
still run in parallel. A failed fetch does not delete the previous snapshot. Future delta
feeds must declare different cleanup semantics instead of using the snapshot path unchanged.

## Images

During ingestion, images are fetched best-effort and stored in R2. Offer URLs are rewritten
to backend-served `/images/<key>` paths. Failed downloads retain their original URL and do
not fail the whole ingest. The image route streams objects, supports ETag/304, and never
fetches arbitrary URLs on demand.

## Operations

- Production cron is currently disabled because no real ingestion source is enabled;
  `triggers.crons` is pinned to `[]` so every deploy clears a cron added outside the repo.
  Re-enable it there when the first compliant source goes live.
- `ingest_runs` retains the latest 500 diagnostic rows plus the latest completed row for
  every source, so source health does not disappear when another source is noisy.
- `ingest_locks` prevents overlapping snapshots for one source and uses expiring leases so
  a crashed Worker cannot block ingestion forever.
- `ADMIN_TOKEN`, `AD_API_KEY`, `TAVILY_API_KEY`, `BSAS_API_KEY` and future provider keys are Worker secrets; never commit values.
- Smart Placement enabled. Issues enabled; request URL query strings redacted. Keep logs sampled at 1%; invocation logs off.
