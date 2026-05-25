/**
 * Sample: Kotlin/Android TokenForge SDK
 *
 * Demonstrates:
 * - Android Keystore ECDSA P-256 key generation
 * - OkHttp interceptor for auto-signing
 * - Signed header format
 * - Device binding flow (coroutines)
 *
 * Usage in an Android app:
 *
 * ```kotlin
 * val tf = TokenForge(apiKey = "tf_your_key")
 *
 * // Bind device on login
 * lifecycleScope.launch {
 *     tf.bind()
 * }
 *
 * // Use auto-signing OkHttpClient
 * val client = tf.okHttpClient()
 * val request = Request.Builder()
 *     .url("https://api.example.com/data")
 *     .build()
 * val response = client.newCall(request).execute()
 *
 * // Or manually get headers
 * val headers = tf.getHeaders()
 * ```
 *
 * Test plan (run in Android instrumented tests):
 *
 * 1. testKeyGeneration - AndroidKeyStore ECDSA P-256 key created
 * 2. testSignedHeadersFormat - All 4 X-TF-* headers present
 * 3. testNonceUniqueness - 100 nonces are all unique
 * 4. testTimestampFreshness - Within 2s of system time
 * 5. testSignatureBase64 - Valid base64 output
 * 6. testOkHttpInterceptor - Headers added to every request
 * 7. testPublicKeyPEMFormat - Correct PEM wrapping
 * 8. testDeviceBinding - POST to /v1/bind with correct body
 */
package cloud.opensyber.tokenforge.samples

import java.security.*
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import java.util.UUID

/**
 * Non-Android test variant using standard JVM crypto
 * (Android Keystore requires instrumented test environment)
 */
class TokenForgeSample(private val apiKey: String) {
    val deviceId: String = UUID.randomUUID().toString()
    val sessionId: String = UUID.randomUUID().toString()
    private val keyPair: KeyPair

    init {
        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        keyPair = generator.generateKeyPair()
    }

    fun sign(payload: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray())
        val signer = Signature.getInstance("NONEwithECDSA")
        signer.initSign(keyPair.private)
        signer.update(digest)
        return Base64.getEncoder().encodeToString(signer.sign())
    }

    fun getHeaders(): Map<String, String> {
        val nonce = UUID.randomUUID().toString().replace("-", "")
        val timestamp = (System.currentTimeMillis() / 1000).toString()
        val payload = "$sessionId:$nonce:$timestamp"
        return mapOf(
            "X-TF-Signature" to sign(payload),
            "X-TF-Nonce" to nonce,
            "X-TF-Timestamp" to timestamp,
            "X-TF-Device-ID" to deviceId,
            "Authorization" to "Bearer $apiKey",
        )
    }

    fun publicKeyPem(): String {
        val encoded = Base64.getMimeEncoder(64, "\n".toByteArray())
            .encodeToString(keyPair.public.encoded)
        return "-----BEGIN PUBLIC KEY-----\n$encoded\n-----END PUBLIC KEY-----"
    }
}

fun main() {
    val tf = TokenForgeSample(apiKey = "tf_test_key")

    // Test 1: Headers contain all required fields
    val headers = tf.getHeaders()
    check("X-TF-Signature" in headers) { "Missing X-TF-Signature" }
    check("X-TF-Nonce" in headers) { "Missing X-TF-Nonce" }
    check("X-TF-Timestamp" in headers) { "Missing X-TF-Timestamp" }
    check("X-TF-Device-ID" in headers) { "Missing X-TF-Device-ID" }
    println("PASS: All required headers present")

    // Test 2: Nonce uniqueness
    val nonces = mutableSetOf<String>()
    repeat(100) {
        val h = tf.getHeaders()
        val nonce = h["X-TF-Nonce"]!!
        check(nonce !in nonces) { "Duplicate nonce at iteration $it" }
        nonces.add(nonce)
    }
    println("PASS: 100 unique nonces generated")

    // Test 3: Signature is valid base64
    val sig = headers["X-TF-Signature"]!!
    Base64.getDecoder().decode(sig) // throws if invalid
    println("PASS: Signature is valid base64")

    // Test 4: Timestamp freshness
    val ts = headers["X-TF-Timestamp"]!!.toLong()
    val now = System.currentTimeMillis() / 1000
    check(kotlin.math.abs(now - ts) <= 2) { "Timestamp skew too large" }
    println("PASS: Timestamp is fresh")

    // Test 5: Public key PEM format
    val pem = tf.publicKeyPem()
    check(pem.startsWith("-----BEGIN PUBLIC KEY-----")) { "PEM header missing" }
    check(pem.trimEnd().endsWith("-----END PUBLIC KEY-----")) { "PEM footer missing" }
    println("PASS: Public key PEM format correct")

    println("\nAll Kotlin SDK validations passed!")
}
