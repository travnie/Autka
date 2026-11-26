package com.autka.data.repository

import com.autka.data.remote.backend.BackendApi
import com.autka.data.remote.backend.INDEXED_PREVIEW_REGION_PL
import com.autka.data.remote.backend.IndexedPreview
import com.autka.data.remote.backend.IndexedPreviewRequest
import com.autka.data.remote.backend.IndexedPreviewResponse
import com.autka.data.remote.backend.ImportServicesResponse
import com.autka.data.remote.backend.OffersResponse
import com.autka.data.remote.backend.SourcesResponse
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IndexedPreviewRepositoryTest {

    @Test
    fun `decoded previews pass through and request carries explicit PL region`() = runTest {
        val api = FakeApi()
        val repository = DefaultIndexedPreviewRepository(api)

        val result = repository.searchPreviews("Lexus ES")

        assertEquals("PL", api.lastRequest?.region)
        assertEquals(INDEXED_PREVIEW_REGION_PL, api.lastRequest?.region)
        assertEquals("Lexus ES", api.lastRequest?.query)
        assertEquals(1, result?.size)
        assertEquals("Lexus ES", result?.first()?.title)
    }

    @Test
    fun `transport failure maps to null`() = runTest {
        val api = FakeApi().apply { fail = true }
        val repository = DefaultIndexedPreviewRepository(api)

        assertNull(repository.searchPreviews("Lexus ES"))
    }

    @Test
    fun `non ok status maps to null`() = runTest {
        val repository = DefaultIndexedPreviewRepository(FakeApi(status = "unavailable"))

        assertNull(repository.searchPreviews("Lexus ES"))
    }

    @Test
    fun `cancellation is rethrown, not swallowed`() = runTest {
        val repository = DefaultIndexedPreviewRepository(FakeApi(cancel = true))

        val result = runCatching { repository.searchPreviews("Lexus ES") }

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is CancellationException)
    }

    private class FakeApi(
        private val status: String = "ok",
        var fail: Boolean = false,
        var cancel: Boolean = false,
    ) : BackendApi {
        var lastRequest: IndexedPreviewRequest? = null

        override suspend fun indexedPreviews(request: IndexedPreviewRequest): IndexedPreviewResponse {
            lastRequest = request
            if (cancel) throw CancellationException("cancelled")
            if (fail) error("offline")
            return IndexedPreviewResponse(
                status = status,
                provider = "brave",
                previews = listOf(
                    IndexedPreview(
                        title = "Lexus ES",
                        url = "https://www.otomoto.pl/osobowe/oferta/lexus-ID123.html",
                        marketplace = "otomoto",
                        provider = "brave",
                        snippet = "Indexed listing",
                    ),
                ),
            )
        }

        override suspend fun offers(
            query: String?,
            make: String?,
            model: String?,
            minPrice: Double?,
            maxPrice: Double?,
            minYear: Int?,
            maxYear: Int?,
            maxMileageKm: Int?,
            fuelTypes: String?,
            transmissions: String?,
            regions: String?,
            sources: String?,
            sort: String?,
            complete: Boolean?,
            limit: Int?,
            offset: Int?,
        ): OffersResponse = OffersResponse(emptyList(), 0)

        override suspend fun sources(): SourcesResponse = SourcesResponse()

        override suspend fun importServices(region: String?): ImportServicesResponse =
            ImportServicesResponse()
    }
}
