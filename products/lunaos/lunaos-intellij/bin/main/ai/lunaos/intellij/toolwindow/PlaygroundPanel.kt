package ai.lunaos.intellij.toolwindow

import ai.lunaos.intellij.notifications.LunaNotifier
import ai.lunaos.intellij.services.LunaApiClient
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileChooser.FileChooserFactory
import com.intellij.openapi.fileChooser.FileSaverDescriptor
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBScrollPane
import java.awt.*
import javax.swing.*

class PlaygroundPanel(private val project: Project) {

    private val codeArea = createCodeArea()
    private val outputArea = createOutputArea()
    private val statusLabel = JLabel("Ready").apply {
        border = BorderFactory.createEmptyBorder(4, 8, 4, 8)
    }

    fun getContent(): JComponent {
        val root = JPanel(BorderLayout())
        root.add(buildToolbar(), BorderLayout.NORTH)
        root.add(buildSplitPane(), BorderLayout.CENTER)
        root.add(statusLabel, BorderLayout.SOUTH)
        return root
    }

    private fun buildToolbar(): JPanel {
        val toolbar = JPanel(FlowLayout(FlowLayout.LEFT, 4, 2))
        toolbar.add(createButton("Run", this::onRun))
        toolbar.add(createButton("Clear", this::onClear))
        toolbar.add(createButton("Save as .luna", this::onSave))
        toolbar.add(buildTemplateDropdown())
        return toolbar
    }

    private fun buildTemplateDropdown(): JComboBox<String> {
        val names = arrayOf("Load Template...") +
            PlaygroundTemplates.ALL.map { it.name }.toTypedArray()
        return JComboBox(names).apply {
            accessibleContext.accessibleName = "Load template"
            addActionListener {
                val idx = selectedIndex
                if (idx > 0) {
                    codeArea.text = PlaygroundTemplates.ALL[idx - 1].code
                    selectedIndex = 0
                }
            }
        }
    }

    private fun buildSplitPane(): JSplitPane {
        val codeScroll = JBScrollPane(codeArea).apply {
            accessibleContext.accessibleName = "Luna code editor"
        }
        val outputScroll = JBScrollPane(outputArea).apply {
            accessibleContext.accessibleName = "Execution output"
        }
        return JSplitPane(JSplitPane.VERTICAL_SPLIT, codeScroll, outputScroll).apply {
            resizeWeight = 0.5
            dividerSize = 6
        }
    }

    private fun createCodeArea(): JTextArea = JTextArea().apply {
        font = Font("JetBrains Mono", Font.PLAIN, 13)
        background = Color(0x2B, 0x2B, 0x2B)
        foreground = Color(0xA9, 0xB7, 0xC6)
        caretColor = Color(0xA9, 0xB7, 0xC6)
        tabSize = 2
        lineWrap = true
        wrapStyleWord = true
        accessibleContext.accessibleName = "Luna pipe expression editor"
        text = "# Write Luna pipe expressions here\nreq >> des >> plan >> go"
    }

    private fun createOutputArea(): JTextArea = JTextArea().apply {
        font = Font("JetBrains Mono", Font.PLAIN, 12)
        background = Color(0x1E, 0x1E, 0x1E)
        foreground = Color(0xCC, 0xCC, 0xCC)
        isEditable = false
        lineWrap = true
        wrapStyleWord = true
        accessibleContext.accessibleName = "Pipe execution output"
    }

    private fun createButton(text: String, action: () -> Unit): JButton =
        JButton(text).apply {
            accessibleContext.accessibleName = text
            addActionListener { action() }
        }

    private fun onRun() {
        val expression = codeArea.text.trim()
        if (expression.isBlank()) return
        statusLabel.text = "Running..."
        outputArea.text = ""

        ApplicationManager.getApplication().executeOnPooledThread {
            val startMs = System.currentTimeMillis()
            try {
                val result = LunaApiClient.getInstance().executePipe(expression)
                val elapsed = System.currentTimeMillis() - startMs
                ApplicationManager.getApplication().invokeLater {
                    renderResult(result)
                    statusLabel.text = "Completed in ${elapsed}ms"
                }
            } catch (e: Exception) {
                val elapsed = System.currentTimeMillis() - startMs
                ApplicationManager.getApplication().invokeLater {
                    outputArea.text = "Error: ${e.message}"
                    statusLabel.text = "Error (${elapsed}ms): ${e.message}"
                    LunaNotifier.error(project, "Pipe execution failed: ${e.message}")
                }
            }
        }
    }

    private fun renderResult(result: LunaApiClient.PipeResult) {
        val sb = StringBuilder()
        sb.appendLine("Status: ${result.status}")
        sb.appendLine("Output: ${result.output}")
        if (result.steps.isNotEmpty()) {
            sb.appendLine("\n--- Steps ---")
            result.steps.forEachIndexed { i, step ->
                sb.appendLine("${i + 1}. [${step.status}] ${step.command} (${step.durationMs}ms)")
                if (step.output.isNotBlank()) sb.appendLine("   ${step.output}")
            }
        }
        outputArea.text = sb.toString()
    }

    private fun onClear() {
        codeArea.text = ""
        outputArea.text = ""
        statusLabel.text = "Ready"
    }

    private fun onSave() {
        val descriptor = FileSaverDescriptor("Save Luna File", "Save pipe expression as .luna file", "luna")
        val wrapper = FileChooserFactory.getInstance().createSaveFileDialog(descriptor, project)
        val dest = wrapper.save(null as com.intellij.openapi.vfs.VirtualFile?, "untitled.luna") ?: return
        ApplicationManager.getApplication().runWriteAction {
            dest.file.writeText(codeArea.text)
        }
        LunaNotifier.info(project, "Saved: ${dest.file.name}")
    }
}
