package com.autka.data.remote.backend

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class IndexedPreviewDecoderTest {
    private val offer = IndexedPreview(
        "Lexus ES", "https://www.otomoto.pl/osobowe/oferta/lexus-ID123.html",
        "otomoto", "brave", "Indexed listing",
    )

    @Test
    fun filtersUnsafeLinksAndUntrustedProviders() {
        val response = IndexedPreviewResponse("ok", "brave", listOf(
            offer, offer,
            offer.copy(url = "https://otomoto.pl.evil.test/osobowe/oferta/lexus-ID123.html"),
            offer.copy(url = "https://evil@otomoto.pl/osobowe/oferta/lexus-ID123.html"),
            offer.copy(url = "https://otomoto.pl/osobowe/lexus"),
            offer.copy(provider = "tavily"),
        ))
        assertEquals(listOf(offer), IndexedPreviewDecoder.decode(response))
        assertEquals(emptyList(), IndexedPreviewDecoder.decode(IndexedPreviewResponse("ok", "tavily")))
        assertNull(IndexedPreviewDecoder.decode(IndexedPreviewResponse("unavailable")))
        assertNull(IndexedPreviewDecoder.decodeJsonOrNull("not json"))
    }
}
