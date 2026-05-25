package com.pgdesk.android.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pgdesk.android.ui.components.*
import com.pgdesk.android.ui.theme.*
import com.pgdesk.android.viewmodel.DashboardViewModel
import com.pgdesk.android.data.local.entity.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToConnections: () -> Unit,
    onNavigateToQuery: () -> Unit,
    onNavigateToPerformance: () -> Unit,
    onNavigateToAI: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.loadDashboardData()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Welcome Header
        WelcomeHeader(
            userName = uiState.userName,
            lastActivity = uiState.lastActivity
        )

        // Quick Actions
        QuickActionsSection(
            onNavigateToConnections = onNavigateToConnections,
            onNavigateToQuery = onNavigateToQuery,
            onNavigateToPerformance = onNavigateToPerformance,
            onNavigateToAI = onNavigateToAI
        )

        // Active Connection Overview
        AnimatedVisibility(
            visible = uiState.activeConnection != null,
            enter = fadeIn() + slideInVertically(),
            exit = fadeOut() + slideOutVertically()
        ) {
            uiState.activeConnection?.let { connection ->
                ActiveConnectionCard(
                    connection = connection,
                    onViewDetails = { onNavigateToConnections() }
                )
            }
        }

        // Performance Overview
        PerformanceOverviewSection(
            metrics = uiState.performanceMetrics,
            isLoading = uiState.isLoadingMetrics,
            onViewDetails = onNavigateToPerformance
        )

        // Recent Queries
        RecentQueriesSection(
            queries = uiState.recentQueries,
            isLoading = uiState.isLoadingQueries,
            onQueryClick = { query -> viewModel.executeQuery(query) },
            onViewAll = onNavigateToQuery
        )

        // AI Insights
        AIInsightsSection(
            insights = uiState.aiInsights,
            isLoading = uiState.isLoadingInsights,
            onInsightClick = { insight -> viewModel.markInsightAsRead(insight.id) },
            onViewAll = onNavigateToAI
        )

        // System Status
        SystemStatusSection(
            connectionStatus = uiState.connectionStatus,
            apiStatus = uiState.apiStatus,
            lastSync = uiState.lastSyncTime
        )
    }

    // Error handling
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            // Show snackbar or error dialog
        }
    }
}

@Composable
private fun WelcomeHeader(
    userName: String,
    lastActivity: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        shape = PGDeskCustomShapes.cardLarge
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "Welcome back, $userName",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                fontWeight = FontWeight.Bold
            )
            lastActivity?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Last active: $it",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun QuickActionsSection(
    onNavigateToConnections: () -> Unit,
    onNavigateToQuery: () -> Unit,
    onNavigateToPerformance: () -> Unit,
    onNavigateToAI: () -> Unit
) {
    Text(
        text = "Quick Actions",
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.SemiBold
    )

    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(horizontal = 4.dp)
    ) {
        items(
            listOf(
                QuickAction("Connections", Icons.Default.Storage, onNavigateToConnections),
                QuickAction("Query Editor", Icons.Default.Code, onNavigateToQuery),
                QuickAction("Performance", Icons.Default.Analytics, onNavigateToPerformance),
                QuickAction("AI Assistant", Icons.Default.Psychology, onNavigateToAI)
            )
        ) { action ->
            QuickActionCard(action = action)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickActionCard(
    action: QuickAction
) {
    Card(
        onClick = action.onClick,
        modifier = Modifier
            .width(120.dp)
            .height(100.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = PGDeskCustomShapes.cardMedium
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = action.icon,
                contentDescription = action.title,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = action.title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ActiveConnectionCard(
    connection: DatabaseConnection,
    onViewDetails: () -> Unit
) {
    Card(
        onClick = onViewDetails,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.successContainer
        ),
        shape = PGDeskCustomShapes.connectionCard
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = "Connected",
                tint = MaterialTheme.colorScheme.success,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = connection.name,
                    style = PGDeskCustomTypography.connectionName,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${connection.host}:${connection.port}/${connection.database}",
                    style = PGDeskCustomTypography.connectionDetails,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            Icon(
                imageVector = Icons.Default.ArrowForward,
                contentDescription = "View details",
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun PerformanceOverviewSection(
    metrics: List<PerformanceMetric>,
    isLoading: Boolean,
    onViewDetails: () -> Unit
) {
    SectionHeader(
        title = "Performance Overview",
        actionText = "View All",
        onActionClick = onViewDetails
    )

    if (isLoading) {
        PerformanceMetricsLoading()
    } else {
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 4.dp)
        ) {
            items(metrics.take(4)) { metric ->
                PerformanceMetricCard(metric = metric)
            }
        }
    }
}

@Composable
private fun RecentQueriesSection(
    queries: List<QueryHistory>,
    isLoading: Boolean,
    onQueryClick: (QueryHistory) -> Unit,
    onViewAll: () -> Unit
) {
    SectionHeader(
        title = "Recent Queries",
        actionText = "View All",
        onActionClick = onViewAll
    )

    if (isLoading) {
        RecentQueriesLoading()
    } else {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            queries.take(3).forEach { query ->
                QueryHistoryItem(
                    query = query,
                    onClick = { onQueryClick(query) }
                )
            }
        }
    }
}

@Composable
private fun AIInsightsSection(
    insights: List<AIInsight>,
    isLoading: Boolean,
    onInsightClick: (AIInsight) -> Unit,
    onViewAll: () -> Unit
) {
    SectionHeader(
        title = "AI Insights",
        actionText = "View All",
        onActionClick = onViewAll
    )

    if (isLoading) {
        AIInsightsLoading()
    } else {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            insights.take(3).forEach { insight ->
                AIInsightCard(
                    insight = insight,
                    onClick = { onInsightClick(insight) }
                )
            }
        }
    }
}

@Composable
private fun SystemStatusSection(
    connectionStatus: String,
    apiStatus: String,
    lastSync: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        shape = PGDeskCustomShapes.cardMedium
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "System Status",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(12.dp))

            StatusRow(
                label = "Database Connection",
                status = connectionStatus,
                isGood = connectionStatus == "Connected"
            )
            StatusRow(
                label = "API Service",
                status = apiStatus,
                isGood = apiStatus == "Online"
            )
            lastSync?.let {
                StatusRow(
                    label = "Last Sync",
                    status = it,
                    isGood = true
                )
            }
        }
    }
}

@Composable
private fun StatusRow(
    label: String,
    status: String,
    isGood: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isGood) Icons.Default.CheckCircle else Icons.Default.Error,
                contentDescription = null,
                tint = if (isGood) MaterialTheme.colorScheme.success else MaterialTheme.colorScheme.error,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = status,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
    Spacer(modifier = Modifier.height(8.dp))
}

// Data classes
private data class QuickAction(
    val title: String,
    val icon: ImageVector,
    val onClick: () -> Unit
)