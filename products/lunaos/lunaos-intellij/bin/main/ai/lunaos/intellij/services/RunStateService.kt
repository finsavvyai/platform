package ai.lunaos.intellij.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import java.util.concurrent.CopyOnWriteArrayList

@Service(Service.Level.PROJECT)
class RunStateService(private val project: Project) {

    private val activeRuns = CopyOnWriteArrayList<String>()
    private val listeners = CopyOnWriteArrayList<() -> Unit>()

    val activeRunCount: Int get() = activeRuns.size

    fun addRun(runId: String) {
        activeRuns.add(runId)
        notifyListeners()
    }

    fun removeRun(runId: String) {
        activeRuns.remove(runId)
        notifyListeners()
    }

    fun addListener(listener: () -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: () -> Unit) {
        listeners.remove(listener)
    }

    private fun notifyListeners() {
        listeners.forEach { it() }
    }
}
