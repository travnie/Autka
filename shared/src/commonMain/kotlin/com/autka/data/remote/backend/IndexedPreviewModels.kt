package com.autka.data.remote.backend

import kotlinx.serialization.Required
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class IndexedPreviewRequest(@Required val region: String = "PL", val query: String)

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
