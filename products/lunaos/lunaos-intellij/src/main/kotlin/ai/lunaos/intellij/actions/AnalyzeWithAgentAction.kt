package ai.lunaos.intellij.actions

import ai.lunaos.intellij.notifications.LunaNotifier
import ai.lunaos.intellij.services.LunaApiClient
import ai.lunaos.intellij.settings.LunaSettingsState
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task

class AnalyzeWithAgentAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val project = e.project ?: return
        val selectedText = editor.selectionModel.selectedText
        if (selectedText.isNullOrBlank()) return

        val agentId = LunaSettingsState.getInstance().defaultAgentId
        if (agentId.isBlank()) {
            LunaNotifier.warn(project, "Set a default agent in Settings > Tools > LunaOS first.")
            return
        }

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Analyzing with LunaOS...", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Sending code to agent..."
                try {
                    val result = LunaApiClient.getInstance().analyzeCode(selectedText, agentId)
                    ApplicationManager.getApplication().invokeLater {
                        LunaNotifier.info(project, result)
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        LunaNotifier.error(project, "Analysis failed: ${ex.message}")
                    }
                }
            }
        })
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible =
            editor != null && editor.selectionModel.hasSelection()
    }
}
