package com.autka.feature.map

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.autka.R
import com.autka.core.model.CarOffer
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.plugins.annotation.SymbolManager
import org.maplibre.android.plugins.annotation.SymbolOptions
import org.maplibre.android.style.layers.Property

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    offers: List<CarOffer>,
    onBack: () -> Unit,
    onOfferClick: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.map_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                },
            )
        },
    ) { padding ->
        val context = LocalContext.current
        val lifecycleOwner = LocalLifecycleOwner.current
        val currentOnOfferClick by rememberUpdatedState(onOfferClick)
        val offerIdsBySymbol = remember { mutableMapOf<Long, String>() }
        val centeredOnce = remember { booleanArrayOf(false) }

        var map by remember { mutableStateOf<MapLibreMap?>(null) }
        var symbolManager by remember { mutableStateOf<SymbolManager?>(null) }

        val mapView =
            remember(context) {
                MapView(context).apply {
                    onCreate(null)
                }
            }

        LaunchedEffect(mapView) {
            mapView.getMapAsync { readyMap ->
                readyMap.cameraPosition =
                    CameraPosition.Builder()
                        .target(LatLng(DEFAULT_LATITUDE, DEFAULT_LONGITUDE))
                        .zoom(DEFAULT_ZOOM)
                        .build()

                readyMap.setStyle(Style.Builder().fromJson(OSM_RASTER_STYLE)) { style ->
                    style.addImage(
                        MARKER_IMAGE_ID,
                        requireNotNull(ContextCompat.getDrawable(context, R.drawable.ic_map_pin)).toBitmap(),
                    )

                    val manager =
                        SymbolManager(mapView, readyMap, style).apply {
                            setIconAllowOverlap(true)
                            addClickListener { symbol ->
                                offerIdsBySymbol[symbol.id]?.let(currentOnOfferClick)
                                true
                            }
                        }

                    map = readyMap
                    symbolManager = manager
                }
            }
        }

        LaunchedEffect(symbolManager, offers) {
            val manager = symbolManager ?: return@LaunchedEffect
            val located = offers.filter { it.latitude != null && it.longitude != null }

            manager.deleteAll()
            offerIdsBySymbol.clear()

            val symbols =
                manager.create(
                    located.map { offer ->
                        SymbolOptions()
                            .withLatLng(LatLng(offer.latitude!!, offer.longitude!!))
                            .withIconImage(MARKER_IMAGE_ID)
                            .withIconAnchor(Property.ICON_ANCHOR_BOTTOM)
                    },
                )
            symbols.zip(located).forEach { (symbol, offer) ->
                offerIdsBySymbol[symbol.id] = offer.id
            }

            if (!centeredOnce[0] && located.isNotEmpty()) {
                val first = located.first()
                map?.moveCamera(
                    CameraUpdateFactory.newLatLng(
                        LatLng(first.latitude!!, first.longitude!!),
                    ),
                )
                centeredOnce[0] = true
            }
        }

        DisposableEffect(symbolManager) {
            onDispose {
                symbolManager?.onDestroy()
            }
        }

        DisposableEffect(lifecycleOwner, mapView) {
            val lifecycle = lifecycleOwner.lifecycle
            val observer =
                LifecycleEventObserver { _, event ->
                    when (event) {
                        Lifecycle.Event.ON_START -> mapView.onStart()
                        Lifecycle.Event.ON_RESUME -> mapView.onResume()
                        Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                        Lifecycle.Event.ON_STOP -> mapView.onStop()
                        else -> Unit
                    }
                }
            lifecycle.addObserver(observer)

            if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
                mapView.onStart()
            }
            if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                mapView.onResume()
            }

            onDispose {
                lifecycle.removeObserver(observer)
                mapView.onDestroy()
            }
        }

        AndroidView(
            factory = { mapView },
            modifier = Modifier.fillMaxSize().padding(padding),
        )
    }
}

private fun Drawable.toBitmap(): Bitmap {
    val width = intrinsicWidth.coerceAtLeast(1)
    val height = intrinsicHeight.coerceAtLeast(1)
    return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { bitmap ->
        val canvas = Canvas(bitmap)
        setBounds(0, 0, canvas.width, canvas.height)
        draw(canvas)
    }
}

private val OSM_RASTER_STYLE =
    """
    {
      "version": 8,
      "sources": {
        "osm": {
          "type": "raster",
          "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          "tileSize": 256,
          "attribution": "© OpenStreetMap contributors"
        }
      },
      "layers": [
        {
          "id": "osm",
          "type": "raster",
          "source": "osm"
        }
      ]
    }
    """.trimIndent()

private const val MARKER_IMAGE_ID = "autka-map-pin"
private const val DEFAULT_LATITUDE = 52.0
private const val DEFAULT_LONGITUDE = 19.0
private const val DEFAULT_ZOOM = 5.0
