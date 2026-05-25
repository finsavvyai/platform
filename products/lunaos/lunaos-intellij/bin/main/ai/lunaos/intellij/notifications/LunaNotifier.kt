package ai.lunaos.intellij.notifications

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

object LunaNotifier {

    private fun group() = NotificationGroupManager.getInstance()
        .getNotificationGroup("LunaOS Notifications")

    fun info(project: Project?, message: String) {
        group().createNotification(message, NotificationType.INFORMATION).notify(project)
    }

    fun warn(project: Project?, message: String) {
        group().createNotification(message, NotificationType.WARNING).notify(project)
    }

    fun error(project: Project?, message: String) {
        group().createNotification(message, NotificationType.ERROR).notify(project)
    }

    fun runCompleted(project: Project?, agentName: String, runId: String) {
        group()
            .createNotification(
                "Agent \"$agentName\" completed (run $runId)",
                NotificationType.INFORMATION
            )
            .addAction(object : AnAction("View Logs") {
                override fun actionPerformed(e: AnActionEvent) {
                    val p = e.project ?: return
                    ToolWindowManager.getInstance(p).getToolWindow("LunaOS")?.show()
                }
            })
            .addAction(object : AnAction("Open Settings") {
                override fun actionPerformed(e: AnActionEvent) {
                    com.intellij.openapi.options.ShowSettingsUtil.getInstance()
                        .showSettingsDialog(e.project, "ai.lunaos.intellij.settings")
                }
            })
            .notify(project)
    }
}
