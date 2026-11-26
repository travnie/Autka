package com.autka.data.repository

import com.autka.data.remote.backend.IndexedPreview

/** Opt-in indexed (web-search) listing previews for the PL pilot. */
interface IndexedPreviewRepository {
    /**
     * Returns decoded previews, an empty list when the index has no matches,
     * or null when the search is unavailable (transport or quota failure).
     */
    suspend fun searchPreviews(query: String): List<IndexedPreview>?
}
