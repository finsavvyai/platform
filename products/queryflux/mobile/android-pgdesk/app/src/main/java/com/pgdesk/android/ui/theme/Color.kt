package com.pgdesk.android.ui.theme

import androidx.compose.ui.graphics.Color

// PostgreSQL-inspired Material 3 Color Palette
// Based on PostgreSQL's blue elephant logo and modern database UI patterns

val md_theme_light_primary = Color(0xFF336791) // PostgreSQL Blue
val md_theme_light_onPrimary = Color(0xFFFFFFFF)
val md_theme_light_primaryContainer = Color(0xFFD1E4FF)
val md_theme_light_onPrimaryContainer = Color(0xFF001D36)
val md_theme_light_secondary = Color(0xFF535F70)
val md_theme_light_onSecondary = Color(0xFFFFFFFF)
val md_theme_light_secondaryContainer = Color(0xFFD7E3F7)
val md_theme_light_onSecondaryContainer = Color(0xFF101C2B)
val md_theme_light_tertiary = Color(0xFF6B5B92)
val md_theme_light_onTertiary = Color(0xFFFFFFFF)
val md_theme_light_tertiaryContainer = Color(0xFFF2DAFF)
val md_theme_light_onTertiaryContainer = Color(0xFF25134B)
val md_theme_light_error = Color(0xFFBA1A1A)
val md_theme_light_errorContainer = Color(0xFFFFDAD6)
val md_theme_light_onError = Color(0xFFFFFFFF)
val md_theme_light_onErrorContainer = Color(0xFF410002)
val md_theme_light_background = Color(0xFFFDFCFF)
val md_theme_light_onBackground = Color(0xFF1A1C1E)
val md_theme_light_surface = Color(0xFFFDFCFF)
val md_theme_light_onSurface = Color(0xFF1A1C1E)
val md_theme_light_surfaceVariant = Color(0xFFDFE2EB)
val md_theme_light_onSurfaceVariant = Color(0xFF43474E)
val md_theme_light_outline = Color(0xFF73777F)
val md_theme_light_inverseOnSurface = Color(0xFFF1F0F4)
val md_theme_light_inverseSurface = Color(0xFF2F3033)
val md_theme_light_inversePrimary = Color(0xFF9FCAFF)
val md_theme_light_shadow = Color(0xFF000000)
val md_theme_light_surfaceTint = Color(0xFF336791)
val md_theme_light_outlineVariant = Color(0xFFC3C7CF)
val md_theme_light_scrim = Color(0xFF000000)

val md_theme_dark_primary = Color(0xFF9FCAFF)
val md_theme_dark_onPrimary = Color(0xFF003258)
val md_theme_dark_primaryContainer = Color(0xFF0F4A73)
val md_theme_dark_onPrimaryContainer = Color(0xFFD1E4FF)
val md_theme_dark_secondary = Color(0xFFBBC7DB)
val md_theme_dark_onSecondary = Color(0xFF253140)
val md_theme_dark_secondaryContainer = Color(0xFF3B4858)
val md_theme_dark_onSecondaryContainer = Color(0xFFD7E3F7)
val md_theme_dark_tertiary = Color(0xFFD6BBFF)
val md_theme_dark_onTertiary = Color(0xFF3B2961)
val md_theme_dark_tertiaryContainer = Color(0xFF524179)
val md_theme_dark_onTertiaryContainer = Color(0xFFF2DAFF)
val md_theme_dark_error = Color(0xFFFFB4AB)
val md_theme_dark_errorContainer = Color(0xFF93000A)
val md_theme_dark_onError = Color(0xFF690005)
val md_theme_dark_onErrorContainer = Color(0xFFFFDAD6)
val md_theme_dark_background = Color(0xFF1A1C1E)
val md_theme_dark_onBackground = Color(0xFFE2E2E6)
val md_theme_dark_surface = Color(0xFF1A1C1E)
val md_theme_dark_onSurface = Color(0xFFE2E2E6)
val md_theme_dark_surfaceVariant = Color(0xFF43474E)
val md_theme_dark_onSurfaceVariant = Color(0xFFC3C7CF)
val md_theme_dark_outline = Color(0xFF8D9199)
val md_theme_dark_inverseOnSurface = Color(0xFF1A1C1E)
val md_theme_dark_inverseSurface = Color(0xFFE2E2E6)
val md_theme_dark_inversePrimary = Color(0xFF336791)
val md_theme_dark_shadow = Color(0xFF000000)
val md_theme_dark_surfaceTint = Color(0xFF9FCAFF)
val md_theme_dark_outlineVariant = Color(0xFF43474E)
val md_theme_dark_scrim = Color(0xFF000000)

// Seed color for Material You dynamic theming
val seed = Color(0xFF336791)

// Custom semantic colors
val PostgreSQLBlue = Color(0xFF336791)
val PostgreSQLLightBlue = Color(0xFF9FCAFF)
val PostgreSQLDarkBlue = Color(0xFF003258)

// Status colors
val SuccessGreen = Color(0xFF4CAF50)
val WarningOrange = Color(0xFFFF9800)
val ErrorRed = Color(0xFFF44336)
val InfoBlue = Color(0xFF2196F3)

// Connection status colors
val ConnectionActive = Color(0xFF4CAF50)
val ConnectionIdle = Color(0xFFFF9800)
val ConnectionError = Color(0xFFF44336)
val ConnectionSecure = Color(0xFF9C27B0)

// Performance metric colors
val PerformanceExcellent = Color(0xFF4CAF50)
val PerformanceGood = Color(0xFF8BC34A)
val PerformanceWarning = Color(0xFFFF9800)
val PerformanceCritical = Color(0xFFF44336)

// AI and ML colors
val AIPrimary = Color(0xFF9C27B0)
val AISecondary = Color(0xFF673AB7)
val AIAccent = Color(0xFFE91E63)
val MLModelActive = Color(0xFF00BCD4)

// Data type colors
val StringColor = Color(0xFF4CAF50)
val NumberColor = Color(0xFF2196F3)
val DateColor = Color(0xFFFF9800)
val BooleanColor = Color(0xFF9C27B0)
val NullColor = Color(0xFF9E9E9E)

// SQL syntax highlighting colors (light theme)
val SQLKeyword = Color(0xFF0000FF)
val SQLString = Color(0xFFA31515)
val SQLComment = Color(0xFF008000)
val SQLNumber = Color(0xFF098658)
val SQLOperator = Color(0xFF000000)
val SQLFunction = Color(0xFF795548)

// SQL syntax highlighting colors (dark theme)
val SQLKeywordDark = Color(0xFF569CD6)
val SQLStringDark = Color(0xFFCE9178)
val SQLCommentDark = Color(0xFF6A9955)
val SQLNumberDark = Color(0xFFB5CEA8)
val SQLOperatorDark = Color(0xFFD4D4D4)
val SQLFunctionDark = Color(0xFFDCDCAA)

// Chart colors for data visualization
val ChartColors = listOf(
    Color(0xFF2196F3), // Blue
    Color(0xFF4CAF50), // Green
    Color(0xFFFF9800), // Orange
    Color(0xFF9C27B0), // Purple
    Color(0xFFF44336), // Red
    Color(0xFF00BCD4), // Cyan
    Color(0xFF8BC34A), // Light Green
    Color(0xFFFF5722), // Deep Orange
    Color(0xFF607D8B), // Blue Grey
    Color(0xFF795548), // Brown
    Color(0xFFE91E63), // Pink
    Color(0xFF3F51B5)  // Indigo
)

// Voice input colors
val VoiceListening = Color(0xFF4CAF50)
val VoiceProcessing = Color(0xFFFF9800)
val VoiceError = Color(0xFFF44336)
val VoiceIdle = Color(0xFF9E9E9E)

// Security colors
val SecurityHigh = Color(0xFF4CAF50)
val SecurityMedium = Color(0xFFFF9800)
val SecurityLow = Color(0xFFF44336)
val BiometricActive = Color(0xFF9C27B0)

// Environment colors
val DevelopmentEnv = Color(0xFF4CAF50)
val StagingEnv = Color(0xFFFF9800)
val ProductionEnv = Color(0xFFF44336)
val TestingEnv = Color(0xFF2196F3)

// Background gradients
val GradientStart = Color(0xFF336791)
val GradientEnd = Color(0xFF9FCAFF)
val GradientStartDark = Color(0xFF003258)
val GradientEndDark = Color(0xFF336791)