# TokenForge Kotlin SDK

Device-bound ECDSA P-256 session security for Android. Keys stored in Android Keystore.

## Install

### Gradle

```kotlin
dependencies {
    implementation("cloud.opensyber:tokenforge:1.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
```

## Quick Start

```kotlin
val tf = TokenForge(apiKey = "tf_your_api_key")

// Register device (coroutine)
lifecycleScope.launch {
    tf.bind()
}
```

## OkHttp Interceptor (Recommended)

```kotlin
// All requests through this client are auto-signed
val client = tf.okHttpClient()

val request = Request.Builder()
    .url("https://api.example.com/data")
    .build()

client.newCall(request).enqueue(object : Callback {
    override fun onResponse(call: Call, response: Response) {
        // Response from signed request
    }
    override fun onFailure(call: Call, e: IOException) { }
})
```

## Manual Signing

```kotlin
val request = Request.Builder()
    .url("https://api.example.com/data")
    .build()

val signed = tf.signRequest(request)
// signed includes X-TF-Signature, X-TF-Nonce, X-TF-Timestamp, X-TF-Device-ID
```

## With Retrofit

```kotlin
val client = tf.okHttpClient()

val retrofit = Retrofit.Builder()
    .baseUrl("https://api.example.com/")
    .client(client)
    .addConverterFactory(GsonConverterFactory.create())
    .build()
```

## Android App Example

```kotlin
class MyApp : Application() {
    lateinit var tokenForge: TokenForge

    override fun onCreate() {
        super.onCreate()
        tokenForge = TokenForge(apiKey = BuildConfig.TF_API_KEY)
        CoroutineScope(Dispatchers.IO).launch { tokenForge.bind() }
    }
}
```

## How It Works

1. Generates ECDSA P-256 keypair in Android Keystore (hardware-backed when available)
2. Signs `{sessionId}:{nonce}:{timestamp}` with ECDSA-SHA256
3. Registers public key via `POST /v1/bind`
4. OkHttp interceptor auto-signs every request

## API

| Method | Description |
|--------|-------------|
| `TokenForge(apiKey)` | Create client |
| `bind()` | Register device (suspend) |
| `signRequest(request)` | Sign an OkHttp Request |
| `getHeaders()` | Get signed headers map |
| `interceptor()` | OkHttp Interceptor |
| `okHttpClient()` | Pre-configured OkHttpClient |
