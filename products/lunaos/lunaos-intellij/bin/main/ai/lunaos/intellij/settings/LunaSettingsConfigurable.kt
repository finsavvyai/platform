package ai.lunaos.intellij.settings

import ai.lunaos.intellij.services.LunaApiClient
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.Messages
import com.intellij.ui.dsl.builder.*
import javax.swing.JComponent

class LunaSettingsConfigurable : Configurable {

    private var endpoint = ""
    private var apiKey = ""
    private var autoRefresh = true
    private var refreshInterval = 30
    private var notifications = true
    private var defaultAgent = ""

    override fun getDisplayName(): String = "LunaOS"

    override fun createComponent(): JComponent {
        val s = LunaSettingsState.getInstance()
        endpoint = s.apiEndpoint
        apiKey = s.apiKey
        autoRefresh = s.autoRefresh
        refreshInterval = s.refreshIntervalSeconds
        notifications = s.enableNotifications
        defaultAgent = s.defaultAgentId

        return panel {
            group("API Connection") {
                row("Endpoint:") {
                    textField()
                        .columns(COLUMNS_LARGE)
                        .bindText(::endpoint)
                        .comment("LunaOS Engine API base URL")
                }
                row("API Key:") {
                    passwordField()
                        .columns(COLUMNS_LARGE)
                        .bindText(::apiKey)
                        .comment("Generate at agents.lunaos.ai/dashboard/api-keys")
                }
                row {
                    button("Test Connection") { onTestConnection() }
                }
            }
            group("Defaults") {
                row("Default Agent ID:") {
                    textField()
                        .columns(COLUMNS_MEDIUM)
                        .bindText(::defaultAgent)
                        .comment("Used for quick-run and editor context actions")
                }
            }
            group("Behavior") {
                row {
                    checkBox("Auto-refresh agent list and run status")
                        .bindSelected(::autoRefresh)
                }
                row("Refresh interval (seconds):") {
                    spinner(5..300, 5)
                        .bindIntValue(::refreshInterval)
                }
                row {
                    checkBox("Show balloon notifications for completed runs")
                        .bindSelected(::notifications)
                }
            }
        }
    }

    override fun isModified(): Boolean {
        val s = LunaSettingsState.getInstance()
        return endpoint != s.apiEndpoint || apiKey != s.apiKey
            || autoRefresh != s.autoRefresh || refreshInterval != s.refreshIntervalSeconds
            || notifications != s.enableNotifications || defaultAgent != s.defaultAgentId
    }

    override fun apply() {
        val s = LunaSettingsState.getInstance()
        s.apiEndpoint = endpoint
        s.apiKey = apiKey
        s.autoRefresh = autoRefresh
        s.refreshIntervalSeconds = refreshInterval
        s.enableNotifications = notifications
        s.defaultAgentId = defaultAgent
    }

    override fun reset() {
        val s = LunaSettingsState.getInstance()
        endpoint = s.apiEndpoint
        apiKey = s.apiKey
        autoRefresh = s.autoRefresh
        refreshInterval = s.refreshIntervalSeconds
        notifications = s.enableNotifications
        defaultAgent = s.defaultAgentId
    }

    private fun onTestConnection() {
        try {
            LunaApiClient.getInstance().testConnection(endpoint, apiKey)
            Messages.showInfoMessage("Connected to LunaOS API successfully.", "LunaOS")
        } catch (e: Exception) {
            Messages.showErrorDialog("Connection failed: ${e.message}", "LunaOS")
        }
    }
}
