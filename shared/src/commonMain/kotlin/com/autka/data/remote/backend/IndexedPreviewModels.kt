package com.autka.data.remote.backend

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Wire region code the /search/previews endpoint expects for the PL pilot. */
const val INDEXED_PREVIEW_REGION_PL = "PL"

/** Backend rejects queries longer than 256 JavaScript UTF-16 code units. */
const val INDEXED_QUERY_MAX_UTF16_UNITS = 256

/** Truncates to [maxUnits] UTF-16 code units without splitting a surrogate pair. */
fun String.takeUtf16Units(maxUnits: Int): String {
    if (length <= maxUnits) return this
    val cut = take(maxUnits)
    return if (cut.last().isHighSurrogate()) cut.dropLast(1) else cut
}

@Serializable
data class IndexedPreviewRequest(val region: String, val query: String)

@Serializable
data class IndexedPreview(
    val title: String,
    val url: String,
    val marketplace: String,
    val provider: String,
    val snippet: String,
)

@Serializable
data class IndexedPreviewResponse(
    val status: String,
    val provider: String? = null,
    val previews: List<IndexedPreview> = emptyList(),
)

object IndexedPreviewDecoder {
    private val json = Json { ignoreUnknownKeys = true }
    private val otomoto = Regex("""https://(?:www\.)?otomoto\.pl/osobowe/oferta/[^/?#\\\s]+-ID[a-zA-Z0-9]+\.html(?:\?[^#\\\s]*)?""")
    private val olx = Regex("""https://(?:www\.)?olx\.pl/d/oferta/[^/?#\\\s]+-CID5-ID[a-zA-Z0-9]+\.html(?:\?[^#\\\s]*)?""")

    fun decodeJsonOrNull(payload: String): List<IndexedPreview>? =
        runCatching { decode(json.decodeFromString<IndexedPreviewResponse>(payload)) }.getOrNull()

    fun decode(response: IndexedPreviewResponse): List<IndexedPreview>? {
        if (response.status != "ok" || response.provider !in setOf("brave", "tavily")) return null
        return response.previews.take(20).filter {
            it.provider == response.provider && it.title.isNotBlank() &&
                it.title.length <= 400 && it.snippet.length <= 1000 && it.url.length <= 2048 &&
                when (it.marketplace) {
                    "otomoto" -> otomoto.matches(it.url)
                    "olx" -> olx.matches(it.url)
                    else -> false
                }
        }.distinctBy { it.url }
    }
}
