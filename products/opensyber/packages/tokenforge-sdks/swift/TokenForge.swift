/// TokenForge Swift SDK — Device-bound ECDSA P-256 session security for iOS.
/// Prefers Secure Enclave (hardware-backed) keys with automatic software fallback.
import Foundation
import Security
import CryptoKit

/// Wraps both Secure Enclave and software-backed P-256 signing keys.
enum TokenForgeKey {
    case software(P256.Signing.PrivateKey)
    case secureEnclave(SecureEnclave.P256.Signing.PrivateKey)

    var isHardwareBacked: Bool {
        if case .secureEnclave = self { return true }
        return false
    }

    func sign(_ data: Data) throws -> P256.Signing.ECDSASignature {
        switch self {
        case .software(let key): return try key.signature(for: data)
        case .secureEnclave(let key): return try key.signature(for: data)
        }
    }

    var publicKey: P256.Signing.PublicKey {
        switch self {
        case .software(let key): return key.publicKey
        case .secureEnclave(let key): return key.publicKey
        }
    }
}

public final class TokenForge: @unchecked Sendable {
    private let apiKey: String
    private let apiBase: String
    private let sessionId: String
    private let deviceId: String
    private let key: TokenForgeKey
    private static let keychainTag = "cloud.opensyber.tokenforge.key".data(using: .utf8)!

    /// Whether the signing key is backed by the Secure Enclave hardware.
    public var isHardwareBacked: Bool { key.isHardwareBacked }

    public init(apiKey: String, apiBase: String = "https://tokenforge-api.opensyber.cloud") {
        self.apiKey = apiKey
        self.apiBase = apiBase
        self.sessionId = UUID().uuidString
        self.deviceId = UUID().uuidString
        self.key = Self.loadOrGenerateKey()
    }

    // MARK: - Key Generation & Storage

    private static func loadOrGenerateKey() -> TokenForgeKey {
        if let existing = loadExistingKey() { return existing }
        if SecureEnclave.isAvailable, let seKey = try? SecureEnclave.P256.Signing.PrivateKey() {
            saveSecureEnclaveFlag(true)
            return .secureEnclave(seKey)
        }
        let key = P256.Signing.PrivateKey()
        saveSoftwareKey(key)
        return .software(key)
    }

    private static func loadExistingKey() -> TokenForgeKey? {
        if loadSecureEnclaveFlag(),
           let seKey = try? SecureEnclave.P256.Signing.PrivateKey() {
            return .secureEnclave(seKey)
        }
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keychainTag,
            kSecReturnData as String: true,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let key = try? P256.Signing.PrivateKey(rawRepresentation: data) else { return nil }
        return .software(key)
    }

    private static func saveSoftwareKey(_ key: P256.Signing.PrivateKey) {
        let attrs: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keychainTag,
            kSecValueData as String: key.rawRepresentation,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(attrs as CFDictionary, nil)
    }

    /// SE keys cannot be exported -- persist a flag so we know to reload from hardware.
    private static func saveSecureEnclaveFlag(_ exists: Bool) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "cloud.opensyber.tokenforge",
            kSecAttrAccount as String: "se-key-flag",
        ]
        SecItemDelete(query as CFDictionary)
        var attrs = query
        attrs[kSecValueData as String] = Data(exists ? [1] : [0])
        attrs[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(attrs as CFDictionary, nil)
    }

    private static func loadSecureEnclaveFlag() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "cloud.opensyber.tokenforge",
            kSecAttrAccount as String: "se-key-flag",
            kSecReturnData as String: true,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data, data.first == 1 else { return false }
        return true
    }

    // MARK: - Signing

    private func sign(payload: String) -> String {
        let data = Data(SHA256.hash(data: Data(payload.utf8)))
        guard let signature = try? key.sign(data) else { return "" }
        return Data(signature.derRepresentation).base64EncodedString()
    }

    public func signedHeaders() -> [String: String] {
        let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        let timestamp = String(Int(Date().timeIntervalSince1970))
        let payload = "\(sessionId):\(nonce):\(timestamp)"
        return [
            "X-TF-Signature": sign(payload: payload),
            "X-TF-Nonce": nonce,
            "X-TF-Timestamp": timestamp,
            "X-TF-Device-ID": deviceId,
            "Authorization": "Bearer \(apiKey)",
        ]
    }

    public func signRequest(_ request: URLRequest) -> URLRequest {
        var req = request
        for (header, value) in signedHeaders() { req.setValue(value, forHTTPHeaderField: header) }
        return req
    }

    // MARK: - Device Binding

    public func bind() async throws -> Data {
        let url = URL(string: "\(apiBase)/v1/bind")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "deviceId": deviceId, "sessionId": sessionId,
            "publicKey": publicKeyPEM(), "hardwareBacked": isHardwareBacked,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let signed = signRequest(request)
        let (data, response) = try await URLSession.shared.data(for: signed)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw TokenForgeError.bindFailed
        }
        return data
    }

    private func publicKeyPEM() -> String {
        let base64 = key.publicKey.derRepresentation.base64EncodedString(options: .lineLength64Characters)
        return "-----BEGIN PUBLIC KEY-----\n\(base64)\n-----END PUBLIC KEY-----"
    }

    public func registerInterceptor() {
        TokenForgeURLProtocol.tokenForge = self
        URLProtocol.registerClass(TokenForgeURLProtocol.self)
    }
}

public enum TokenForgeError: Error { case bindFailed }

public final class TokenForgeURLProtocol: URLProtocol {
    static var tokenForge: TokenForge?
    override public class func canInit(with request: URLRequest) -> Bool {
        URLProtocol.property(forKey: "TFSigned", in: request) == nil
    }

    override public class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override public func startLoading() {
        guard let tf = Self.tokenForge else { return }
        var signed = tf.signRequest(request)
        URLProtocol.setProperty(true, forKey: "TFSigned", in: signed as! NSMutableURLRequest)
        let task = URLSession.shared.dataTask(with: signed) { data, response, error in
            if let error { self.client?.urlProtocol(self, didFailWithError: error); return }
            if let response { self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed) }
            if let data { self.client?.urlProtocol(self, didLoad: data) }
            self.client?.urlProtocolDidFinishLoading(self)
        }
        task.resume()
    }

    override public func stopLoading() {}
}
