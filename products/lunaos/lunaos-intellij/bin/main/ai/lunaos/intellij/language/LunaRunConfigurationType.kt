package ai.lunaos.intellij.language

import ai.lunaos.intellij.services.LunaApiClient
import com.intellij.execution.Executor
import com.intellij.execution.configurations.*
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.process.ProcessOutputType
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.icons.AllIcons
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.SettingsEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.JDOMExternalizerUtil
import org.jdom.Element
import java.io.File
import java.io.OutputStream
import javax.swing.*

class LunaRunConfigurationType : ConfigurationType {
    override fun getDisplayName(): String = "Luna Pipe"
    override fun getConfigurationTypeDescription(): String = "Run a .luna pipe expression"
    override fun getIcon(): Icon = AllIcons.Actions.Execute
    override fun getId(): String = "LunaRunConfiguration"
    override fun getConfigurationFactories(): Array<ConfigurationFactory> =
        arrayOf(LunaRunConfigurationFactory(this))
}

class LunaRunConfigurationFactory(
    type: ConfigurationType
) : ConfigurationFactory(type) {
    override fun getId(): String = "LunaRunConfigurationFactory"
    override fun createTemplateConfiguration(project: Project): RunConfiguration =
        LunaRunConfiguration(project, this, "Luna Pipe")
}

class LunaRunConfiguration(
    project: Project,
    factory: ConfigurationFactory,
    name: String
) : RunConfigurationBase<RunProfileState>(project, factory, name) {

    var filePath: String = ""

    override fun getConfigurationEditor(): SettingsEditor<out RunConfiguration> =
        LunaRunSettingsEditor()

    override fun getState(executor: Executor, env: ExecutionEnvironment): RunProfileState =
        LunaRunState(project, filePath)

    override fun readExternal(element: Element) {
        super.readExternal(element)
        filePath = JDOMExternalizerUtil.readField(element, "filePath") ?: ""
    }

    override fun writeExternal(element: Element) {
        super.writeExternal(element)
        JDOMExternalizerUtil.writeField(element, "filePath", filePath)
    }
}

class LunaRunSettingsEditor : SettingsEditor<LunaRunConfiguration>() {
    private val fileField = JTextField()

    override fun resetEditorFrom(config: LunaRunConfiguration) {
        fileField.text = config.filePath
    }

    override fun applyEditorTo(config: LunaRunConfiguration) {
        config.filePath = fileField.text
    }

    override fun createEditor(): JComponent {
        val panel = JPanel()
        panel.layout = BoxLayout(panel, BoxLayout.Y_AXIS)
        panel.add(JLabel("Luna file path:"))
        panel.add(fileField)
        return panel
    }
}

class LunaRunState(
    private val project: Project,
    private val filePath: String
) : RunProfileState {

    override fun execute(
        executor: Executor?,
        runner: com.intellij.execution.runners.ProgramRunner<*>
    ): com.intellij.execution.ExecutionResult {
        val handler = LunaPipeProcessHandler(project, filePath)
        val console = com.intellij.execution.impl.ConsoleViewImpl(project, false)
        console.attachToProcess(handler)
        handler.startNotify()
        return com.intellij.execution.DefaultExecutionResult(console, handler)
    }
}

class LunaPipeProcessHandler(
    private val project: Project,
    private val filePath: String
) : ProcessHandler() {

    override fun destroyProcessImpl() { notifyProcessTerminated(0) }
    override fun detachProcessImpl() { notifyProcessDetached() }
    override fun detachIsDefault(): Boolean = false
    override fun getProcessInput(): OutputStream? = null

    override fun startNotify() {
        super.startNotify()
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val expression = File(filePath).readText().trim()
                notifyTextAvailable("Running: $expression\n", ProcessOutputType.STDOUT)
                val result = LunaApiClient.getInstance().executePipe(expression)
                notifyTextAvailable("Status: ${result.status}\n", ProcessOutputType.STDOUT)
                notifyTextAvailable("Output: ${result.output}\n", ProcessOutputType.STDOUT)
                result.steps.forEachIndexed { i, step ->
                    val line = "${i + 1}. [${step.status}] ${step.command} (${step.durationMs}ms)\n"
                    notifyTextAvailable(line, ProcessOutputType.STDOUT)
                }
                notifyProcessTerminated(0)
            } catch (e: Exception) {
                notifyTextAvailable("Error: ${e.message}\n", ProcessOutputType.STDERR)
                notifyProcessTerminated(1)
            }
        }
    }
}
