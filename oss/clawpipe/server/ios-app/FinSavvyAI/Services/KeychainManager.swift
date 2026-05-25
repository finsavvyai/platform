//
//  KeychainManager.swift
//  Secure credential storage using iOS Keychain Services
//

import Foundation
import Security

/// Provides secure storage for API keys and sensitive configuration
/// using the iOS Keychain.
struct KeychainManager {
    private static let service = "com.finsavvyai.cluster"

    enum KeychainKey: String {
        case apiKey = "api_key"
        case serverIP = "server_ip"
        case serverPort = "server_port"
    }

    // MARK: - Save

    @discardableResult
    static func save(key: KeychainKey, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }

        // Delete existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    // MARK: - Read

    static func read(key: KeychainKey) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
            let data = result as? Data,
            let value = String(data: data, encoding: .utf8)
        else {
            return nil
        }

        return value
    }

    // MARK: - Delete

    @discardableResult
    static func delete(key: KeychainKey) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    // MARK: - Convenience

    /// Store an API key securely. Returns the key for confirmation.
    static func storeAPIKey(_ key: String) -> Bool {
        save(key: .apiKey, value: key)
    }

    /// Retrieve the stored API key, if any.
    static func getAPIKey() -> String? {
        read(key: .apiKey)
    }

    /// Remove the stored API key.
    static func removeAPIKey() -> Bool {
        delete(key: .apiKey)
    }
}
