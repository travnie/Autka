package com.autka.feature.external

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.autka.R
import com.autka.data.remote.backend.INDEXED_QUERY_MAX_UTF16_UNITS
import com.autka.data.remote.backend.IndexedPreview
import com.autka.data.remote.backend.takeUtf16Units
import kotlinx.coroutines.launch

@Composable
fun IndexedSearchDialog(
    initialQuery: String,
    onSearch: suspend (String) -> List<IndexedPreview>?,
    onDismiss: () -> Unit,
) {
    var query by rememberSaveable(initialQuery) { mutableStateOf(initialQuery) }
    var loading by remember { mutableStateOf(false) }
    var attempted by remember { mutableStateOf(false) }
    var results by remember { mutableStateOf<List<IndexedPreview>?>(null) }
    var generation by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current
    val context = LocalContext.current

    // A new initialQuery starts a new dialog session: drop stale results and let
    // in-flight searches finish without writing into the new session.
    LaunchedEffect(initialQuery) {
        generation++
        results = null
        attempted = false
    }

    fun performSearch() {
        if (loading || query.isBlank()) return
        val gen = generation
        loading = true
        attempted = false
        results = null
        scope.launch {
            try {
                val previews = onSearch(query.trim())
                if (gen == generation) {
                    results = previews
                    attempted = true
                }
            } finally {
                if (gen == generation) loading = false
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.indexed_search_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.indexed_search_notice), style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value = query,
                    onValueChange = {
                        query = it.takeUtf16Units(INDEXED_QUERY_MAX_UTF16_UNITS)
                        results = null
                        attempted = false
                    },
                    enabled = !loading,
                    singleLine = true,
                    label = { Text(stringResource(R.string.search_hint)) },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { performSearch() }),
                )
                if (loading) {
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                } else if (attempted) {
                    val items = results
                    when {
                        items == null -> Text(stringResource(R.string.indexed_search_unavailable))
                        items.isEmpty() -> Text(stringResource(R.string.indexed_search_empty))
                        else -> LazyColumn(
                            modifier = Modifier.heightIn(max = 320.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            items(items, key = { it.url }) { item ->
                                Column(
                                    Modifier.fillMaxWidth().clickable {
                                        runCatching { uriHandler.openUri(item.url) }.onFailure {
                                            Toast.makeText(
                                                context,
                                                R.string.no_browser,
                                                Toast.LENGTH_SHORT,
                                            ).show()
                                        }
                                    }.padding(vertical = 6.dp),
                                ) {
                                    Text(item.title, style = MaterialTheme.typography.titleSmall)
                                    Text(
                                        buildString {
                                            append(if (item.marketplace == "otomoto") "OTOMOTO" else "OLX")
                                            append(" · ")
                                            append(if (item.provider == "brave") "Brave Search" else "Tavily")
                                        },
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                    Text(item.snippet, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = query.isNotBlank() && !loading,
                onClick = { performSearch() },
            ) { Text(stringResource(R.string.indexed_search_action)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.cancel)) } },
    )
}
