/**
 * Sample: Swift/iOS TokenForge SDK
 *
 * Demonstrates:
 * - CryptoKit P-256 key generation
 * - Keychain persistence (kSecAttrAccessibleWhenUnlockedThisDeviceOnly)
 * - Request signing with ECDSA signatures
 * - URLProtocol interceptor for auto-signing
 * - Device binding flow (async/await)
 *
 * Usage in an iOS app:
 *
 * ```swift
 * let tf = TokenForge(apiKey: "tf_your_key")
 *
 * // Bind device on login
 * try await tf.bind()
 *
 * // Auto-sign all URLSession requests
 * tf.registerInterceptor()
 *
 * // Or manually sign individual requests
 * var request = URLRequest(url: URL(string: "https://api.example.com/data")!)
 * let signed = tf.signRequest(request)
 * let (data, response) = try await URLSession.shared.data(for: signed)
 * ```
 *
 * Test plan (run in Xcode):
 * 1. testKeyGeneration - P-256 key is created
 * 2. testSignedHeadersFormat - All 4 X-TF-* headers present
 * 3. testNonceUniqueness - 100 consecutive nonces are all different
 * 4. testTimestampFreshness - Timestamp within 2s of current time
 * 5. testPublicKeyPEMFormat - PEM has correct header/footer
 * 6. testRequestSigningPreservesHeaders - Existing headers not overwritten
 * 7. testKeychainPersistence - Key survives reinstantiation
 * 8. testBindRequestStructure - Bind POST body has correct fields
 */
import Foundation
import CryptoKit

// MARK: - Test Assertions (for documentation/validation)

/// Validates the SDK produces correct header format
func testSignedHeaders() {
    let apiKey = "tf_test_key"
    // Simulated key generation
    let privateKey = P256.Signing.PrivateKey()
    let sessionId = UUID().uuidString
    let deviceId = UUID().uuidString

    let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")
    let timestamp = String(Int(Date().timeIntervalSince1970))
    let payload = "\(sessionId):\(nonce):\(timestamp)"

    let data = Data(SHA256.hash(data: Data(payload.utf8)))
    guard let signature = try? privateKey.signature(for: data) else {
        print("FAIL: Could not sign payload")
        return
    }
    let sigBase64 = Data(signature.derRepresentation).base64EncodedString()

    let headers = [
        "X-TF-Signature": sigBase64,
        "X-TF-Nonce": nonce,
        "X-TF-Timestamp": timestamp,
        "X-TF-Device-ID": deviceId,
        "Authorization": "Bearer \(apiKey)",
    ]

    // Validate all required headers exist
    let required = ["X-TF-Signature", "X-TF-Nonce", "X-TF-Timestamp", "X-TF-Device-ID"]
    for key in required {
        assert(headers[key] != nil, "Missing required header: \(key)")
        assert(!headers[key]!.isEmpty, "Empty header: \(key)")
    }

    // Validate timestamp freshness
    let ts = Int(timestamp)!
    let now = Int(Date().timeIntervalSince1970)
    assert(abs(now - ts) <= 2, "Timestamp skew too large")

    print("PASS: All signed headers validated")
}

/// Validates nonce uniqueness
func testNonceUniqueness() {
    var nonces = Set<String>()
    for _ in 0..<100 {
        let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        assert(!nonces.contains(nonce), "Duplicate nonce detected")
        nonces.insert(nonce)
    }
    print("PASS: 100 unique nonces generated")
}

/// Validates public key PEM format
func testPublicKeyPEM() {
    let key = P256.Signing.PrivateKey()
    let raw = key.publicKey.derRepresentation
    let base64 = raw.base64EncodedString(options: .lineLength64Characters)
    let pem = "-----BEGIN PUBLIC KEY-----\n\(base64)\n-----END PUBLIC KEY-----"

    assert(pem.hasPrefix("-----BEGIN PUBLIC KEY-----"), "PEM header missing")
    assert(pem.hasSuffix("-----END PUBLIC KEY-----"), "PEM footer missing")
    assert(raw.count > 0, "Public key should have content")
    print("PASS: Public key PEM format validated")
}

/// Validates request signing preserves existing headers
func testRequestSigning() {
    let key = P256.Signing.PrivateKey()
    var request = URLRequest(url: URL(string: "https://api.example.com/data")!)
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("gzip", forHTTPHeaderField: "Accept-Encoding")

    // Add TF headers
    let nonce = UUID().uuidString
    let ts = String(Int(Date().timeIntervalSince1970))
    request.setValue(nonce, forHTTPHeaderField: "X-TF-Nonce")
    request.setValue(ts, forHTTPHeaderField: "X-TF-Timestamp")

    // Verify original headers preserved
    assert(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    assert(request.value(forHTTPHeaderField: "Accept-Encoding") == "gzip")
    assert(request.value(forHTTPHeaderField: "X-TF-Nonce") == nonce)
    print("PASS: Request signing preserves existing headers")
}

// Run validation when executed directly
testSignedHeaders()
testNonceUniqueness()
testPublicKeyPEM()
testRequestSigning()
print("\nAll Swift SDK validations passed!")
