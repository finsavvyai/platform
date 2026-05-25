package com.pgdesk.android.services

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

@Singleton
class BiometricAuthService @Inject constructor(
    @ApplicationContext private val context: Context
) {

    fun isBiometricAvailable(): BiometricAvailability {
        val biometricManager = BiometricManager.from(context)
        return when (biometricManager.canAuthenticate(AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_SUCCESS ->
                BiometricAvailability.AVAILABLE

            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                BiometricAvailability.NO_HARDWARE

            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                BiometricAvailability.HARDWARE_UNAVAILABLE

            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                BiometricAvailability.NONE_ENROLLED

            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED ->
                BiometricAvailability.SECURITY_UPDATE_REQUIRED

            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED ->
                BiometricAvailability.UNSUPPORTED

            BiometricManager.BIOMETRIC_STATUS_UNKNOWN ->
                BiometricAvailability.UNKNOWN

            else -> BiometricAvailability.UNKNOWN
        }
    }

    suspend fun authenticate(
        activity: FragmentActivity,
        title: String = "Biometric Authentication",
        subtitle: String = "Use your biometric credential to authenticate",
        negativeButtonText: String = "Cancel"
    ): BiometricAuthResult = suspendCancellableCoroutine { continuation ->

        if (isBiometricAvailable() != BiometricAvailability.AVAILABLE) {
            continuation.resume(
                BiometricAuthResult(
                    isSuccess = false,
                    error = "Biometric authentication not available"
                )
            )
            return@suspendCancellableCoroutine
        }

        val executor = ContextCompat.getMainExecutor(context)
        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)

                    val errorMessage = when (errorCode) {
                        BiometricPrompt.ERROR_HW_UNAVAILABLE -> "Biometric hardware unavailable"
                        BiometricPrompt.ERROR_UNABLE_TO_PROCESS -> "Unable to process biometric"
                        BiometricPrompt.ERROR_TIMEOUT -> "Authentication timeout"
                        BiometricPrompt.ERROR_NO_SPACE -> "Not enough storage space"
                        BiometricPrompt.ERROR_CANCELED -> "Authentication cancelled"
                        BiometricPrompt.ERROR_LOCKOUT -> "Too many attempts, try again later"
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "Authentication locked permanently"
                        BiometricPrompt.ERROR_USER_CANCELED -> "User cancelled authentication"
                        BiometricPrompt.ERROR_NO_BIOMETRICS -> "No biometric enrolled"
                        BiometricPrompt.ERROR_HW_NOT_PRESENT -> "No biometric hardware"
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "Authentication cancelled by user"
                        BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> "No device credential set"
                        else -> errString.toString()
                    }

                    if (continuation.isActive) {
                        continuation.resume(
                            BiometricAuthResult(
                                isSuccess = false,
                                error = errorMessage,
                                errorCode = errorCode
                            )
                        )
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)

                    if (continuation.isActive) {
                        continuation.resume(
                            BiometricAuthResult(
                                isSuccess = true,
                                authenticationType = when (result.authenticationType) {
                                    BiometricPrompt.AUTHENTICATION_RESULT_TYPE_BIOMETRIC ->
                                        AuthenticationType.BIOMETRIC
                                    BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL ->
                                        AuthenticationType.DEVICE_CREDENTIAL
                                    else -> AuthenticationType.UNKNOWN
                                }
                            )
                        )
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Don't resume here, let user try again
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(AUTHENTICATORS)
            .setNegativeButtonText(negativeButtonText)
            .setConfirmationRequired(true)
            .build()

        // Handle cancellation
        continuation.invokeOnCancellation {
            try {
                // BiometricPrompt doesn't have a direct cancel method
                // The prompt will be dismissed when the activity is destroyed
            } catch (e: Exception) {
                // Ignore cancellation errors
            }
        }

        biometricPrompt.authenticate(promptInfo)
    }

    fun getBiometricCapabilities(): BiometricCapabilities {
        val biometricManager = BiometricManager.from(context)

        val fingerprintAvailable = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS

        val strongBiometricAvailable = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS

        val deviceCredentialAvailable = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        ) == BiometricManager.BIOMETRIC_SUCCESS

        return BiometricCapabilities(
            fingerprintAvailable = fingerprintAvailable,
            strongBiometricAvailable = strongBiometricAvailable,
            deviceCredentialAvailable = deviceCredentialAvailable,
            combinedAuthAvailable = biometricManager.canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS
        )
    }

    companion object {
        private const val AUTHENTICATORS =
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
    }
}

enum class BiometricAvailability {
    AVAILABLE,
    NO_HARDWARE,
    HARDWARE_UNAVAILABLE,
    NONE_ENROLLED,
    SECURITY_UPDATE_REQUIRED,
    UNSUPPORTED,
    UNKNOWN
}

enum class AuthenticationType {
    BIOMETRIC,
    DEVICE_CREDENTIAL,
    UNKNOWN
}

data class BiometricAuthResult(
    val isSuccess: Boolean,
    val error: String? = null,
    val errorCode: Int? = null,
    val authenticationType: AuthenticationType = AuthenticationType.UNKNOWN
)

data class BiometricCapabilities(
    val fingerprintAvailable: Boolean,
    val strongBiometricAvailable: Boolean,
    val deviceCredentialAvailable: Boolean,
    val combinedAuthAvailable: Boolean
)