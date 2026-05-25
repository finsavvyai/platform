package ai.lunaos.intellij.toolwindow

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class LunaToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val contentFactory = ContentFactory.getInstance()

        val agentsPanel = AgentsPanel(project)
        val agentsContent = contentFactory.createContent(
            agentsPanel.getContent(), "Agents", false
        )
        toolWindow.contentManager.addContent(agentsContent)

        val runsPanel = RunsPanel(project)
        val runsContent = contentFactory.createContent(
            runsPanel.getContent(), "Runs", false
        )
        toolWindow.contentManager.addContent(runsContent)

        val logsPanel = LogsPanel(project)
        val logsContent = contentFactory.createContent(
            logsPanel.getContent(), "Logs", false
        )
        toolWindow.contentManager.addContent(logsContent)

        val playgroundPanel = PlaygroundPanel(project)
        val playgroundContent = contentFactory.createContent(
            playgroundPanel.getContent(), "Playground", false
        )
        toolWindow.contentManager.addContent(playgroundContent)
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
