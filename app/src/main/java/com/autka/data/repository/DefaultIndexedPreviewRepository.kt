package com.autka.data.repository

import com.autka.data.remote.backend.BackendApi
import com.autka.data.remote.backend.INDEXED_PREVIEW_REGION_PL
import com.autka.data.remote.backend.IndexedPreview
import com.autka.data.remote.backend.IndexedPreviewDecoder
import com.autka.data.remote.backend.IndexedPreviewRequest
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException

@Singleton
class DefaultIndexedPreviewRepository @Inject constructor(
    private val api: BackendApi,
) : IndexedPreviewRepository {
    override suspend fun searchPreviews(query: String): List<IndexedPreview>? = try {
        val request = IndexedPreviewRequest(region = INDEXED_PREVIEW_REGION_PL, query = query)
        IndexedPreviewDecoder.decode(api.indexedPreviews(request))
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        null
    }
}
