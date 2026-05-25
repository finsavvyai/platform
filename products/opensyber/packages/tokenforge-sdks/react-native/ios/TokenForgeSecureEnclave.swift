import Foundation
import CryptoKit
import Security

/**
 * Hardware-backed ECDSA P-256 key storage for TokenForge on iOS.
 *
 * Key hierarchy:
 *  1. Secure Enclave (`SecureEnclave.P256.Signing.PrivateKey`) — preferred
 *  2. Software P-256 with Keychain persistence — fallback (older devices)
 *
 * The private key never leaves the Secure Enclave. Callers receive
 * the public key as raw bytes (x963 representation) and signatures
 * in DER format.
 */
@objc(TokenForgeSecureEnclave)
class TokenForgeSecureEnclave: NSObject {

    private static let keychainTag = "cloud.opensyber.tokenforge.device-key"
    private static var hardwareBacked = false

    // MARK: - Public API

    /// Generate an ECDSA P-256 keypair. Prefers Secure Enclave; falls back
    /// to software + Keychain.
    ///
    /// - Returns: Public key as raw bytes (x963 uncompressed, 65 bytes).
    @objc static func generateKey() -> Data {
        deleteKey()

        if SecureEnclave.isAvailable {
            return generateSecureEnclaveKey()
        }
        return generateSoftwareKey()
    }

    /// Sign `data` with the stored private key.
    ///
    /// - Parameter data: Raw bytes to sign.
    /// - Returns: DER-encoded ECDSA signature.
    @objc static func sign(_ data: Data) -> Data {
        if hardwareBacked {
            return signWithSecureEnclave(data)
        }
        return signWithSoftwareKey(data)
    }

    /// Whether a TokenForge key exists.
    @objc static func hasHardwareKey() -> Bool {
        return loadKeychainData() != nil
    }

    /// Whether the current key is backed by the Secure Enclave.
    @objc static func isHardwareBacked() -> Bool {
        return hardwareBacked
    }

    /// Delete the TokenForge key from storage.
    @objc static func deleteKey() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainTag,
        ]
        SecItemDelete(query as CFDictionary)
        hardwareBacked = false
    }

    // MARK: - Secure Enclave path

    private static func generateSecureEnclaveKey() -> Data {
        do {
            let privateKey = try SecureEnclave.P256.Signing.PrivateKey()
            let representation = privateKey.dataRepresentation
            saveToKeychain(representation, isSecureEnclave: true)
            hardwareBacked = true
            return Data(privateKey.publicKey.x963Representation)
        } catch {
            // Secure Enclave failed; fall back to software
            return generateSoftwareKey()
        }
    }

    private static func signWithSecureEnclave(_ data: Data) -> Data {
        guard let stored = loadKeychainData() else {
            fatalError("TokenForge key not found. Call generateKey() first.")
        }
        do {
            let privateKey = try SecureEnclave.P256.Signing.PrivateKey(
                dataRepresentation: stored
            )
            let signature = try privateKey.signature(for: data)
            return signature.derRepresentation
        } catch {
            fatalError("Secure Enclave signing failed: \(error)")
        }
    }

    // MARK: - Software fallback path

    private static func generateSoftwareKey() -> Data {
        let privateKey = P256.Signing.PrivateKey()
        let raw = privateKey.rawRepresentation
        saveToKeychain(raw, isSecureEnclave: false)
        hardwareBacked = false
        return Data(privateKey.publicKey.x963Representation)
    }

    private static func signWithSoftwareKey(_ data: Data) -> Data {
        guard let stored = loadKeychainData() else {
            fatalError("TokenForge key not found. Call generateKey() first.")
        }
        do {
            let privateKey = try P256.Signing.PrivateKey(rawRepresentation: stored)
            let signature = try privateKey.signature(for: data)
            return signature.derRepresentation
        } catch {
            fatalError("Software signing failed: \(error)")
        }
    }

    // MARK: - Keychain helpers

    private static func saveToKeychain(_ data: Data, isSecureEnclave: Bool) {
        deleteKey()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainTag,
            kSecAttrAccount as String: isSecureEnclave ? "secure-enclave" : "software",
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(attributes as CFDictionary, nil)
        hardwareBacked = isSecureEnclave
    }

    private static func loadKeychainData() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainTag,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }
}
