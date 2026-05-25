package com.pgdesk.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pgdesk.android.data.repository.AuthRepository
import com.pgdesk.android.data.repository.ConnectionRepository
import com.pgdesk.android.services.BiometricAuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val connectionRepository: ConnectionRepository,
    private val biometricAuthService: BiometricAuthService
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun initialize() {
        viewModelScope.launch {
            try {
                // Check if user is authenticated
                val isAuthenticated = authRepository.isUserAuthenticated()

                // Check if connections exist
                val hasConnections = connectionRepository.hasConnections()

                _uiState.value = _uiState.value.copy(
                    isAuthenticated = isAuthenticated,
                    needsConnectionSetup = !hasConnections,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isAuthenticated = false,
                    error = e.message,
                    isLoading = false
                )
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun onAuthSuccess() {
        _uiState.value = _uiState.value.copy(
            isAuthenticated = true,
            error = null
        )
    }

    fun requestBiometricAuth() {
        viewModelScope.launch {
            try {
                val result = biometricAuthService.authenticate()
                if (result.isSuccess) {
                    onAuthSuccess()
                } else {
                    _uiState.value = _uiState.value.copy(
                        error = "Biometric authentication failed"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = e.message
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

data class MainUiState(
    val isLoading: Boolean = true,
    val isAuthenticated: Boolean = false,
    val needsConnectionSetup: Boolean = false,
    val error: String? = null
)