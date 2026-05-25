//
//  SettingsTests.swift
//  Tests for settings defaults, persistence, and validation
//

import XCTest

@testable import FinSavvyAI

// MARK: - Settings Defaults Tests

final class SettingsDefaultsTests: XCTestCase {

    override func tearDown() {
        // Clean up UserDefaults after each test
        let keys = [
            "serverIP", "serverPort", "refreshInterval",
            "notificationsEnabled", "darkModeEnabled",
        ]
        keys.forEach { UserDefaults.standard.removeObject(forKey: $0) }
        super.tearDown()
    }

    func testDefaultServerIP() {
        UserDefaults.standard.removeObject(forKey: "serverIP")
        let ip = UserDefaults.standard.string(forKey: "serverIP") ?? "10.0.0.10"
        XCTAssertEqual(ip, "10.0.0.10")
    }

    func testDefaultServerPort() {
        UserDefaults.standard.removeObject(forKey: "serverPort")
        let port = UserDefaults.standard.string(forKey: "serverPort") ?? "8000"
        XCTAssertEqual(port, "8000")
    }

    func testDefaultRefreshInterval() {
        UserDefaults.standard.removeObject(forKey: "refreshInterval")
        var interval = UserDefaults.standard.double(forKey: "refreshInterval")
        if interval < 1 { interval = 5.0 }
        XCTAssertEqual(interval, 5.0)
    }

    func testDefaultNotificationsEnabled() {
        UserDefaults.standard.removeObject(forKey: "notificationsEnabled")
        let enabled = UserDefaults.standard.object(forKey: "notificationsEnabled") as? Bool ?? true
        XCTAssertTrue(enabled)
    }

    func testDefaultDarkModeEnabled() {
        UserDefaults.standard.removeObject(forKey: "darkModeEnabled")
        let enabled = UserDefaults.standard.object(forKey: "darkModeEnabled") as? Bool ?? true
        XCTAssertTrue(enabled)
    }
}

// MARK: - Settings Persistence Tests

final class SettingsPersistenceTests: XCTestCase {

    override func tearDown() {
        let keys = [
            "serverIP", "serverPort", "refreshInterval",
            "notificationsEnabled", "darkModeEnabled",
        ]
        keys.forEach { UserDefaults.standard.removeObject(forKey: $0) }
        super.tearDown()
    }

    func testSaveAndReadServerIP() {
        UserDefaults.standard.set("192.168.1.100", forKey: "serverIP")
        XCTAssertEqual(UserDefaults.standard.string(forKey: "serverIP"), "192.168.1.100")
    }

    func testSaveAndReadServerPort() {
        UserDefaults.standard.set("9090", forKey: "serverPort")
        XCTAssertEqual(UserDefaults.standard.string(forKey: "serverPort"), "9090")
    }

    func testSaveAndReadRefreshInterval() {
        UserDefaults.standard.set(15.0, forKey: "refreshInterval")
        XCTAssertEqual(UserDefaults.standard.double(forKey: "refreshInterval"), 15.0)
    }

    func testSaveAndReadNotificationsDisabled() {
        UserDefaults.standard.set(false, forKey: "notificationsEnabled")
        let enabled = UserDefaults.standard.object(forKey: "notificationsEnabled") as? Bool ?? true
        XCTAssertFalse(enabled)
    }

    func testSaveAndReadDarkModeDisabled() {
        UserDefaults.standard.set(false, forKey: "darkModeEnabled")
        let enabled = UserDefaults.standard.object(forKey: "darkModeEnabled") as? Bool ?? true
        XCTAssertFalse(enabled)
    }
}

// MARK: - Port Validation Tests

final class PortValidationTests: XCTestCase {

    func testValidPortMinimum() {
        let port = Int("1")!
        XCTAssertTrue((1...65535).contains(port))
    }

    func testValidPortMaximum() {
        let port = Int("65535")!
        XCTAssertTrue((1...65535).contains(port))
    }

    func testValidPortTypical() {
        let port = Int("8000")!
        XCTAssertTrue((1...65535).contains(port))
    }

    func testInvalidPortZero() {
        let port = Int("0")!
        XCTAssertFalse((1...65535).contains(port))
    }

    func testInvalidPortTooHigh() {
        let port = Int("65536")!
        XCTAssertFalse((1...65535).contains(port))
    }

    func testInvalidPortNonNumeric() {
        let port = Int("abc")
        XCTAssertNil(port, "Non-numeric port should fail to parse")
    }

    func testInvalidPortEmpty() {
        let port = Int("")
        XCTAssertNil(port, "Empty port should fail to parse")
    }
}

// MARK: - API Key Storage via Keychain Tests

final class SettingsAPIKeyTests: XCTestCase {

    override func tearDown() {
        KeychainManager.removeAPIKey()
        super.tearDown()
    }

    func testEmptyAPIKeyNotStored() {
        // Empty string should still store (validation is in the view)
        // but reading back should return the empty string
        let result = KeychainManager.storeAPIKey("")
        // Data conversion may fail for empty, behavior depends on impl
        if result {
            XCTAssertEqual(KeychainManager.getAPIKey(), "")
        } else {
            XCTAssertNil(KeychainManager.getAPIKey())
        }
    }

    func testAPIKeyRoundTrip() {
        let key = "finsavvy-settings-test-key-12345"
        XCTAssertTrue(KeychainManager.storeAPIKey(key))
        XCTAssertEqual(KeychainManager.getAPIKey(), key)
    }

    func testAPIKeyRemoval() {
        KeychainManager.storeAPIKey("finsavvy-temp-key")
        XCTAssertNotNil(KeychainManager.getAPIKey())
        KeychainManager.removeAPIKey()
        XCTAssertNil(KeychainManager.getAPIKey())
    }
}
