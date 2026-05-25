package com.upm.plugin.toolwindow

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.DefaultActionGroup
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.ui.JBUI
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyAnalysisResult
import com.upm.plugin.api.models.DependencyNode
import com.upm.plugin.tree.DependencyTreePanel
import com.upm.plugin.tree.DependencyTreeRenderer
import com.upm.plugin.ui.UPMToolWindowFactory
import com.upm.plugin.utils.UPMLogger
import java.awt.BorderLayout
import java.awt.CardLayout
import javax.swing.*

/**
 * Main panel for the UPM tool window.
 *
 * This panel provides a comprehensive view of project dependencies,
 * vulnerabilities, and policy compliance status.
 */
class UPMToolWindowPanel(private val project: Project) : SimpleToolWindowPanel(true, true) {

    private val upmService: UPMService = UPMService.getInstance(project)
    private val cardLayout = CardLayout()
    private val mainPanel = JBPanel<JBPanel<*>>(cardLayout)

    // UI Components
    private lateinit var loadingPanel: JBPanel<*>
    private lateinit var dependencyTreePanel: DependencyTreePanel
    private lateinit var summaryPanel: JBPanel<*>
    private lateinit var emptyPanel: JBPanel<*>

    // Current analysis result
    private var currentAnalysis: DependencyAnalysisResult? = null

    init {
        initializeUI()
        setupToolbar()
        loadInitialData()
    }

    private fun initializeUI() {
        // Create different card panels
        createLoadingPanel()
        createDependencyTreePanel()
        createSummaryPanel()
        createEmptyPanel()

        // Add panels to card layout
        mainPanel.add(loadingPanel, "loading")
        mainPanel.add(dependencyTreePanel, "tree")
        mainPanel.add(summaryPanel, "summary")
        mainPanel.add(emptyPanel, "empty")

        // Set default view
        cardLayout.show(mainPanel, "loading")

        // Add to content panel
        setContent(mainPanel)
    }

    private fun createLoadingPanel() {
        loadingPanel = JBPanel<JBPanel<*>>(BorderLayout()).apply {
            border = JBUI.Borders.empty(20)

            val label = JBLabel("Analyzing dependencies...", SwingConstants.CENTER)
            add(label, BorderLayout.CENTER)

            val progressBar = JProgressBar().apply {
                isIndeterminate = true
                border = JBUI.Borders.emptyTop(10)
            }
            add(progressBar, BorderLayout.SOUTH)
        }
    }

    private fun createDependencyTreePanel() {
        dependencyTreePanel = DependencyTreePanel(project).apply {
            addDependencySelectionListener { dependency ->
                showDependencyDetails(dependency)
            }
        }
    }

    private fun createSummaryPanel() {
        summaryPanel = JBPanel<JBPanel<*>>(BorderLayout()).apply {
            border = JBUI.Borders.empty(10)

            val summaryInfo = createSummaryInfo()
            val scrollPane = JBScrollPane(summaryInfo)
            add(scrollPane, BorderLayout.CENTER)

            val backButton = JButton("Back to Tree View").apply {
                addActionListener {
                    cardLayout.show(mainPanel, "tree")
                }
            }
            val buttonPanel = JBPanel<JBPanel<*>>().apply {
                add(backButton)
            }
            add(buttonPanel, BorderLayout.SOUTH)
        }
    }

    private fun createEmptyPanel() {
        emptyPanel = JBPanel<JBPanel<*>>(BorderLayout()).apply {
            border = JBUI.Borders.empty(20)

            val label = JBLabel("<html><center>" +
                    "<h3>No Dependencies Found</h3>" +
                    "<p>This project doesn't contain any supported dependency files.<br/>" +
                    "Supported formats: Maven (pom.xml), Gradle (build.gradle, build.gradle.kts)</p>" +
                    "</center></html>", SwingConstants.CENTER)

            add(label, BorderLayout.CENTER)

            val refreshButton = JButton("Refresh").apply {
                addActionListener {
                    loadInitialData()
                }
            }
            val buttonPanel = JBPanel<JBPanel<*>>().apply {
                add(refreshButton)
            }
            add(buttonPanel, BorderLayout.SOUTH)
        }
    }

    private fun setupToolbar() {
        val actionManager = ActionManager.getInstance()
        val toolbarActions = DefaultActionGroup("UPMToolbar", false)

        // Add refresh action
        toolbarActions.addAction(actionManager.getAction("UPM.RefreshDependencies"))

        // Add analyze action
        toolbarActions.addAction(actionManager.getAction("UPM.AnalyzeDependencies"))

        // Add separator
        toolbarActions.addSeparator()

        // Add export actions
        toolbarActions.addAction(actionManager.getAction("UPM.GenerateSBOM"))

        val toolbar = actionManager.createActionToolbar("UPM", toolbarActions, true)
        toolbar.targetComponent = this
        setToolbar(toolbar.component)
    }

    private fun loadInitialData() {
        cardLayout.show(mainPanel, "loading")

        // Load dependencies asynchronously
        Thread {
            try {
                val analysis = upmService.analyzeDependencies()
                currentAnalysis = analysis

                SwingUtilities.invokeLater {
                    if (analysis.dependencies.isEmpty()) {
                        cardLayout.show(mainPanel, "empty")
                    } else {
                        dependencyTreePanel.updateAnalysis(analysis)
                        updateSummaryPanel(analysis)
                        cardLayout.show(mainPanel, "tree")
                    }
                }
            } catch (e: Exception) {
                UPMLogger.error("Error loading initial data", e)
                SwingUtilities.invokeLater {
                    cardLayout.show(mainPanel, "empty")
                }
            }
        }.start()
    }

    private fun createSummaryInfo(): JComponent {
        val panel = JBPanel<JBPanel<*>>()
        panel.layout = BoxLayout(panel, BoxLayout.Y_AXIS)

        currentAnalysis?.let { analysis ->
            // Project info
            panel.add(createInfoSection("Project Analysis Summary", listOf(
                "Total Dependencies: ${analysis.totalDependencies}",
                "Vulnerable Dependencies: ${analysis.vulnerableDependencies}",
                "Outdated Dependencies: ${analysis.outdatedDependencies}",
                "Policy Violations: ${analysis.policyViolations}",
                "Last Analysis: ${java.util.Date(analysis.timestamp)}"
            )))

            // Vulnerability summary
            val vulnerabilitySummary = analysis.vulnerabilities.groupBy { it.severity }
                .mapValues { it.value.size }
                .toList()
                .sortedByDescending { it.first }
                .map { "${it.first}: ${it.second}" }

            if (vulnerabilitySummary.isNotEmpty()) {
                panel.add(createInfoSection("Vulnerability Summary", vulnerabilitySummary))
            }

            // Top vulnerable dependencies
            val topVulnerable = analysis.dependencies
                .filter { it.vulnerabilities.isNotEmpty() }
                .sortedByDescending { it.vulnerabilities.size }
                .take(10)
                .map { dep ->
                    val vulnCount = dep.vulnerabilities.size
                    val severity = dep.vulnerabilities.maxOfOrNull { it.severity.name } ?: "UNKNOWN"
                    "${dep.groupId}:${dep.artifactId} - $vulnCount vulnerabilities (Highest: $severity)"
                }

            if (topVulnerable.isNotEmpty()) {
                panel.add(createInfoSection("Top Vulnerable Dependencies", topVulnerable))
            }
        }

        return JBScrollPane(panel)
    }

    private fun createInfoSection(title: String, items: List<String>): JComponent {
        val panel = JBPanel<JBPanel<*>>(BorderLayout())
        panel.border = JBUI.Borders.compound(
            JBUI.Borders.customLine(com.intellij.ui.JBColor.GRAY, 1),
            JBUI.Borders.empty(10)
        )

        val titleLabel = JBLabel(title).apply {
            font = font.deriveFont(font.style or java.awt.Font.BOLD)
        }
        panel.add(titleLabel, BorderLayout.NORTH)

        val itemsPanel = JBPanel<JBPanel<*>>()
        itemsPanel.layout = BoxLayout(itemsPanel, BoxLayout.Y_AXIS)

        items.forEach { item ->
            val label = JBLabel("• $item")
            label.border = JBUI.Borders.emptyTop(2)
            itemsPanel.add(label)
        }

        panel.add(JBScrollPane(itemsPanel), BorderLayout.CENTER)
        panel.border = JBUI.Borders.emptyBottom(10)

        return panel
    }

    private fun updateSummaryPanel(analysis: DependencyAnalysisResult) {
        // This will be called when the summary panel is shown
        // The summary is created dynamically in createSummaryInfo()
    }

    private fun showDependencyDetails(dependency: com.upm.plugin.api.models.Dependency) {
        // Show detailed information about selected dependency
        cardLayout.show(mainPanel, "summary")
        updateSummaryPanel(currentAnalysis ?: return)
    }

    /**
     * Refresh the dependency analysis
     */
    fun refresh() {
        loadInitialData()
    }

    /**
     * Show the dependency tree view
     */
    fun showDependencyTree() {
        cardLayout.show(mainPanel, "tree")
    }

    /**
     * Show the summary view
     */
    fun showSummary() {
        cardLayout.show(mainPanel, "summary")
        updateSummaryPanel(currentAnalysis ?: return)
    }

    /**
     * Get current analysis result
     */
    fun getCurrentAnalysis(): DependencyAnalysisResult? = currentAnalysis
}
