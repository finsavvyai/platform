package ai.lunaos.intellij.actions

import ai.lunaos.intellij.notifications.LunaNotifier
import ai.lunaos.intellij.services.LunaApiClient
import ai.lunaos.intellij.services.RunStateService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.popup.JBPopupFactory

class RunAgentAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val api = LunaApiClient.getInstance()

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Loading agents...", true) {
            override fun run(indicator: ProgressIndicator) {
                val agents = try {
                    api.fetchAgents()
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        LunaNotifier.error(project, "Failed to load agents: ${ex.message}")
                    }
                    return
                }

                ApplicationManager.getApplication().invokeLater {
                    val labels = agents.map { "${it.name} [${it.category}]" }

                    JBPopupFactory.getInstance()
                        .createPopupChooserBuilder(labels)
                        .setTitle("Select Agent to Run")
                        .setItemChosenCallback { selected: String ->
                            val idx = labels.indexOf(selected)
                            if (idx >= 0) {
                                val agent = agents[idx]
                                executeAgent(project, agent.id, agent.name)
                            }
                        }
                        .createPopup()
                        .showCenteredInCurrentWindow(project)
                }
            }
        })
    }

    private fun executeAgent(project: com.intellij.openapi.project.Project, agentId: String, name: String) {
        val runState = project.getService(RunStateService::class.java)

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Running agent: $name", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Executing $name..."
                try {
                    val result = LunaApiClient.getInstance().runAgent(agentId, "")
                    runState.addRun(result.id)
                    ApplicationManager.getApplication().invokeLater {
                        LunaNotifier.runCompleted(project, name, result.id)
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        LunaNotifier.error(project, "Agent failed: ${ex.message}")
                    }
                }
            }
        })
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
