package ai.lunaos.intellij.toolwindow

import ai.lunaos.intellij.notifications.LunaNotifier
import ai.lunaos.intellij.services.LunaApiClient
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.dsl.builder.*
import com.intellij.ui.table.JBTable
import javax.swing.JComponent
import javax.swing.table.DefaultTableModel

class RunsPanel(private val project: Project) {

    private val columns = arrayOf("Run ID", "Agent", "Status", "Started", "Duration")
    private val tableModel = DefaultTableModel(columns, 0)
    private val table = JBTable(tableModel).apply {
        autoCreateRowSorter = true
        fillsViewportHeight = true
    }

    fun getContent(): JComponent = panel {
        row {
            button("Refresh Runs") { loadRuns() }
            button("View Logs") { onViewLogs() }
        }
        separator()
        row {
            cell(JBScrollPane(table)).align(Align.FILL).resizableColumn()
        }.resizableRow()
    }

    private fun loadRuns() {
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val runs = LunaApiClient.getInstance().fetchRuns()
                ApplicationManager.getApplication().invokeLater {
                    tableModel.rowCount = 0
                    runs.forEach { run ->
                        val duration = run.durationMs?.let { "${it}ms" } ?: "—"
                        tableModel.addRow(arrayOf(
                            run.id.take(8), run.agentName, run.status, run.startedAt, duration
                        ))
                    }
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    LunaNotifier.error(project, "Failed to load runs: ${e.message}")
                }
            }
        }
    }

    private fun onViewLogs() {
        val row = table.selectedRow
        if (row < 0) return
        val runId = tableModel.getValueAt(row, 0) as String
        val toolWindow = com.intellij.openapi.wm.ToolWindowManager.getInstance(project)
            .getToolWindow("LunaOS") ?: return
        val logsContent = toolWindow.contentManager.findContent("Logs") ?: return
        toolWindow.contentManager.setSelectedContent(logsContent)
    }
}
