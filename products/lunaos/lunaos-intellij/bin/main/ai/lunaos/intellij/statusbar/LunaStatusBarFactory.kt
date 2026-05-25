package ai.lunaos.intellij.statusbar

import ai.lunaos.intellij.services.RunStateService
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.util.Consumer
import java.awt.Component
import java.awt.event.MouseEvent

class LunaStatusBarFactory : StatusBarWidgetFactory {

    override fun getId(): String = "ai.lunaos.intellij.StatusBar"
    override fun getDisplayName(): String = "LunaOS Status"
    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget =
        LunaStatusBarWidget(project)

    override fun disposeWidget(widget: StatusBarWidget) {
        Disposer.dispose(widget)
    }
}

class LunaStatusBarWidget(
    private val project: Project
) : StatusBarWidget, StatusBarWidget.TextPresentation {

    private var statusBar: StatusBar? = null
    private val listener: () -> Unit = { statusBar?.updateWidget(ID()) }

    override fun ID(): String = "ai.lunaos.intellij.StatusBar"

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        project.getService(RunStateService::class.java).addListener(listener)
    }

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun getText(): String {
        val count = project.getService(RunStateService::class.java).activeRunCount
        return if (count > 0) "LunaOS: $count running" else "LunaOS: idle"
    }

    override fun getTooltipText(): String = "Click to open LunaOS panel"
    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    override fun getClickConsumer(): Consumer<MouseEvent> = Consumer {
        ToolWindowManager.getInstance(project).getToolWindow("LunaOS")?.show()
    }

    override fun dispose() {
        project.getService(RunStateService::class.java).removeListener(listener)
    }
}
