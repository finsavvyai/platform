package ai.lunaos.intellij.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

@State(
    name = "ai.lunaos.intellij.settings.LunaSettingsState",
    storages = [Storage("LunaOSSettings.xml")]
)
class LunaSettingsState : PersistentStateComponent<LunaSettingsState> {

    var apiEndpoint: String = "https://api.lunaos.ai"
    var apiKey: String = ""
    var autoRefresh: Boolean = true
    var refreshIntervalSeconds: Int = 30
    var enableNotifications: Boolean = true
    var defaultAgentId: String = ""

    companion object {
        fun getInstance(): LunaSettingsState =
            ApplicationManager.getApplication().getService(LunaSettingsState::class.java)
    }

    override fun getState(): LunaSettingsState = this

    override fun loadState(state: LunaSettingsState) {
        XmlSerializerUtil.copyBean(state, this)
    }
}
