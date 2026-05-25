package com.pgdesk.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.rememberNavController
import com.pgdesk.android.navigation.PGDeskNavigation
import com.pgdesk.android.ui.auth.AuthScreen
import com.pgdesk.android.ui.theme.PGDeskTheme
import com.pgdesk.android.viewmodel.MainViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // Install splash screen
        val splashScreen = installSplashScreen()

        super.onCreate(savedInstanceState)

        // Keep splash screen until app is ready
        splashScreen.setKeepOnScreenCondition {
            viewModel.isLoading.value
        }

        setContent {
            PGDeskTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    PGDeskApp(viewModel)
                }
            }
        }
    }
}

@Composable
private fun PGDeskApp(viewModel: MainViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val navController = rememberNavController()

    LaunchedEffect(Unit) {
        viewModel.initialize()
    }

    when {
        uiState.isLoading -> {
            // Splash screen is handling the loading state
        }
        !uiState.isAuthenticated -> {
            AuthScreen(
                onAuthSuccess = {
                    viewModel.onAuthSuccess()
                },
                onBiometricAuthRequested = {
                    viewModel.requestBiometricAuth()
                }
            )
        }
        uiState.needsConnectionSetup -> {
            // Navigate to connection setup
            LaunchedEffect(Unit) {
                navController.navigate("connection_setup")
            }
        }
        else -> {
            PGDeskNavigation(
                navController = navController,
                startDestination = "dashboard"
            )
        }
    }
}