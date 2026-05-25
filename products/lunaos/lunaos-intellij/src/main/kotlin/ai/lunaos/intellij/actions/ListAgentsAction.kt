package ai.lunaos.intellij.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.wm.ToolWindowManager

class ListAgentsAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("LunaOS") ?: return
        val agentsContent = toolWindow.contentManager.findContent("Agents") ?: return
        toolWindow.contentManager.setSelectedContent(agentsContent)
        toolWindow.show()
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
