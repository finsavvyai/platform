package com.pgdesk.android.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.pgdesk.android.ui.screens.*
import com.pgdesk.android.ui.theme.PGDeskCustomShapes
import com.pgdesk.android.utils.WindowSizeClass
import com.pgdesk.android.utils.calculateWindowSizeClass

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PGDeskNavigation(
    navController: NavHostController = rememberNavController(),
    startDestination: String = "dashboard",
    modifier: Modifier = Modifier
) {
    val configuration = LocalConfiguration.current
    val windowSizeClass = calculateWindowSizeClass(configuration)

    val showNavigationRail = windowSizeClass.widthSizeClass >= WindowSizeClass.MEDIUM
    val showBottomNavigation = !showNavigationRail

    if (showNavigationRail) {
        Row(modifier = modifier.fillMaxSize()) {
            PGDeskNavigationRail(
                navController = navController,
                modifier = Modifier.widthIn(max = 200.dp)
            )
            PGDeskNavHost(
                navController = navController,
                startDestination = startDestination,
                modifier = Modifier.weight(1f)
            )
        }
    } else {
        Scaffold(
            bottomBar = {
                if (showBottomNavigation) {
                    PGDeskBottomNavigation(navController = navController)
                }
            }
        ) { paddingValues ->
            PGDeskNavHost(
                navController = navController,
                startDestination = startDestination,
                modifier = modifier.padding(paddingValues)
            )
        }
    }
}

@Composable
private fun PGDeskNavHost(
    navController: NavHostController,
    startDestination: String,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
        enterTransition = {
            slideInHorizontally(
                initialOffsetX = { it / 3 }
            ) + fadeIn()
        },
        exitTransition = {
            slideOutHorizontally(
                targetOffsetX = { -it / 3 }
            ) + fadeOut()
        },
        popEnterTransition = {
            slideInHorizontally(
                initialOffsetX = { -it / 3 }
            ) + fadeIn()
        },
        popExitTransition = {
            slideOutHorizontally(
                targetOffsetX = { it / 3 }
            ) + fadeOut()
        }
    ) {
        composable("dashboard") {
            DashboardScreen(
                onNavigateToConnections = {
                    navController.navigate("connections") {
                        launchSingleTop = true
                    }
                },
                onNavigateToQuery = {
                    navController.navigate("query") {
                        launchSingleTop = true
                    }
                },
                onNavigateToPerformance = {
                    navController.navigate("performance") {
                        launchSingleTop = true
                    }
                },
                onNavigateToAI = {
                    navController.navigate("ai_assistant") {
                        launchSingleTop = true
                    }
                }
            )
        }

        composable("connections") {
            ConnectionsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onConnectionSelect = { connectionId ->
                    navController.navigate("connection_detail/$connectionId")
                },
                onCreateConnection = {
                    navController.navigate("connection_setup")
                }
            )
        }

        composable("connection_setup") {
            ConnectionSetupScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onConnectionSaved = {
                    navController.popBackStack("connections", false)
                }
            )
        }

        composable("connection_detail/{connectionId}") { backStackEntry ->
            val connectionId = backStackEntry.arguments?.getString("connectionId") ?: ""
            ConnectionDetailScreen(
                connectionId = connectionId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onEditConnection = {
                    navController.navigate("connection_edit/$connectionId")
                }
            )
        }

        composable("connection_edit/{connectionId}") { backStackEntry ->
            val connectionId = backStackEntry.arguments?.getString("connectionId") ?: ""
            ConnectionEditScreen(
                connectionId = connectionId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onConnectionUpdated = {
                    navController.popBackStack("connection_detail/$connectionId", false)
                }
            )
        }

        composable("query") {
            QueryScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onOpenVoiceInput = {
                    navController.navigate("voice_input")
                },
                onOpenAIAssistant = {
                    navController.navigate("ai_assistant")
                }
            )
        }

        composable("voice_input") {
            VoiceInputScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onQueryGenerated = { query ->
                    navController.previousBackStackEntry?.arguments?.putString("generated_query", query)
                    navController.popBackStack()
                }
            )
        }

        composable("performance") {
            PerformanceScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onViewMetricDetail = { metricId ->
                    navController.navigate("performance_detail/$metricId")
                }
            )
        }

        composable("performance_detail/{metricId}") { backStackEntry ->
            val metricId = backStackEntry.arguments?.getString("metricId") ?: ""
            PerformanceDetailScreen(
                metricId = metricId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable("ai_assistant") {
            AIAssistantScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onExecuteQuery = { query ->
                    navController.navigate("query") {
                        launchSingleTop = true
                    }
                    // Pass query to query screen
                },
                onOpenVoiceInput = {
                    navController.navigate("voice_input")
                }
            )
        }

        composable("schema_browser") {
            SchemaBrowserScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onTableSelect = { tableName ->
                    navController.navigate("table_detail/$tableName")
                }
            )
        }

        composable("table_detail/{tableName}") { backStackEntry ->
            val tableName = backStackEntry.arguments?.getString("tableName") ?: ""
            TableDetailScreen(
                tableName = tableName,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onGenerateQuery = { query ->
                    navController.navigate("query") {
                        launchSingleTop = true
                    }
                    // Pass generated query
                }
            )
        }

        composable("settings") {
            SettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToSecurity = {
                    navController.navigate("security_settings")
                },
                onNavigateToPreferences = {
                    navController.navigate("preferences")
                }
            )
        }

        composable("security_settings") {
            SecuritySettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable("preferences") {
            PreferencesScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable("help") {
            HelpScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}

@Composable
private fun PGDeskBottomNavigation(
    navController: NavHostController
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surfaceContainer,
        tonalElevation = 3.dp
    ) {
        bottomNavItems.forEach { item ->
            NavigationBarItem(
                icon = {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.title
                    )
                },
                label = {
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.labelMedium
                    )
                },
                selected = currentDestination?.hierarchy?.any { it.route == item.route } == true,
                onClick = {
                    navController.navigate(item.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    indicatorColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }
}

@Composable
private fun PGDeskNavigationRail(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    NavigationRail(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
        header = {
            FloatingActionButton(
                onClick = {
                    navController.navigate("ai_assistant") {
                        launchSingleTop = true
                    }
                },
                modifier = Modifier.padding(16.dp),
                containerColor = MaterialTheme.colorScheme.primary,
                shape = PGDeskCustomShapes.fab
            ) {
                Icon(
                    imageVector = Icons.Default.Psychology,
                    contentDescription = "AI Assistant"
                )
            }
        }
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        railNavItems.forEach { item ->
            NavigationRailItem(
                icon = {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.title
                    )
                },
                label = {
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.labelMedium
                    )
                },
                selected = currentDestination?.hierarchy?.any { it.route == item.route } == true,
                onClick = {
                    navController.navigate(item.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                colors = NavigationRailItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    indicatorColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }
}

// Navigation items
private val bottomNavItems = listOf(
    NavigationItem(
        title = "Dashboard",
        icon = Icons.Default.Dashboard,
        route = "dashboard"
    ),
    NavigationItem(
        title = "Connections",
        icon = Icons.Default.Storage,
        route = "connections"
    ),
    NavigationItem(
        title = "Query",
        icon = Icons.Default.Code,
        route = "query"
    ),
    NavigationItem(
        title = "Performance",
        icon = Icons.Default.Analytics,
        route = "performance"
    ),
    NavigationItem(
        title = "Settings",
        icon = Icons.Default.Settings,
        route = "settings"
    )
)

private val railNavItems = listOf(
    NavigationItem(
        title = "Dashboard",
        icon = Icons.Default.Dashboard,
        route = "dashboard"
    ),
    NavigationItem(
        title = "Connections",
        icon = Icons.Default.Storage,
        route = "connections"
    ),
    NavigationItem(
        title = "Query",
        icon = Icons.Default.Code,
        route = "query"
    ),
    NavigationItem(
        title = "Schema",
        icon = Icons.Default.Schema,
        route = "schema_browser"
    ),
    NavigationItem(
        title = "Performance",
        icon = Icons.Default.Analytics,
        route = "performance"
    ),
    NavigationItem(
        title = "Settings",
        icon = Icons.Default.Settings,
        route = "settings"
    ),
    NavigationItem(
        title = "Help",
        icon = Icons.Default.Help,
        route = "help"
    )
)

private data class NavigationItem(
    val title: String,
    val icon: ImageVector,
    val route: String
)