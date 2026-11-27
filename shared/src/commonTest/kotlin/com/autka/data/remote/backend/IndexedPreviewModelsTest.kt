package com.autka.data.remote.backend

import kotlin.test.Test
import kotlin.test.assertEquals

class IndexedPreviewModelsTest {
    @Test
    fun `short strings pass through unchanged`() {
        assertEquals("Lexus ES", "Lexus ES".takeUtf16Units(INDEXED_QUERY_MAX_UTF16_UNITS))
        assertEquals("", "".takeUtf16Units(INDEXED_QUERY_MAX_UTF16_UNITS))
    }

    @Test
    fun `exactly at the limit is kept`() {
        val query = "a".repeat(INDEXED_QUERY_MAX_UTF16_UNITS)
        assertEquals(query, query.takeUtf16Units(INDEXED_QUERY_MAX_UTF16_UNITS))
    }

    @Test
    fun `surrogate pair straddling the limit is not split`() {
        val ascii = "a".repeat(INDEXED_QUERY_MAX_UTF16_UNITS - 1)
        val emoji = "\uD83D\uDE97"
        val truncated = (ascii + emoji).takeUtf16Units(INDEXED_QUERY_MAX_UTF16_UNITS)
        assertEquals(ascii, truncated)
        assertEquals(INDEXED_QUERY_MAX_UTF16_UNITS - 1, truncated.length)
    }

    @Test
    fun `emoji beyond the limit are dropped whole`() {
        val ascii = "a".repeat(100)
        val emojis = "\uD83D\uDE97".repeat(200)
        val truncated = (ascii + emojis).takeUtf16Units(INDEXED_QUERY_MAX_UTF16_UNITS)
        assertEquals(INDEXED_QUERY_MAX_UTF16_UNITS, truncated.length)
        assertEquals(ascii + "\uD83D\uDE97".repeat(78), truncated)
    }
}
