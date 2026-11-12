<!-- markdownlint-disable MD041 MD033 -->
<p align="center">
  <img src="https://raw.githubusercontent.com/travnie/Autka/main/fastlane/metadata/android/en-US/images/icon.png" width="128" alt="Autka icon">
</p>

<h1 align="center">Autka</h1>

<p align="center">
  Open-source Android project for car shopping across Poland, Europe and US imports — with a built-in USA → Poland landed-cost calculator.
</p>

<p align="center">
  <a href="https://github.com/travnie/Autka/actions/workflows/android-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/travnie/Autka/android-ci.yml?branch=main&label=Android%20CI&logo=android&logoColor=white&style=flat-square" alt="Android CI"></a>
  <a href="https://github.com/travnie/Autka/actions/workflows/shared-ios-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/travnie/Autka/shared-ios-ci.yml?branch=main&label=shared%20iOS%20CI&logo=apple&logoColor=white&style=flat-square" alt="Shared iOS CI"></a>
  <a href="https://github.com/travnie/Autka/actions/workflows/backend-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/travnie/Autka/backend-ci.yml?branch=main&label=backend%20CI&logo=githubactions&logoColor=white&style=flat-square" alt="Backend CI"></a>
  <a href="https://developer.android.com/guide/topics/manifest/uses-sdk-element"><img src="https://img.shields.io/badge/Android-minSdk%2026-3DDC84?logo=android&logoColor=white&style=flat-square" alt="minSdk 26"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/travnie/Autka?logo=opensourceinitiative&logoColor=white&style=flat-square" alt="Apache-2.0"></a>
  <a href="https://deepwiki.com/travnie/Autka"><picture><source srcset="https://img.shields.io/badge/DeepWiki-travnie%2FAutka-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==" type="image/svg+xml"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></picture></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/travnie/Autka/main/fastlane/metadata/android/en-US/images/featureGraphic.png" width="720" alt="Autka feature graphic">
</p>
<!-- markdownlint-enable MD041 MD033 -->

> [!IMPORTANT]
> **Current blocker / Obecna blokada**
>
> **EN:** Autka is currently limited less by code than by access to lawful, reliable
> listing data. Scraping marketplaces is not the direction of this project, while
> arranging a licensed feed or a business partnership with a major platform such as OLX
> is not something a small independent project can do overnight. Leads to legal data
> providers, API/feed access, relevant contacts, or concrete collaboration offers are
> very welcome.
>
> **PL:** Rozwój projektu Autka ogranicza dziś nie tyle kod, co dostęp do legalnych i
> wiarygodnych danych ogłoszeniowych. Scraping serwisów nie jest kierunkiem tego projektu,
> a dogadanie licencjonowanego feedu lub współpracy biznesowej z dużą platformą typu OLX
> nie jest dla małego, niezależnego projektu sprawą do załatwienia od ręki. Kontakty do
> legalnych dostawców danych, dostęp do API/feedów albo konkretne propozycje współpracy są
> bardzo mile widziane.

## What Autka is

Buying a car across borders means jumping between marketplaces, currencies, filters,
auction sites and import calculators. Autka is an attempt to make that decision process
feel like one product instead of twelve browser tabs.

When a lawful listing feed is available, the backend can normalize it into one catalogue.
When a marketplace cannot be ingested, Autka keeps the user's search intent and hands the
search off to the original site through a deep-link instead of scraping it. For cars from
the USA, the same app can estimate what the vehicle may cost after shipping, duty, Polish
excise and VAT.

> Formerly **CarGate**.

## What already works

- **Search, filters and sorting** over the connected/cached catalogue, including make,
  price, year, mileage, fuel, transmission, region and source.
- **Marketplace hand-off** to original PL/EU/US search pages when Autka has no licensed
  feed for that source.
- **USA → Poland import calculator**, available both from a listing and as a standalone
  tool, with shipping, customs duty, excise and VAT breakdowns.
- **PLN / EUR / USD comparison** using NBP exchange rates, with explicit stale-rate
  fallback rather than silently pretending cached rates are current.
- **Map view**, **source-status diagnostics** and an import-service directory.
- **Offline-first results**: the last successfully cached catalogue remains usable when
  the network is unavailable.
- **No ads or analytics SDKs**. The Android manifest currently asks only for internet and
  network-state permissions.

Import figures are estimates, not customs quotes. Exact classification, valuation,
shipping, tax and relief rules can change the final amount.

## Looking for data and business partners

The most useful contribution to Autka right now is not another scraper. It is a lawful
way to make the catalogue real.

Potential fits include:

- marketplaces, aggregators or data vendors able to license search/listing data;
- dealers and importers willing to provide an authorised JSON/CSV/API inventory feed;
- US auction buyers, brokers and logistics partners who can provide realistic shipping
  and landed-cost inputs;
- connected-seller integrations where a business explicitly authorises access to its own
  inventory;
- affiliate or lead-generation partnerships that can fund the project without turning it
  into an ad farm.

A first integration does not need to be enormous. It does need enough structured data to
normalize each listing into Autka's offer model: stable source/id, title, make and model,
price/currency, fuel, transmission, region and original listing URL, plus clear update and
expiry semantics. Optional fields such as year, mileage, location and images make the
result substantially more useful. See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for
the full boundary and partner checklist.

## Current project state

The Android app and Cloudflare backend are functional, but Autka deliberately does not
fabricate production inventory. Sample offers are opt-in for debug/demo builds only. Until
a compliant live provider is connected, the internal production catalogue can be empty
and marketplace deep-links remain the main hand-off for unsupported sources.

That makes the project useful today as an import-cost/search companion, while the full
aggregator vision depends on data partnerships rather than reverse-engineering private
marketplace endpoints.

## Development

Android development requires JDK 17 and a recent Android Studio:

```bash
./gradlew assembleDebug
./gradlew installDebug
```

The Worker lives in [`backend/`](backend/) and has its own setup and operations guide in
[`backend/README.md`](backend/README.md).

## Documentation

| Document | Purpose |
|---|---|
| [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) | Data policy, partner integration paths, deep-link boundary and source acceptance checklist |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Android/backend architecture, currency, import costs, map, caching and CI |
| [`docs/RELEASING.md`](docs/RELEASING.md) | Signing and release process |
| [`docs/TODO.md`](docs/TODO.md) | Remaining product blockers and engineering follow-ups |
| [`backend/README.md`](backend/README.md) | Backend API, ingestion and operations |
| [`docs/THIRD_PARTY_NOTICES`](docs/THIRD_PARTY_NOTICES) | Ownership and licensing boundary for third-party material |

## License

Original source code and documentation are licensed under [Apache-2.0](LICENSE).
Marketplace data, names, trademarks, logos and linked media are not covered by that
license. See [THIRD_PARTY_NOTICES](docs/THIRD_PARTY_NOTICES).

---
## Other stuff

[![feedseek](https://github.com/trvny/.github/blob/main/assets/profile/pin-feeds.svg)](https://github.com/trvny/feedseek) [![tvpi](https://github.com/trvny/.github/blob/main/assets/profile/pin-tvpi.svg)](https://github.com/trvny/tvpi)

## 💬 Cytat z szuflady

<!-- markdownlint-disable MD033 -->
<!--STARTS_HERE_QUOTE_README-->
<i>❝More than 80% of the emails sent daily are spams.❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Mininewsy

<!--README_FEED:START-->
- [Trust but Verify: Implementing Frontier AI Policy in California and Beyond](https://carnegieendowment.org/research/2026/11/trust-but-verify-implementing-frontier-ai-policy-in-california-and-beyond)
- [Promises Made, Promises Unmet: The NPP’s Struggle to Reform Sri Lanka](https://carnegieendowment.org/research/2026/11/promises-made-promises-unmet-the-npps-struggle-to-reform-sri-lanka)
- [W Filipowicach zagrają cztery kapele - zakliczyninfo.pl](https://news.google.com/atom/articles/CBMijAFBVV95cUxPOXdxVjVMdHc0YUw2akRlZlJZREw0WUVmeHdvbDNqNUo5cnNRM1ZWUm9aSEJzSUlKNU1hSkF2anlwUm5sTGpzTHN1NG9wZXhhSGJYbHB6RWhUaUxlQ3FOTnlwNmloNnJLNnJnbjVmYzJ6RWFqMGdvZ3VzVjJNQUZ4SU9qUzFINjBIQ25BSQ?oc=5)
- [Product of the Day — A Magical Bag Of Holding Except The Only Thing It Can Hold Is Infinite Fedoras](https://anycrap.shop/product/a-magical-bag-of-holding-except-the-only-thing-it-can-hold-is-infinite-fedoras)
- [Cat Fact of the Day](https://catfact.ninja/)
- [Joke of the Day](https://djtech.net/humor/things_to_think_about.htm)
<!--README_FEED:END-->
