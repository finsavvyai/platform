package ai.lunaos.intellij.toolwindow

import ai.lunaos.intellij.notifications.LunaNotifier
import ai.lunaos.intellij.services.LunaApiClient
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextField
import com.intellij.ui.dsl.builder.*
import javax.swing.JComponent
import javax.swing.JTextArea

class LogsPanel(private val project: Project) {

    private val runIdField = JBTextField().apply {
        emptyText.text = "Enter run ID..."
    }
    private val logArea = JTextArea().apply {
        isEditable = false
        lineWrap = true
        wrapStyleWord = true
        font = java.awt.Font("JetBrains Mono", java.awt.Font.PLAIN, 12)
    }

    fun getContent(): JComponent = panel {
        row {
            cell(runIdField).align(Align.FILL).resizableColumn()
            button("Load Logs") { loadLogs() }
            button("Clear") { logArea.text = "" }
        }
        separator()
        row {
            cell(JBScrollPane(logArea)).align(Align.FILL).resizableColumn()
        }.resizableRow()
    }

    private fun loadLogs() {
        val runId = runIdField.text.trim()
        if (runId.isBlank()) return

        logArea.text = "Loading logs for run $runId...\n"

        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val logs = LunaApiClient.getInstance().fetchRunLogs(runId)
                ApplicationManager.getApplication().invokeLater {
                    logArea.text = ""
                    if (logs.isEmpty()) {
                        logArea.append("No logs found for run $runId\n")
                        return@invokeLater
                    }
                    logs.forEach { entry ->
                        logArea.append("[${entry.timestamp}] ${entry.level}: ${entry.message}\n")
                    }
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    logArea.append("Error: ${e.message}\n")
                    LunaNotifier.error(project, "Failed to load logs: ${e.message}")
                }
            }
        }
    }

    fun showLogsForRun(runId: String) {
        runIdField.text = runId
        loadLogs()
    }
}
