package com.pgdesk.android.services

import android.app.Service
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Binder
import android.os.IBinder
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import com.pgdesk.android.data.repository.AIRepository
import com.pgdesk.android.utils.PermissionUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.ByteArrayOutputStream
import java.util.*
import javax.inject.Inject

@AndroidEntryPoint
class VoiceInputService : Service() {

    @Inject
    lateinit var aiRepository: AIRepository

    private val binder = VoiceInputBinder()
    private var speechRecognizer: SpeechRecognizer? = null
    private var audioRecord: AudioRecord? = null

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _voiceState = MutableStateFlow(VoiceInputState())
    val voiceState: StateFlow<VoiceInputState> = _voiceState.asStateFlow()

    private val _transcriptionResult = MutableStateFlow<TranscriptionResult?>(null)
    val transcriptionResult: StateFlow<TranscriptionResult?> = _transcriptionResult.asStateFlow()

    companion object {
        private const val TAG = "VoiceInputService"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_FACTOR = 2
    }

    inner class VoiceInputBinder : Binder() {
        fun getService(): VoiceInputService = this@VoiceInputService
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        initializeSpeechRecognizer()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopListening()
        speechRecognizer?.destroy()
        serviceScope.cancel()
    }

    private fun initializeSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                setRecognitionListener(speechRecognitionListener)
            }
        } else {
            Log.e(TAG, "Speech recognition not available")
            _voiceState.value = _voiceState.value.copy(
                isAvailable = false,
                error = "Speech recognition not available on this device"
            )
        }
    }

    fun startListening(connectionId: String? = null) {
        if (!PermissionUtils.hasAudioPermission(this)) {
            _voiceState.value = _voiceState.value.copy(
                error = "Audio recording permission not granted"
            )
            return
        }

        _voiceState.value = _voiceState.value.copy(
            isListening = true,
            isProcessing = false,
            error = null,
            currentConnectionId = connectionId
        )

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        }

        speechRecognizer?.startListening(intent)
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        _voiceState.value = _voiceState.value.copy(
            isListening = false,
            isProcessing = false
        )
    }

    fun cancelListening() {
        speechRecognizer?.cancel()
        stopListening()

        _voiceState.value = _voiceState.value.copy(
            isListening = false,
            isProcessing = false,
            error = null
        )
    }

    private fun processTranscription(text: String, connectionId: String?) {
        serviceScope.launch {
            try {
                _voiceState.value = _voiceState.value.copy(
                    isProcessing = true,
                    error = null
                )

                // Convert voice to SQL using AI repository
                val result = if (connectionId != null) {
                    aiRepository.convertVoiceToSQL(text, connectionId)
                } else {
                    aiRepository.processNaturalLanguage(text)
                }

                _transcriptionResult.value = TranscriptionResult(
                    originalText = text,
                    sqlQuery = result.query,
                    explanation = result.explanation,
                    confidence = result.confidence,
                    needsConfirmation = result.needsConfirmation,
                    clarificationQuestions = result.clarificationQuestions
                )

                _voiceState.value = _voiceState.value.copy(
                    isProcessing = false,
                    lastTranscription = text
                )

            } catch (e: Exception) {
                Log.e(TAG, "Error processing transcription", e)
                _voiceState.value = _voiceState.value.copy(
                    isProcessing = false,
                    error = "Failed to process voice input: ${e.message}"
                )
            }
        }
    }

    fun clearTranscriptionResult() {
        _transcriptionResult.value = null
    }

    private val speechRecognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            _voiceState.value = _voiceState.value.copy(
                isListening = true,
                error = null
            )
        }

        override fun onBeginningOfSpeech() {
            _voiceState.value = _voiceState.value.copy(
                isListening = true
            )
        }

        override fun onRmsChanged(rmsdB: Float) {
            _voiceState.value = _voiceState.value.copy(
                audioLevel = rmsdB
            )
        }

        override fun onBufferReceived(buffer: ByteArray?) {
            // Handle audio buffer if needed for custom processing
        }

        override fun onEndOfSpeech() {
            _voiceState.value = _voiceState.value.copy(
                isListening = false,
                isProcessing = true
            )
        }

        override fun onError(error: Int) {
            val errorMessage = when (error) {
                SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                SpeechRecognizer.ERROR_CLIENT -> "Client side error"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                SpeechRecognizer.ERROR_NETWORK -> "Network error"
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                SpeechRecognizer.ERROR_NO_MATCH -> "No speech input was detected"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognition service busy"
                SpeechRecognizer.ERROR_SERVER -> "Server error"
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
                else -> "Unknown error occurred"
            }

            Log.e(TAG, "Speech recognition error: $errorMessage (code: $error)")
            _voiceState.value = _voiceState.value.copy(
                isListening = false,
                isProcessing = false,
                error = errorMessage
            )
        }

        override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val confidence = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)

            if (!matches.isNullOrEmpty()) {
                val bestMatch = matches[0]
                val bestConfidence = confidence?.get(0) ?: 0.0f

                Log.d(TAG, "Speech recognition result: $bestMatch (confidence: $bestConfidence)")

                if (bestConfidence > 0.6f) { // Minimum confidence threshold
                    processTranscription(bestMatch, _voiceState.value.currentConnectionId)
                } else {
                    _voiceState.value = _voiceState.value.copy(
                        isListening = false,
                        isProcessing = false,
                        error = "Speech recognition confidence too low. Please try again."
                    )
                }
            } else {
                _voiceState.value = _voiceState.value.copy(
                    isListening = false,
                    isProcessing = false,
                    error = "No speech was recognized"
                )
            }
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            if (!matches.isNullOrEmpty()) {
                _voiceState.value = _voiceState.value.copy(
                    partialTranscription = matches[0]
                )
            }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {
            // Handle speech events if needed
        }
    }

    // Advanced audio recording for custom processing
    fun startAdvancedRecording(): ByteArrayOutputStream? {
        if (!PermissionUtils.hasAudioPermission(this)) {
            return null
        }

        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT
        ) * BUFFER_SIZE_FACTOR

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT,
            bufferSize
        )

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord initialization failed")
            return null
        }

        val audioData = ByteArrayOutputStream()
        audioRecord?.startRecording()

        serviceScope.launch(Dispatchers.IO) {
            val buffer = ShortArray(bufferSize / 2)
            while (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                val readResult = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (readResult > 0) {
                    // Convert short array to byte array
                    val byteBuffer = ByteArray(readResult * 2)
                    for (i in 0 until readResult) {
                        val shortVal = buffer[i]
                        byteBuffer[i * 2] = (shortVal.toInt() and 0xFF).toByte()
                        byteBuffer[i * 2 + 1] = ((shortVal.toInt() shr 8) and 0xFF).toByte()
                    }
                    audioData.write(byteBuffer)
                }
            }
        }

        return audioData
    }
}

data class VoiceInputState(
    val isListening: Boolean = false,
    val isProcessing: Boolean = false,
    val isAvailable: Boolean = true,
    val error: String? = null,
    val audioLevel: Float = 0.0f,
    val partialTranscription: String = "",
    val lastTranscription: String = "",
    val currentConnectionId: String? = null
)

data class TranscriptionResult(
    val originalText: String,
    val sqlQuery: String,
    val explanation: String,
    val confidence: Double,
    val needsConfirmation: Boolean = false,
    val clarificationQuestions: List<String> = emptyList()
)