package ai.lunaos.intellij.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.wm.ToolWindowManager

class ViewRunsAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("LunaOS") ?: return
        val runsContent = toolWindow.contentManager.findContent("Runs") ?: return
        toolWindow.contentManager.setSelectedContent(runsContent)
        toolWindow.show()
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
