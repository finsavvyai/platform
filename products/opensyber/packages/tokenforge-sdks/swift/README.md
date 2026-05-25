# TokenForge Swift SDK

Device-bound ECDSA P-256 session security for iOS. Keys stored in the iOS Keychain.

## Install

### Swift Package Manager

```swift
dependencies: [
    .package(url: "https://github.com/opensyber/tokenforge-swift", from: "1.0.0")
]
```

### CocoaPods

```ruby
pod 'TokenForge', '~> 1.0'
```

## Quick Start

```swift
import TokenForge

let tf = TokenForge(apiKey: "tf_your_api_key")

// Register device
Task {
    try await tf.bind()
}
```

## Sign Requests

```swift
// Manual signing
var request = URLRequest(url: URL(string: "https://api.example.com/data")!)
request = tf.signRequest(request)

// All requests now include:
// X-TF-Signature, X-TF-Nonce, X-TF-Timestamp, X-TF-Device-ID
```

## Auto-Sign All Requests (URLProtocol Interceptor)

```swift
// Register once at app launch
tf.registerInterceptor()

// All URLSession requests are now automatically signed
let (data, _) = try await URLSession.shared.data(from: url)
```

## iOS App Example

```swift
class AppDelegate: UIApplicationDelegate {
    let tokenForge = TokenForge(apiKey: "tf_your_api_key")

    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: ...) -> Bool {
        Task {
            try await tokenForge.bind()
            tokenForge.registerInterceptor()
        }
        return true
    }
}
```

## How It Works

1. Generates ECDSA P-256 keypair using Apple CryptoKit
2. Stores private key in iOS Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`)
3. Signs `{sessionId}:{nonce}:{timestamp}` with ECDSA-SHA256
4. Registers public key via `POST /v1/bind`

## API

| Method | Description |
|--------|-------------|
| `TokenForge(apiKey:)` | Create client (generates/loads key) |
| `bind()` | Register device (async) |
| `signRequest(_:)` | Sign a URLRequest |
| `signedHeaders()` | Get signed headers dictionary |
| `registerInterceptor()` | Auto-sign via URLProtocol |
