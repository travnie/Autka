package com.autka.data.remote.backend

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class IndexedPreviewDecoderTest {
    private val offer = IndexedPreview(
        "Lexus ES", "https://www.otomoto.pl/osobowe/oferta/lexus-ID123.html",
        "otomoto", "brave", "Indexed listing",
    )

    @Test
    fun requestAlwaysEncodesRegion() {
        val payload = Json.parseToJsonElement(
            Json.encodeToString(IndexedPreviewRequest(region = INDEXED_PREVIEW_REGION_PL, query = "Lexus ES")),
        ).jsonObject
        assertEquals("PL", payload["region"]?.jsonPrimitive?.content)
        assertEquals("Lexus ES", payload["query"]?.jsonPrimitive?.content)
    }

    @Test
    fun acceptsOlxLinksAndRejectsMismatchedMarketplace() {
        val olx = offer.copy(
            url = "https://www.olx.pl/d/oferta/bmw-seria-3-CID5-IDabc123.html",
            marketplace = "olx",
        )
        val response = IndexedPreviewResponse("ok", "brave", listOf(
            olx,
            offer.copy(marketplace = "olx"),
        ))
        assertEquals(listOf(olx), IndexedPreviewDecoder.decode(response))
    }

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
