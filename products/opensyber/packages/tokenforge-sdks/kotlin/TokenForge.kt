/**
 * TokenForge Kotlin SDK — Device-bound ECDSA P-256 session security for Android.
 */
package cloud.opensyber.tokenforge

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.security.*
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import java.util.UUID

class TokenForge(
    private val apiKey: String,
    private val apiBase: String = "https://tokenforge-api.opensyber.cloud",
) {
    val deviceId: String = UUID.randomUUID().toString()
    val sessionId: String = UUID.randomUUID().toString()
    private val keyPair: KeyPair = loadOrGenerateKey()
    private val client = OkHttpClient()

    private fun loadOrGenerateKey(): KeyPair {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (ks.containsAlias(KEYSTORE_ALIAS)) {
            val entry = ks.getEntry(KEYSTORE_ALIAS, null) as KeyStore.PrivateKeyEntry
            return KeyPair(entry.certificate.publicKey, entry.privateKey)
        }
        val spec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)
            .build()
        val generator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore",
        )
        generator.initialize(spec)
        return generator.generateKeyPair()
    }

    private fun sign(payload: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray())
        val signer = Signature.getInstance("NONEwithECDSA").apply {
            initSign(keyPair.private)
            update(digest)
        }
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

    fun signRequest(request: Request): Request {
        val builder = request.newBuilder()
        getHeaders().forEach { (k, v) -> builder.header(k, v) }
        return builder.build()
    }

    suspend fun bind(): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("deviceId", deviceId)
            put("sessionId", sessionId)
            put("publicKey", publicKeyPem())
        }
        val request = Request.Builder()
            .url("$apiBase/v1/bind")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        val signed = signRequest(request)
        val response = client.newCall(signed).execute()
        check(response.isSuccessful) { "Bind failed: ${response.code}" }
        response.body?.string() ?: ""
    }

    fun interceptor(): Interceptor = Interceptor { chain ->
        val signed = signRequest(chain.request())
        chain.proceed(signed)
    }

    fun okHttpClient(): OkHttpClient {
        return OkHttpClient.Builder().addInterceptor(interceptor()).build()
    }

    private fun publicKeyPem(): String {
        val encoded = Base64.getMimeEncoder(64, "\n".toByteArray())
            .encodeToString(keyPair.public.encoded)
        return "-----BEGIN PUBLIC KEY-----\n$encoded\n-----END PUBLIC KEY-----"
    }

    companion object {
        private const val KEYSTORE_ALIAS = "tokenforge_device_key"
    }
}
