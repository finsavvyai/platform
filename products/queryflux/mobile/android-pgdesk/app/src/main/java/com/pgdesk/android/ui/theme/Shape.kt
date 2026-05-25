package com.pgdesk.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

val PGDeskShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

// Custom shapes for specific components
object PGDeskCustomShapes {

    // Cards and containers
    val cardSmall = RoundedCornerShape(8.dp)
    val cardMedium = RoundedCornerShape(12.dp)
    val cardLarge = RoundedCornerShape(16.dp)

    // Buttons
    val buttonSmall = RoundedCornerShape(8.dp)
    val buttonMedium = RoundedCornerShape(12.dp)
    val buttonLarge = RoundedCornerShape(16.dp)
    val buttonPill = RoundedCornerShape(50)

    // Input fields
    val inputField = RoundedCornerShape(8.dp)
    val inputFieldFocused = RoundedCornerShape(12.dp)

    // Code editor
    val codeEditor = RoundedCornerShape(8.dp)
    val codeBlock = RoundedCornerShape(4.dp)

    // Dialogs and modals
    val dialog = RoundedCornerShape(16.dp)
    val bottomSheet = RoundedCornerShape(
        topStart = 16.dp,
        topEnd = 16.dp,
        bottomStart = 0.dp,
        bottomEnd = 0.dp
    )

    // Data visualization
    val chartContainer = RoundedCornerShape(12.dp)
    val metricCard = RoundedCornerShape(8.dp)

    // Connection cards
    val connectionCard = RoundedCornerShape(12.dp)
    val connectionCardSelected = RoundedCornerShape(16.dp)

    // Query results
    val queryResultContainer = RoundedCornerShape(8.dp)
    val tableCell = RoundedCornerShape(4.dp)

    // AI components
    val aiChatBubble = RoundedCornerShape(
        topStart = 16.dp,
        topEnd = 16.dp,
        bottomStart = 4.dp,
        bottomEnd = 16.dp
    )
    val aiChatBubbleUser = RoundedCornerShape(
        topStart = 16.dp,
        topEnd = 16.dp,
        bottomStart = 16.dp,
        bottomEnd = 4.dp
    )

    // Voice input
    val voiceButton = RoundedCornerShape(50)
    val voiceWaveform = RoundedCornerShape(2.dp)

    // Navigation
    val navRail = RoundedCornerShape(
        topEnd = 16.dp,
        bottomEnd = 16.dp
    )
    val navDrawer = RoundedCornerShape(
        topEnd = 16.dp,
        bottomEnd = 16.dp
    )

    // Status indicators
    val statusBadge = RoundedCornerShape(50)
    val statusDot = RoundedCornerShape(50)

    // Performance metrics
    val performanceGraph = RoundedCornerShape(8.dp)
    val performanceLegend = RoundedCornerShape(4.dp)

    // Security elements
    val biometricPrompt = RoundedCornerShape(16.dp)
    val securityBadge = RoundedCornerShape(6.dp)

    // Schema browser
    val schemaTree = RoundedCornerShape(4.dp)
    val schemaNode = RoundedCornerShape(8.dp)

    // Tab shapes
    val tabIndicator = RoundedCornerShape(
        topStart = 3.dp,
        topEnd = 3.dp
    )
    val tabContainer = RoundedCornerShape(
        topStart = 8.dp,
        topEnd = 8.dp
    )

    // Floating elements
    val fab = RoundedCornerShape(16.dp)
    val fabExtended = RoundedCornerShape(16.dp)

    // Search and filters
    val searchBar = RoundedCornerShape(50)
    val filterChip = RoundedCornerShape(8.dp)
    val filterChipSelected = RoundedCornerShape(12.dp)

    // Error states
    val errorContainer = RoundedCornerShape(8.dp)
    val warningContainer = RoundedCornerShape(8.dp)
    val successContainer = RoundedCornerShape(8.dp)

    // Loading states
    val skeleton = RoundedCornerShape(4.dp)
    val progressIndicator = RoundedCornerShape(50)
}