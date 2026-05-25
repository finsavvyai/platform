package ai.lunaos.intellij.toolwindow

import ai.lunaos.intellij.notifications.LunaNotifier
import ai.lunaos.intellij.services.LunaApiClient
import ai.lunaos.intellij.services.RunStateService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextField
import com.intellij.ui.dsl.builder.*
import javax.swing.*

class AgentsPanel(private val project: Project) {

    private val listModel = DefaultListModel<AgentItem>()
    private val agentList = JBList(listModel).apply {
        cellRenderer = AgentCellRenderer()
        selectionMode = ListSelectionModel.SINGLE_SELECTION
    }
    private val searchField = JBTextField()
    private var allAgents = listOf<LunaApiClient.Agent>()

    fun getContent(): JComponent = panel {
        row {
            cell(searchField)
                .align(Align.FILL)
                .resizableColumn()
                .applyToComponent {
                    emptyText.text = "Search agents..."
                    document.addDocumentListener(object : javax.swing.event.DocumentListener {
                        override fun insertUpdate(e: javax.swing.event.DocumentEvent?) = filterAgents()
                        override fun removeUpdate(e: javax.swing.event.DocumentEvent?) = filterAgents()
                        override fun changedUpdate(e: javax.swing.event.DocumentEvent?) = filterAgents()
                    })
                }
            button("Refresh") { loadAgents() }
        }
        row {
            cell(JBScrollPane(agentList)).align(Align.FILL).resizableColumn()
        }.resizableRow()
        row {
            button("Run Selected") { onRunAgent() }
            button("Run with Context...") { onRunWithContext() }
        }
    }

    private fun loadAgents() {
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val agents = LunaApiClient.getInstance().fetchAgents()
                ApplicationManager.getApplication().invokeLater {
                    allAgents = agents
                    filterAgents()
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    LunaNotifier.error(project, "Failed to load agents: ${e.message}")
                }
            }
        }
    }

    private fun filterAgents() {
        val query = searchField.text.lowercase()
        listModel.clear()
        allAgents
            .filter { query.isBlank() || it.name.lowercase().contains(query) || it.category.lowercase().contains(query) }
            .forEach { listModel.addElement(AgentItem(it.id, it.name, it.category, it.description)) }
    }

    private fun onRunAgent() {
        val selected = agentList.selectedValue ?: return
        executeRun(selected.id, "")
    }

    private fun onRunWithContext() {
        val selected = agentList.selectedValue ?: return
        val context = JOptionPane.showInputDialog(null, "Enter context:", "Run ${selected.name}", JOptionPane.PLAIN_MESSAGE)
            ?: return
        executeRun(selected.id, context)
    }

    private fun executeRun(agentId: String, context: String) {
        val runState = project.getService(RunStateService::class.java)
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val result = LunaApiClient.getInstance().runAgent(agentId, context)
                runState.addRun(result.id)
                ApplicationManager.getApplication().invokeLater {
                    LunaNotifier.info(project, "Run started: ${result.id}")
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    LunaNotifier.error(project, "Run failed: ${e.message}")
                }
            }
        }
    }

    data class AgentItem(val id: String, val name: String, val category: String, val description: String) {
        override fun toString(): String = "$name [$category]"
    }
}
