import AutkaShared
import Foundation
import SwiftUI

struct MarketplaceSearchView: View {
    @State private var make = ""
    @State private var model = ""
    @State private var region = SearchRegion.poland
    @State private var links: [MarketplaceLink] = []
    @State private var indexedResults: [IndexedPreview]? = nil
    @State private var indexedAttempted = false
    @State private var indexedLoading = false
    @State private var indexedTask: Task<Void, Never>?
    @State private var indexedGeneration = 0

    private var indexedQuery: String {
        String([make, model].joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines).prefix(256))
    }

    private func clearIndexed() {
        indexedGeneration += 1
        indexedTask?.cancel()
        indexedTask = nil
        indexedLoading = false
        indexedResults = nil
        indexedAttempted = false
    }

    @MainActor
    private func searchIndexed() async {
        let generation = indexedGeneration
        indexedLoading = true
        defer {
            if indexedGeneration == generation { indexedLoading = false; indexedAttempted = true }
        }
        var request = URLRequest(url: AppConfiguration.backendBaseURL.appendingPathComponent("search/previews"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 20
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: ["region": "PL", "query": indexedQuery])
            let (data, response) = try await URLSession.shared.data(for: request)
            guard !Task.isCancelled, indexedGeneration == generation,
                  let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let payload = String(data: data, encoding: .utf8) else { return }
            indexedResults = IndexedPreviewDecoder.shared.decodeJsonOrNull(payload: payload)
        } catch {
            // Keep marketplace links available on network or quota failure.
        }
    }

    private func refreshLinks() {
        let filter = SearchFilter(
            query: "",
            make: make.isEmpty ? nil : make,
            model: model.isEmpty ? nil : model,
            minPrice: nil,
            maxPrice: nil,
            minYear: nil,
            maxYear: nil,
            maxMileageKm: nil,
            fuelTypes: Set<FuelType>(),
            transmissions: Set<Transmission>(),
            regions: region.kotlinValues,
            sourceIds: Set<String>(),
            sort: SortOrder.newest
        )
        links = MarketplaceSearchLinks.shared.all(filter: filter, affiliateId: nil)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Make", text: $make)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()

                    TextField("Model", text: $model)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()

                    Picker("Region", selection: $region) {
                        ForEach(SearchRegion.allCases) { choice in
                            Text(choice.title).tag(choice)
                        }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text("Autka prepares the search, then opens the original marketplace. No listing data is copied or scraped.")
                }

                if region == .poland || region == .all {
                    Section {
                        Button("Indexed search (Poland)") {
                            clearIndexed()
                            indexedLoading = true
                            indexedTask = Task { await searchIndexed() }
                        }
                        .disabled(indexedQuery.isEmpty || indexedLoading)
                        if indexedLoading {
                            ProgressView()
                        } else if indexedAttempted {
                            if let results = indexedResults {
                                if results.isEmpty { Text("No indexed listings found. Try marketplace links.") }
                                ForEach(results, id: \.url) { item in
                                    if let url = URL(string: item.url) {
                                        Link(destination: url) {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(item.title)
                                                Text(verbatim: item.marketplace == "otomoto" ? "OTOMOTO" : "OLX")
                                                    .font(.caption)
                                                Text(item.snippet).font(.caption).foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            } else {
                                Text("Search unavailable. Use marketplace links instead.")
                            }
                        }
                    } footer: {
                        Text("Search previews from web indexes. Listing availability and filters are not verified. Open the original listing.")
                    }
                }

                Section("Marketplaces") {
                    ForEach(links, id: \.sourceId) { link in
                        if let url = URL(string: link.url) {
                            Link(destination: url) {
                                HStack {
                                    Text(link.displayName)
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } else {
                            HStack {
                                Text(link.displayName)
                                Spacer()
                                Image(systemName: "exclamationmark.triangle")
                                    .foregroundStyle(.secondary)
                                    .accessibilityLabel("Invalid link")
                            }
                            .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Search cars")
            .onAppear(perform: refreshLinks)
            .onChange(of: make) { _ in clearIndexed(); refreshLinks() }
            .onChange(of: model) { _ in clearIndexed(); refreshLinks() }
            .onChange(of: region) { _ in clearIndexed(); refreshLinks() }
            .onDisappear { clearIndexed() }
        }
    }
}

#Preview {
    MarketplaceSearchView()
}
