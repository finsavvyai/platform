package com.pgdesk.android.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// PostgreSQL-inspired color scheme
private val PGDeskLightColorScheme = lightColorScheme(
    primary = md_theme_light_primary,
    onPrimary = md_theme_light_onPrimary,
    primaryContainer = md_theme_light_primaryContainer,
    onPrimaryContainer = md_theme_light_onPrimaryContainer,
    secondary = md_theme_light_secondary,
    onSecondary = md_theme_light_onSecondary,
    secondaryContainer = md_theme_light_secondaryContainer,
    onSecondaryContainer = md_theme_light_onSecondaryContainer,
    tertiary = md_theme_light_tertiary,
    onTertiary = md_theme_light_onTertiary,
    tertiaryContainer = md_theme_light_tertiaryContainer,
    onTertiaryContainer = md_theme_light_onTertiaryContainer,
    error = md_theme_light_error,
    errorContainer = md_theme_light_errorContainer,
    onError = md_theme_light_onError,
    onErrorContainer = md_theme_light_onErrorContainer,
    background = md_theme_light_background,
    onBackground = md_theme_light_onBackground,
    surface = md_theme_light_surface,
    onSurface = md_theme_light_onSurface,
    surfaceVariant = md_theme_light_surfaceVariant,
    onSurfaceVariant = md_theme_light_onSurfaceVariant,
    outline = md_theme_light_outline,
    inverseOnSurface = md_theme_light_inverseOnSurface,
    inverseSurface = md_theme_light_inverseSurface,
    inversePrimary = md_theme_light_inversePrimary,
    surfaceTint = md_theme_light_surfaceTint,
    outlineVariant = md_theme_light_outlineVariant,
    scrim = md_theme_light_scrim,
)

private val PGDeskDarkColorScheme = darkColorScheme(
    primary = md_theme_dark_primary,
    onPrimary = md_theme_dark_onPrimary,
    primaryContainer = md_theme_dark_primaryContainer,
    onPrimaryContainer = md_theme_dark_onPrimaryContainer,
    secondary = md_theme_dark_secondary,
    onSecondary = md_theme_dark_onSecondary,
    secondaryContainer = md_theme_dark_secondaryContainer,
    onSecondaryContainer = md_theme_dark_onSecondaryContainer,
    tertiary = md_theme_dark_tertiary,
    onTertiary = md_theme_dark_onTertiary,
    tertiaryContainer = md_theme_dark_tertiaryContainer,
    onTertiaryContainer = md_theme_dark_onTertiaryContainer,
    error = md_theme_dark_error,
    errorContainer = md_theme_dark_errorContainer,
    onError = md_theme_dark_onError,
    onErrorContainer = md_theme_dark_onErrorContainer,
    background = md_theme_dark_background,
    onBackground = md_theme_dark_onBackground,
    surface = md_theme_dark_surface,
    onSurface = md_theme_dark_onSurface,
    surfaceVariant = md_theme_dark_surfaceVariant,
    onSurfaceVariant = md_theme_dark_onSurfaceVariant,
    outline = md_theme_dark_outline,
    inverseOnSurface = md_theme_dark_inverseOnSurface,
    inverseSurface = md_theme_dark_inverseSurface,
    inversePrimary = md_theme_dark_inversePrimary,
    surfaceTint = md_theme_dark_surfaceTint,
    outlineVariant = md_theme_dark_outlineVariant,
    scrim = md_theme_dark_scrim,
)

@Composable
fun PGDeskTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> PGDeskDarkColorScheme
        else -> PGDeskLightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = PGDeskTypography,
        shapes = PGDeskShapes,
        content = content
    )
}

// Custom semantic colors for PGDesk
val ColorScheme.success: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF4CAF50)
    } else {
        androidx.compose.ui.graphics.Color(0xFF2E7D32)
    }

val ColorScheme.warning: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFFFF9800)
    } else {
        androidx.compose.ui.graphics.Color(0xFFE65100)
    }

val ColorScheme.info: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF2196F3)
    } else {
        androidx.compose.ui.graphics.Color(0xFF1565C0)
    }

// Database connection status colors
val ColorScheme.connectionActive: androidx.compose.ui.graphics.Color
    @Composable get() = success

val ColorScheme.connectionIdle: androidx.compose.ui.graphics.Color
    @Composable get() = warning

val ColorScheme.connectionError: androidx.compose.ui.graphics.Color
    @Composable get() = error

// Query result colors
val ColorScheme.querySuccess: androidx.compose.ui.graphics.Color
    @Composable get() = success

val ColorScheme.queryWarning: androidx.compose.ui.graphics.Color
    @Composable get() = warning

val ColorScheme.queryError: androidx.compose.ui.graphics.Color
    @Composable get() = error

// Performance metric colors
val ColorScheme.performanceGood: androidx.compose.ui.graphics.Color
    @Composable get() = success

val ColorScheme.performanceWarning: androidx.compose.ui.graphics.Color
    @Composable get() = warning

val ColorScheme.performanceCritical: androidx.compose.ui.graphics.Color
    @Composable get() = error

// AI-related colors
val ColorScheme.aiPrimary: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF9C27B0)
    } else {
        androidx.compose.ui.graphics.Color(0xFF7B1FA2)
    }

val ColorScheme.aiSecondary: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF673AB7)
    } else {
        androidx.compose.ui.graphics.Color(0xFF512DA8)
    }

// Voice input colors
val ColorScheme.voiceActive: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFFFF5722)
    } else {
        androidx.compose.ui.graphics.Color(0xFFD84315)
    }

val ColorScheme.voiceListening: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF4CAF50)
    } else {
        androidx.compose.ui.graphics.Color(0xFF2E7D32)
    }

// Code editor colors
val ColorScheme.codeBackground: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF1E1E1E)
    } else {
        androidx.compose.ui.graphics.Color(0xFFFAFAFA)
    }

val ColorScheme.codeKeyword: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF569CD6)
    } else {
        androidx.compose.ui.graphics.Color(0xFF0000FF)
    }

val ColorScheme.codeString: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFFCE9178)
    } else {
        androidx.compose.ui.graphics.Color(0xFFA31515)
    }

val ColorScheme.codeComment: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFF6A9955)
    } else {
        androidx.compose.ui.graphics.Color(0xFF008000)
    }

val ColorScheme.codeNumber: androidx.compose.ui.graphics.Color
    @Composable get() = if (isSystemInDarkTheme()) {
        androidx.compose.ui.graphics.Color(0xFFB5CEA8)
    } else {
        androidx.compose.ui.graphics.Color(0xFF098658)
    }

// Chart and visualization colors
val pgdeskChartColors = listOf(
    androidx.compose.ui.graphics.Color(0xFF2196F3), // Blue
    androidx.compose.ui.graphics.Color(0xFF4CAF50), // Green
    androidx.compose.ui.graphics.Color(0xFFFF9800), // Orange
    androidx.compose.ui.graphics.Color(0xFF9C27B0), // Purple
    androidx.compose.ui.graphics.Color(0xFFF44336), // Red
    androidx.compose.ui.graphics.Color(0xFF00BCD4), // Cyan
    androidx.compose.ui.graphics.Color(0xFF8BC34A), // Light Green
    androidx.compose.ui.graphics.Color(0xFFFF5722), // Deep Orange
    androidx.compose.ui.graphics.Color(0xFF607D8B), // Blue Grey
    androidx.compose.ui.graphics.Color(0xFF795548)  // Brown
)